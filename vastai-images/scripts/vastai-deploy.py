#!/usr/bin/env python3
"""
ASI 360 Vast.ai Deployment Manager
Finds cheapest GPU instances and deploys Docker containers
"""

import subprocess
import json
import os
import sys
from typing import Optional, List, Dict
from datetime import datetime

class VastAIDeployer:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('VASTAI_API_KEY')
        if not self.api_key:
            print("Warning: VASTAI_API_KEY not set. Some operations may fail.")

    def run_command(self, cmd: List[str]) -> Dict:
        """Run vastai CLI command and return parsed JSON output"""
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return json.loads(result.stdout) if result.stdout else {}
        except subprocess.CalledProcessError as e:
            print(f"Error running command: {e}")
            print(f"stderr: {e.stderr}")
            return {}
        except json.JSONDecodeError:
            print(f"Failed to parse JSON output")
            return {}

    def search_offers(self, min_gpu_ram: int = 16, max_price: float = 0.50, gpu_name: Optional[str] = None) -> List[Dict]:
        """Search for available GPU offers"""
        query = f"gpu_ram>={min_gpu_ram} dph<{max_price}"

        if gpu_name:
            query += f" gpu_name={gpu_name}"

        cmd = [
            'vastai', 'search', 'offers',
            query,
            '--order', 'dph_total',  # Sort by price
            '--raw'
        ]

        print(f"Searching for GPUs: {query}")
        offers = self.run_command(cmd)

        if isinstance(offers, list):
            # Filter and sort offers
            filtered_offers = [
                o for o in offers
                if o.get('gpu_ram', 0) >= min_gpu_ram
                and o.get('dph_total', 999) <= max_price
                and o.get('rentable', False)
            ]
            return sorted(filtered_offers, key=lambda x: x.get('dph_total', 999))[:5]

        return []

    def create_instance(self, offer_id: int, image: str, disk_space: int = 50, env_vars: Optional[Dict] = None) -> Optional[int]:
        """Create a new Vast.ai instance"""
        cmd = [
            'vastai', 'create', 'instance',
            str(offer_id),
            '--image', image,
            '--disk', str(disk_space)
        ]

        # Add environment variables
        if env_vars:
            for key, value in env_vars.items():
                cmd.extend(['--env', f'{key}={value}'])

        print(f"Creating instance with image: {image}")
        print(f"Command: {' '.join(cmd)}")

        result = self.run_command(cmd)

        if result and 'new_contract' in result:
            instance_id = result['new_contract']
            print(f"✓ Instance created: {instance_id}")
            return instance_id

        print("✗ Failed to create instance")
        return None

    def list_instances(self) -> List[Dict]:
        """List all active instances"""
        result = self.run_command(['vastai', 'show', 'instances', '--raw'])
        return result if isinstance(result, list) else []

    def destroy_instance(self, instance_id: int) -> bool:
        """Destroy an instance"""
        print(f"Destroying instance {instance_id}...")
        result = self.run_command(['vastai', 'destroy', 'instance', str(instance_id)])
        return result.get('success', False)

    def get_instance_status(self, instance_id: int) -> Optional[Dict]:
        """Get status of a specific instance"""
        instances = self.list_instances()
        for inst in instances:
            if inst.get('id') == instance_id:
                return inst
        return None

    def deploy_video_editor(self, max_price: float = 0.50) -> Optional[int]:
        """Deploy video editor container"""
        offers = self.search_offers(min_gpu_ram=16, max_price=max_price)

        if not offers:
            print("No suitable GPU offers found")
            return None

        best_offer = offers[0]
        print(f"\nBest offer:")
        print(f"  GPU: {best_offer.get('gpu_name', 'Unknown')}")
        print(f"  RAM: {best_offer.get('gpu_ram', 0)} GB")
        print(f"  Price: ${best_offer.get('dph_total', 0):.4f}/hour")

        env_vars = {
            'SUPABASE_URL': os.getenv('SUPABASE_URL', ''),
            'SUPABASE_KEY': os.getenv('SUPABASE_KEY', ''),
            'RCLONE_REMOTE': 'gdrive'
        }

        return self.create_instance(
            offer_id=best_offer['id'],
            image='asi360/video-editor:latest',
            disk_space=100,
            env_vars=env_vars
        )

    def deploy_ai_services(self, max_price: float = 0.60) -> Optional[int]:
        """Deploy AI services container"""
        # AI services need more powerful GPU for Stable Diffusion
        offers = self.search_offers(min_gpu_ram=24, max_price=max_price, gpu_name="RTX")

        if not offers:
            print("No suitable GPU offers found for AI services")
            return None

        best_offer = offers[0]
        print(f"\nBest offer for AI services:")
        print(f"  GPU: {best_offer.get('gpu_name', 'Unknown')}")
        print(f"  RAM: {best_offer.get('gpu_ram', 0)} GB")
        print(f"  Price: ${best_offer.get('dph_total', 0):.4f}/hour")

        env_vars = {
            'ANTHROPIC_API_KEY': os.getenv('ANTHROPIC_API_KEY', ''),
            'SUPABASE_URL': os.getenv('SUPABASE_URL', ''),
            'SUPABASE_KEY': os.getenv('SUPABASE_KEY', '')
        }

        return self.create_instance(
            offer_id=best_offer['id'],
            image='asi360/ai-services:latest',
            disk_space=150,  # Larger for AI models
            env_vars=env_vars
        )

    def deploy_desktop_editor(self, max_price: float = 0.60) -> Optional[int]:
        """Deploy interactive desktop editor with VNC"""
        offers = self.search_offers(min_gpu_ram=16, max_price=max_price)

        if not offers:
            print("No suitable GPU offers found for desktop editor")
            return None

        best_offer = offers[0]
        print(f"\nBest offer for desktop editor:")
        print(f"  GPU: {best_offer.get('gpu_name', 'Unknown')}")
        print(f"  RAM: {best_offer.get('gpu_ram', 0)} GB")
        print(f"  Price: ${best_offer.get('dph_total', 0):.4f}/hour")

        env_vars = {
            'VNC_PASSWORD': 'asi360secure',
            'RESOLUTION': '1920x1080'
        }

        instance_id = self.create_instance(
            offer_id=best_offer['id'],
            image='asi360/desktop-editor:latest',
            disk_space=100,
            env_vars=env_vars
        )

        if instance_id:
            # Get instance info to show connection details
            import time
            time.sleep(5)  # Wait for instance to start
            instance = self.get_instance_status(instance_id)
            if instance and instance.get('public_ipaddr'):
                ip = instance['public_ipaddr']
                print(f"\n" + "="*60)
                print(f"Desktop Editor Connection Info:")
                print(f"="*60)
                print(f"\nBrowser Access (noVNC):")
                print(f"  http://{ip}:6080")
                print(f"\nVNC Client:")
                print(f"  vnc://{ip}:5900")
                print(f"  Password: asi360secure")
                print(f"\nParsec (best performance):")
                print(f"  ssh root@{ip}")
                print(f"  parsec")
                print(f"\n" + "="*60)

        return instance_id


