#!/usr/bin/env python3
"""
ASI 360 Render Queue Processor
Monitors Supabase for video processing jobs and executes them using FFmpeg
"""

import os
import time
import json
import subprocess
from datetime import datetime
from supabase import create_client, Client
from pathlib import Path

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
POLL_INTERVAL = 10  # seconds

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def log(message: str):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {message}")

def download_from_storage(file_url: str, local_path: str) -> bool:
    """Download file from cloud storage"""
    try:
        # If using Supabase storage
        if 'supabase' in file_url:
            # Extract bucket and path
            parts = file_url.split('/')
            bucket = parts[-2]
            file_path = parts[-1]

            # Download file
            response = supabase.storage.from_(bucket).download(file_path)

            with open(local_path, 'wb') as f:
                f.write(response)

            log(f"Downloaded: {file_path}")
            return True
        else:
            # Use rclone for other storage
            cmd = f"rclone copy {file_url} {local_path}"
            subprocess.run(cmd, shell=True, check=True)
            log(f"Downloaded: {file_url}")
            return True
    except Exception as e:
        log(f"Download error: {e}")
        return False

def upload_to_storage(local_path: str, dest_url: str) -> bool:
    """Upload processed file to cloud storage"""
    try:
        if 'supabase' in dest_url:
            # Extract bucket and path
            parts = dest_url.split('/')
            bucket = parts[-2]
            file_path = parts[-1]

            with open(local_path, 'rb') as f:
                supabase.storage.from_(bucket).upload(file_path, f)

            log(f"Uploaded: {file_path}")
            return True
        else:
            # Use rclone for other storage
            cmd = f"rclone copy {local_path} {dest_url}"
            subprocess.run(cmd, shell=True, check=True)
            log(f"Uploaded: {dest_url}")
            return True
    except Exception as e:
        log(f"Upload error: {e}")
        return False

def process_video(job: dict) -> bool:
    """Process video based on job parameters"""
    try:
        job_id = job['id']
        input_url = job['input_url']
        output_url = job['output_url']
        operation = job['operation']
        params = job.get('parameters', {})

        # Create temp directories
        input_dir = Path('/input')
        output_dir = Path('/output')
        input_dir.mkdir(exist_ok=True)
        output_dir.mkdir(exist_ok=True)

        # Download input file
        input_file = input_dir / f"input_{job_id}.mp4"
        if not download_from_storage(input_url, str(input_file)):
            return False

        # Build FFmpeg command based on operation
        output_file = output_dir / f"output_{job_id}.mp4"

        if operation == 'compress':
            bitrate = params.get('bitrate', '2M')
            cmd = [
                'ffmpeg', '-i', str(input_file),
                '-b:v', bitrate,
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-c:a', 'aac',
                '-b:a', '128k',
                str(output_file)
            ]

        elif operation == 'trim':
            start_time = params.get('start_time', '0')
            duration = params.get('duration', '10')
            cmd = [
                'ffmpeg', '-i', str(input_file),
                '-ss', start_time,
                '-t', duration,
                '-c', 'copy',
                str(output_file)
            ]

        elif operation == 'resize':
            width = params.get('width', '1280')
            height = params.get('height', '720')
            cmd = [
                'ffmpeg', '-i', str(input_file),
                '-vf', f'scale={width}:{height}',
                '-c:a', 'copy',
                str(output_file)
            ]

        elif operation == 'extract_audio':
            cmd = [
                'ffmpeg', '-i', str(input_file),
                '-vn',
                '-acodec', 'libmp3lame',
                '-ab', '192k',
                str(output_file).replace('.mp4', '.mp3')
            ]
            output_file = Path(str(output_file).replace('.mp4', '.mp3'))

        else:
            log(f"Unknown operation: {operation}")
            return False

        # Execute FFmpeg
        log(f"Processing job {job_id}: {operation}")
        log(f"Command: {' '.join(cmd)}")

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            log(f"FFmpeg error: {result.stderr}")
            return False

        # Upload output file
        if not upload_to_storage(str(output_file), output_url):
            return False

        # Clean up
        input_file.unlink()
        output_file.unlink()

        log(f"Job {job_id} completed successfully")
        return True

    except Exception as e:
        log(f"Processing error: {e}")
        return False

def main():
    """Main processing loop"""
    log("Starting ASI 360 Render Queue Processor")
    log(f"Supabase URL: {SUPABASE_URL}")
    log(f"Poll interval: {POLL_INTERVAL}s")

    while True:
        try:
            # Query for pending jobs
            response = supabase.table('render_jobs') \
                .select('*') \
                .eq('status', 'pending') \
                .order('created_at', desc=False) \
                .limit(1) \
                .execute()

            if response.data:
                job = response.data[0]
                job_id = job['id']

                # Mark job as processing
                supabase.table('render_jobs') \
                    .update({'status': 'processing', 'started_at': datetime.now().isoformat()}) \
                    .eq('id', job_id) \
                    .execute()

                # Process the job
                success = process_video(job)

                # Update job status
                if success:
                    supabase.table('render_jobs') \
                        .update({
                            'status': 'completed',
                            'completed_at': datetime.now().isoformat()
                        }) \
                        .eq('id', job_id) \
                        .execute()
                else:
                    supabase.table('render_jobs') \
                        .update({
                            'status': 'failed',
                            'failed_at': datetime.now().isoformat()
                        }) \
                        .eq('id', job_id) \
                        .execute()
            else:
                # No jobs pending, wait
                time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            log("Shutting down gracefully")
            break
        except Exception as e:
            log(f"Error in main loop: {e}")
            time.sleep(POLL_INTERVAL)

if __name__ == '__main__':
    main()
