#!/usr/bin/env python3
"""
Blender automation utilities
"""

import subprocess
from pathlib import Path

def render_single_frame(blend_file: str, output_path: str, frame: int):
    """Render a single frame from Blender file"""
    cmd = [
        'blender',
        '--background',
        blend_file,
        '--render-output', output_path,
        '--render-format', 'PNG',
        '--render-frame', str(frame)
    ]
    result = subprocess.run(cmd, capture_output=True)
    return result.returncode == 0

def render_animation(blend_file: str, output_dir: str, start_frame: int = 1, end_frame: int = 250):
    """Render full animation"""
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True, parents=True)

    cmd = [
        'blender',
        '--background',
        blend_file,
        '--render-output', str(output_path / 'frame_'),
        '--render-format', 'PNG',
        '--render-frame', f'{start_frame}..{end_frame}'
    ]

    result = subprocess.run(cmd)
    return result.returncode == 0