def main():
    """CLI interface"""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 vastai-deploy.py search [--gpu-ram 16] [--max-price 0.50]")
        print("  python3 vastai-deploy.py deploy-video-editor")
        print("  python3 vastai-deploy.py deploy-ai-services")
        print("  python3 vastai-deploy.py deploy-desktop-editor")
        print("  python3 vastai-deploy.py list")
        print("  python3 vastai-deploy.py destroy <instance_id>")
        sys.exit(1)

    deployer = VastAIDeployer()
    command = sys.argv[1]

    if command == 'search':
        gpu_ram = int(sys.argv[2]) if len(sys.argv) > 2 else 16
        max_price = float(sys.argv[3]) if len(sys.argv) > 3 else 0.50
        offers = deployer.search_offers(min_gpu_ram=gpu_ram, max_price=max_price)

        print(f"\nFound {len(offers)} suitable offers:\n")
        for i, offer in enumerate(offers[:5], 1):
            print(f"{i}. {offer.get('gpu_name', 'Unknown')} - {offer.get('gpu_ram', 0)}GB RAM - ${offer.get('dph_total', 0):.4f}/hr")

    elif command == 'deploy-video-editor':
        instance_id = deployer.deploy_video_editor()
        if instance_id:
            print(f"\n✓ Video editor deployed successfully!")
            print(f"  Instance ID: {instance_id}")

    elif command == 'deploy-ai-services':
        instance_id = deployer.deploy_ai_services()
        if instance_id:
            print(f"\n✓ AI services deployed successfully!")
            print(f"  Instance ID: {instance_id}")

    elif command == 'deploy-desktop-editor':
        instance_id = deployer.deploy_desktop_editor()
        if instance_id:
            print(f"\n✓ Desktop editor deployed successfully!")

    elif command == 'list':
        instances = deployer.list_instances()
        if instances:
            print(f"\nActive instances ({len(instances)}):\n")
            for inst in instances:
                print(f"  ID: {inst.get('id')} - {inst.get('image_name', 'Unknown')} - {inst.get('status_msg', 'Unknown')}")
        else:
            print("No active instances")

    elif command == 'destroy':
        if len(sys.argv) < 3:
            print("Usage: python3 vastai-deploy.py destroy <instance_id>")
            sys.exit(1)

        instance_id = int(sys.argv[2])
        if deployer.destroy_instance(instance_id):
            print(f"✓ Instance {instance_id} destroyed")
        else:
            print(f"✗ Failed to destroy instance {instance_id}")

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == '__main__':
    main()
