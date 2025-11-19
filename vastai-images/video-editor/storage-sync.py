#!/usr/bin/env python3
"""
Cloud storage synchronization for ASI 360 Vast.ai instances
Manages rclone mounts and syncs
"""

import os
import subprocess
from pathlib import Path

def setup_rclone_config(remote_name: str, remote_type: str = 'gdrive'):
    """Setup rclone configuration for cloud storage"""
    config_path = Path.home() / '.config' / 'rclone' / 'rclone.conf'
    config_path.parent.mkdir(parents=True, exist_ok=True)

    if remote_type == 'gdrive':
        # Google Drive configuration
        # Note: This requires manual OAuth flow first time
        print(f"To configure Google Drive, run:")
        print(f"rclone config create {remote_name} drive")
    elif remote_type == 's3':
        # S3 configuration
        aws_access_key = os.getenv('AWS_ACCESS_KEY')
        aws_secret_key = os.getenv('AWS_SECRET_KEY')
        print(f"To configure S3, run:")
        print(f"rclone config create {remote_name} s3 provider=AWS access_key_id={aws_access_key} secret_access_key={aws_secret_key}")

def mount_storage(remote_name: str, mount_point: str = '/storage'):
    """Mount cloud storage using rclone"""
    mount_path = Path(mount_point)
    mount_path.mkdir(exist_ok=True, parents=True)

    cmd = [
        'rclone', 'mount',
        f'{remote_name}:',
        str(mount_path),
        '--daemon',
        '--vfs-cache-mode', 'writes',
        '--allow-other'
    ]

    result = subprocess.run(cmd)
    return result.returncode == 0

def sync_directory(local_path: str, remote_path: str, direction: str = 'to_remote'):
    """Sync directory with cloud storage"""
    if direction == 'to_remote':
        cmd = ['rclone', 'sync', local_path, remote_path, '-v']
    else:
        cmd = ['rclone', 'sync', remote_path, local_path, '-v']

    result = subprocess.run(cmd)
    return result.returncode == 0

if __name__ == '__main__':
    # Example usage
    remote_name = os.getenv('RCLONE_REMOTE', 'gdrive')
    mount_storage(remote_name, '/storage')
