#!/usr/bin/env python3
"""
Video processing utilities for ASI 360
"""

import subprocess
from pathlib import Path

def get_video_info(file_path: str) -> dict:
    """Get video metadata using ffprobe"""
    cmd = [
        'ffprobe',
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        file_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    import json
    return json.loads(result.stdout)

def create_thumbnail(video_path: str, output_path: str, timestamp: str = '00:00:01') -> bool:
    """Extract a thumbnail from video at specific timestamp"""
    cmd = [
        'ffmpeg',
        '-i', video_path,
        '-ss', timestamp,
        '-vframes', '1',
        '-q:v', '2',
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True)
    return result.returncode == 0

def batch_process(input_dir: str, output_dir: str, operation: str, **kwargs):
    """Process all videos in a directory"""
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True, parents=True)

    for video_file in input_path.glob('*.mp4'):
        output_file = output_path / video_file.name
        print(f"Processing: {video_file.name}")
        # Add processing logic here based on operation
