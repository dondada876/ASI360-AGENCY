#!/usr/bin/env python3
"""
ASI 360 Vast.ai Instance Monitor & State Manager
Tracks instance health, detects reclaims, manages state persistence

Industry-standard approach:
1. Heartbeat monitoring (every 30s)
2. SQLite local state + Supabase backup
3. Automatic state recovery on reconnect
4. Webhook notifications on failures
"""

import os
import time
import json
import sqlite3
import subprocess
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from supabase import create_client, Client
from vastai_deploy import VastAIDeployer

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
HEARTBEAT_INTERVAL = 30  # Check every 30 seconds
MISSED_HEARTBEATS_THRESHOLD = 3  # Declare dead after 3 missed (90s)
STATE_DB_PATH = '/root/asi360-agency/vastai-state.db'

# Initialize clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
deployer = VastAIDeployer()

class InstanceState:
    """Local SQLite state manager for fast access"""

    def __init__(self, db_path: str = STATE_DB_PATH):
        self.db_path = db_path
        self.init_db()

    def init_db(self):
        """Initialize SQLite database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Instance tracking table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS instances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vastai_id INTEGER UNIQUE NOT NULL,
                instance_type TEXT NOT NULL,
                status TEXT DEFAULT 'running',
                public_ip TEXT,
                deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_heartbeat TIMESTAMP,
                last_seen_alive TIMESTAMP,
                missed_heartbeats INTEGER DEFAULT 0,
                reclaimed_at TIMESTAMP,
                work_state_json TEXT,
                recovery_attempted INTEGER DEFAULT 0
            )
        ''')

        # Heartbeat log table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS heartbeat_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vastai_id INTEGER NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT,
                response_time_ms INTEGER,
                error_message TEXT
            )
        ''')

        # State snapshots table (for work recovery)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS state_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vastai_id INTEGER NOT NULL,
                snapshot_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                work_type TEXT,
                progress_percent INTEGER,
                files_in_progress TEXT,
                metadata_json TEXT
            )
        ''')

        conn.commit()
        conn.close()

    def register_instance(self, vastai_id: int, instance_type: str, public_ip: str):
        """Register new instance"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT OR REPLACE INTO instances
            (vastai_id, instance_type, status, public_ip, last_heartbeat, last_seen_alive)
            VALUES (?, ?, 'running', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ''', (vastai_id, instance_type, public_ip))

        conn.commit()
        conn.close()

        # Also backup to Supabase
        supabase.table('vastai_instances').insert({
            'instance_id': vastai_id,
            'instance_type': instance_type,
            'status': 'running',
            'public_ip': public_ip,
            'deployed_at': datetime.now().isoformat()
        }).execute()

    def record_heartbeat(self, vastai_id: int, success: bool, response_time: int = None, error: str = None):
        """Record heartbeat attempt"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        if success:
            # Reset missed heartbeats, update last seen
            cursor.execute('''
                UPDATE instances
                SET last_heartbeat = CURRENT_TIMESTAMP,
                    last_seen_alive = CURRENT_TIMESTAMP,
                    missed_heartbeats = 0,
                    status = 'running'
                WHERE vastai_id = ?
            ''', (vastai_id,))
        else:
            # Increment missed heartbeats
            cursor.execute('''
                UPDATE instances
                SET last_heartbeat = CURRENT_TIMESTAMP,
                    missed_heartbeats = missed_heartbeats + 1
                WHERE vastai_id = ?
            ''', (vastai_id,))

        # Log heartbeat
        cursor.execute('''
            INSERT INTO heartbeat_log (vastai_id, status, response_time_ms, error_message)
            VALUES (?, ?, ?, ?)
        ''', (vastai_id, 'success' if success else 'failed', response_time, error))

        conn.commit()
        conn.close()

    def mark_reclaimed(self, vastai_id: int, reason: str = 'heartbeat_timeout'):
        """Mark instance as reclaimed/dead"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE instances
            SET status = 'reclaimed',
                reclaimed_at = CURRENT_TIMESTAMP
            WHERE vastai_id = ?
        ''', (vastai_id,))

        conn.commit()
        conn.close()

        # Update Supabase
        supabase.table('vastai_instances') \
            .update({
                'status': 'reclaimed',
                'reclaimed_at': datetime.now().isoformat(),
                'reclaim_reason': reason
            }) \
            .eq('instance_id', vastai_id) \
            .execute()

    def save_work_state(self, vastai_id: int, work_type: str, progress: int, files: List[str], metadata: Dict):
        """Save current work state for recovery"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO state_snapshots
            (vastai_id, work_type, progress_percent, files_in_progress, metadata_json)
            VALUES (?, ?, ?, ?, ?)
        ''', (vastai_id, work_type, progress, json.dumps(files), json.dumps(metadata)))

        # Also update instance record
        cursor.execute('''
            UPDATE instances
            SET work_state_json = ?
            WHERE vastai_id = ?
        ''', (json.dumps({
            'work_type': work_type,
            'progress': progress,
            'files': files,
            'metadata': metadata,
            'saved_at': datetime.now().isoformat()
        }), vastai_id))

        conn.commit()
        conn.close()

    def get_dead_instances(self) -> List[Dict]:
        """Get instances that exceeded heartbeat threshold"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT vastai_id, instance_type, missed_heartbeats, last_seen_alive, work_state_json
            FROM instances
            WHERE status = 'running'
            AND missed_heartbeats >= ?
        ''', (MISSED_HEARTBEATS_THRESHOLD,))

        results = cursor.fetchall()
        conn.close()

        return [
            {
                'vastai_id': row[0],
                'instance_type': row[1],
                'missed_heartbeats': row[2],
                'last_seen_alive': row[3],
                'work_state': json.loads(row[4]) if row[4] else None
            }
            for row in results
        ]


class InstanceMonitor:
    """Monitor instance health with heartbeats"""

    def __init__(self):
        self.state = InstanceState()

    def check_heartbeat(self, vastai_id: int, public_ip: str) -> bool:
        """
        Ping instance to check if alive
        Tries multiple methods to distinguish network issues from reclaim
        """
        start_time = time.time()

        # Method 1: SSH connection (most reliable)
        try:
            result = subprocess.run(
                ['ssh', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=no',
                 f'root@{public_ip}', 'echo alive'],
                capture_output=True,
                timeout=15
            )

            if result.returncode == 0:
                response_time = int((time.time() - start_time) * 1000)
                self.state.record_heartbeat(vastai_id, True, response_time)
                return True
        except subprocess.TimeoutExpired:
            pass
        except Exception as e:
            print(f"SSH heartbeat failed: {e}")

        # Method 2: HTTP check (if noVNC exposed)
        try:
            import requests
            response = requests.get(f'http://{public_ip}:6080', timeout=10)
            if response.status_code == 200:
                response_time = int((time.time() - start_time) * 1000)
                self.state.record_heartbeat(vastai_id, True, response_time)
                return True
        except:
            pass

        # Method 3: ICMP ping
        try:
            result = subprocess.run(
                ['ping', '-c', '1', '-W', '5', public_ip],
                capture_output=True,
                timeout=10
            )
            if result.returncode == 0:
                # Ping works but SSH/HTTP don't - network issue, not reclaim
                self.state.record_heartbeat(vastai_id, False, None, 'network_issue_ssh_failed')
                return False
        except:
            pass

        # All methods failed - likely reclaimed
        self.state.record_heartbeat(vastai_id, False, None, 'all_checks_failed')
        return False

    def handle_dead_instance(self, instance_info: Dict):
        """
        Handle instance that's been declared dead
        1. Mark as reclaimed
        2. Send webhook notification
        3. Attempt recovery if work in progress
        """
        vastai_id = instance_info['vastai_id']
        work_state = instance_info.get('work_state')

        print(f"⚠️  Instance {vastai_id} declared dead")
        print(f"   Last seen: {instance_info['last_seen_alive']}")
        print(f"   Missed heartbeats: {instance_info['missed_heartbeats']}")

        # Mark as reclaimed
        self.state.mark_reclaimed(vastai_id, 'heartbeat_timeout')

        # Send webhook notification
        self.send_webhook_notification(instance_info)

        # Attempt work recovery if applicable
        if work_state:
            self.attempt_work_recovery(instance_info)

    def send_webhook_notification(self, instance_info: Dict):
        """Send webhook to notification service (Telegram, Discord, etc.)"""
        try:
            # Send to Telegram (if configured)
            telegram_token = os.getenv('TELEGRAM_BOT_TOKEN')
            telegram_chat = os.getenv('TELEGRAM_ADMIN_CHAT_ID')

            if telegram_token and telegram_chat:
                import requests
                message = f"""
🔴 Vast.ai Instance Lost

Instance ID: {instance_info['vastai_id']}
Type: {instance_info['instance_type']}
Last Seen: {instance_info['last_seen_alive']}
Missed Heartbeats: {instance_info['missed_heartbeats']}

Status: Likely reclaimed by Vast.ai
                """

                requests.post(
                    f'https://api.telegram.org/bot{telegram_token}/sendMessage',
                    json={'chat_id': telegram_chat, 'text': message}
                )
        except Exception as e:
            print(f"Webhook notification failed: {e}")

    def attempt_work_recovery(self, instance_info: Dict):
        """
        Attempt to recover in-progress work
        1. Deploy new instance
        2. Restore state from snapshot
        3. Resume work
        """
        work_state = instance_info['work_state']
        print(f"🔄 Attempting work recovery...")
        print(f"   Work type: {work_state['work_type']}")
        print(f"   Progress: {work_state['progress']}%")

        # Deploy replacement instance
        instance_type = instance_info['instance_type']

        if instance_type == 'video-editor':
            new_instance_id = deployer.deploy_video_editor()
        elif instance_type == 'ai-services':
            new_instance_id = deployer.deploy_ai_services()
        elif instance_type == 'desktop-editor':
            new_instance_id = deployer.deploy_desktop_editor()

        if new_instance_id:
            print(f"✓ New instance deployed: {new_instance_id}")

            # TODO: Restore work state (implementation depends on work type)
            # For now, just log the state that needs restoration
            print(f"⚠️  Manual recovery needed. Work state saved to:")
            print(f"   {STATE_DB_PATH}")
        else:
            print(f"✗ Failed to deploy replacement instance")

    def monitor_loop(self):
        """Main monitoring loop"""
        print("Starting Vast.ai Instance Monitor")
        print(f"Heartbeat interval: {HEARTBEAT_INTERVAL}s")
        print(f"Missed heartbeat threshold: {MISSED_HEARTBEATS_THRESHOLD}")

        while True:
            try:
                # Get all running instances
                instances = deployer.list_instances()

                for instance in instances:
                    vastai_id = instance.get('id')
                    public_ip = instance.get('public_ipaddr')

                    if not public_ip:
                        continue

                    # Check heartbeat
                    alive = self.check_heartbeat(vastai_id, public_ip)

                    if alive:
                        print(f"✓ Instance {vastai_id} alive ({public_ip})")
                    else:
                        print(f"✗ Instance {vastai_id} heartbeat failed ({public_ip})")

                # Check for dead instances
                dead_instances = self.state.get_dead_instances()
                for dead in dead_instances:
                    self.handle_dead_instance(dead)

                # Sleep before next check
                time.sleep(HEARTBEAT_INTERVAL)

            except KeyboardInterrupt:
                print("\nShutting down monitor...")
                break
            except Exception as e:
                print(f"Error in monitor loop: {e}")
                time.sleep(HEARTBEAT_INTERVAL)


def main():
    monitor = InstanceMonitor()
    monitor.monitor_loop()


if __name__ == '__main__':
    main()
