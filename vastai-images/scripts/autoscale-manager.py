#!/usr/bin/env python3
"""
ASI 360 Vast.ai Auto-Scaling Manager
Runs on droplet, monitors Supabase job queue, and auto-deploys GPU instances
"""

import os
import time
from datetime import datetime, timedelta
from supabase import create_client, Client
from vastai_deploy import VastAIDeployer

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
CHECK_INTERVAL = 60  # Check every 60 seconds
IDLE_TIMEOUT = 600  # Destroy instance after 10 minutes of no jobs
MAX_INSTANCES = 3  # Maximum concurrent GPU instances

# Initialize clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
deployer = VastAIDeployer()

# Track active instances
active_instances = {}  # {instance_id: {'type': 'video-editor', 'last_activity': datetime, 'jobs_processed': 0}}


def log(message: str):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {message}")


def get_pending_jobs(job_type: str = 'render') -> int:
    """Count pending jobs in Supabase queue"""
    try:
        response = supabase.table('render_jobs') \
            .select('id', count='exact') \
            .eq('status', 'pending') \
            .eq('job_type', job_type) \
            .execute()

        return response.count if response.count else 0

    except Exception as e:
        log(f"Error getting pending jobs: {e}")
        return 0


def should_scale_up(job_type: str) -> bool:
    """Determine if we need to spin up a new instance"""
    pending_count = get_pending_jobs(job_type)

    # Count active instances of this type
    active_count = sum(1 for inst in active_instances.values() if inst['type'] == job_type)

    # Scale up if:
    # - There are pending jobs
    # - We have < MAX_INSTANCES total
    # - We have no active instances of this type
    return (
        pending_count > 0
        and len(active_instances) < MAX_INSTANCES
        and active_count == 0
    )


def should_scale_down(instance_id: int) -> bool:
    """Determine if we should destroy an instance"""
    if instance_id not in active_instances:
        return False

    instance_info = active_instances[instance_id]
    last_activity = instance_info['last_activity']
    idle_time = (datetime.now() - last_activity).total_seconds()

    # Check if there are pending jobs of this type
    pending_count = get_pending_jobs(instance_info['type'])

    # Scale down if:
    # - Instance has been idle for IDLE_TIMEOUT
    # - No pending jobs in queue
    return idle_time > IDLE_TIMEOUT and pending_count == 0


def deploy_video_editor():
    """Deploy a video editor instance"""
    log("Deploying video editor instance...")

    instance_id = deployer.deploy_video_editor(max_price=0.50)

    if instance_id:
        active_instances[instance_id] = {
            'type': 'video-editor',
            'last_activity': datetime.now(),
            'jobs_processed': 0
        }
        log(f"✓ Video editor deployed: {instance_id}")

        # Record in Supabase
        supabase.table('vastai_instances').insert({
            'instance_id': instance_id,
            'instance_type': 'video-editor',
            'status': 'active',
            'deployed_at': datetime.now().isoformat()
        }).execute()

        return instance_id

    log("✗ Failed to deploy video editor")
    return None


def deploy_ai_services():
    """Deploy AI services instance"""
    log("Deploying AI services instance...")

    instance_id = deployer.deploy_ai_services(max_price=0.60)

    if instance_id:
        active_instances[instance_id] = {
            'type': 'ai-services',
            'last_activity': datetime.now(),
            'jobs_processed': 0
        }
        log(f"✓ AI services deployed: {instance_id}")

        supabase.table('vastai_instances').insert({
            'instance_id': instance_id,
            'instance_type': 'ai-services',
            'status': 'active',
            'deployed_at': datetime.now().isoformat()
        }).execute()

        return instance_id

    log("✗ Failed to deploy AI services")
    return None


def cleanup_instance(instance_id: int):
    """Destroy an idle instance"""
    if instance_id not in active_instances:
        return

    instance_info = active_instances[instance_id]
    log(f"Cleaning up instance {instance_id} (type: {instance_info['type']}, jobs: {instance_info['jobs_processed']})")

    if deployer.destroy_instance(instance_id):
        # Update Supabase
        supabase.table('vastai_instances') \
            .update({
                'status': 'destroyed',
                'destroyed_at': datetime.now().isoformat(),
                'jobs_processed': instance_info['jobs_processed']
            }) \
            .eq('instance_id', instance_id) \
            .execute()

        del active_instances[instance_id]
        log(f"✓ Instance {instance_id} destroyed")
    else:
        log(f"✗ Failed to destroy instance {instance_id}")


def update_instance_activity():
    """Check for recently completed jobs and update last_activity"""
    try:
        # Get jobs completed in last 2 minutes
        two_mins_ago = (datetime.now() - timedelta(minutes=2)).isoformat()

        response = supabase.table('render_jobs') \
            .select('job_type') \
            .eq('status', 'completed') \
            .gte('completed_at', two_mins_ago) \
            .execute()

        if response.data:
            # Update activity for relevant instances
            for inst_id, inst_info in active_instances.items():
                for job in response.data:
                    if job['job_type'] == inst_info['type']:
                        inst_info['last_activity'] = datetime.now()
                        inst_info['jobs_processed'] += 1
                        log(f"Instance {inst_id} processed job (total: {inst_info['jobs_processed']})")

    except Exception as e:
        log(f"Error updating instance activity: {e}")


def main():
    """Main auto-scaling loop"""
    log("Starting ASI 360 Vast.ai Auto-Scaling Manager")
    log(f"Check interval: {CHECK_INTERVAL}s")
    log(f"Idle timeout: {IDLE_TIMEOUT}s")
    log(f"Max instances: {MAX_INSTANCES}")

    while True:
        try:
            # Update instance activity based on completed jobs
            update_instance_activity()

            # Check if we need to scale up
            if should_scale_up('video-editor'):
                deploy_video_editor()

            if should_scale_up('ai-services'):
                deploy_ai_services()

            # Check if we need to scale down
            instances_to_cleanup = [
                inst_id for inst_id in active_instances.keys()
                if should_scale_down(inst_id)
            ]

            for inst_id in instances_to_cleanup:
                cleanup_instance(inst_id)

            # Log current state
            if active_instances:
                log(f"Active instances: {len(active_instances)}")
                for inst_id, info in active_instances.items():
                    idle_mins = (datetime.now() - info['last_activity']).total_seconds() / 60
                    log(f"  {inst_id}: {info['type']} - {info['jobs_processed']} jobs - idle {idle_mins:.1f}min")

            # Sleep before next check
            time.sleep(CHECK_INTERVAL)

        except KeyboardInterrupt:
            log("Shutting down gracefully...")
            # Cleanup all instances
            for inst_id in list(active_instances.keys()):
                cleanup_instance(inst_id)
            break

        except Exception as e:
            log(f"Error in main loop: {e}")
            time.sleep(CHECK_INTERVAL)


if __name__ == '__main__':
    main()
