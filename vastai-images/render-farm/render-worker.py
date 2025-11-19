#!/usr/bin/env python3
"""
Celery worker for render farm jobs
"""

from celery import Celery
import subprocess
import os

app = Celery('render-worker', broker=os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0'))

@app.task
def render_blender_project(project_file: str, output_path: str, frame_start: int = 1, frame_end: int = 250):
    """Render a Blender project"""
    cmd = [
        'blender',
        '--background',
        project_file,
        '--render-output', output_path,
        '--render-format', 'PNG',
        '--render-frame', f'{frame_start}..{frame_end}',
        '--engine', 'CYCLES'
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    return {
        'success': result.returncode == 0,
        'output': result.stdout,
        'error': result.stderr if result.returncode != 0 else None
    }

@app.task
def convert_video(input_path: str, output_path: str, codec: str = 'libx264'):
    """Convert video format"""
    cmd = [
        'ffmpeg',
        '-i', input_path,
        '-c:v', codec,
        '-preset', 'medium',
        '-crf', '23',
        output_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    return {
        'success': result.returncode == 0,
        'output_file': output_path if result.returncode == 0 else None
    }
