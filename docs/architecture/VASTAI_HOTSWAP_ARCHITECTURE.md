# ASI 360 - Hot-Swappable Vast.ai Docker Integration

**Portable GPU instances that can deploy to Vast.ai for video editing, AI services, and compute-intensive tasks**

---

## 🎯 Architecture Overview

The key insight: **Create Docker images locally that can be pushed to Docker Hub and instantly deployed on Vast.ai GPU instances.**

```
┌─────────────────────────────────────────────────────────────┐
│           LOCAL DEVELOPMENT (Mac Mini)                      │
│  • Build Docker images                                      │
│  • Test locally                                             │
│  • Push to Docker Hub                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ docker push
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           DOCKER HUB (Image Registry)                       │
│  • asi360/video-editor:latest                              │
│  • asi360/ai-services:latest                               │
│  • asi360/render-farm:latest                               │
└────────────────────┬────────────────────────────────────────┘
                     │
      ┌──────────────┴──────────────┐
      │                             │
      ▼                             ▼
┌──────────────────┐      ┌──────────────────┐
│  VAST.AI GPU #1  │      │  VAST.AI GPU #2  │
│  docker pull     │      │  docker pull     │
│  RTX 4090        │      │  A100            │
│  $0.40/hr        │      │  $1.20/hr        │
└────────┬─────────┘      └────────┬─────────┘
         │                         │
         │ Mount cloud storage     │
         │                         │
         ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│           CLOUD STORAGE (Google Drive / S3)                 │
│  • Project files                                            │
│  • Media assets                                             │
│  • Render outputs                                           │
│  • Shared across all instances                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🐳 Hot-Swappable Docker Images

### 1. Video Editing Container

**File: `~/Projects/asi360-agency/vastai-images/video-editor/Dockerfile`**

```dockerfile
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Install base dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    wget \
    curl \
    fuse \
    rclone \
    && rm -rf /var/lib/apt/lists/*

# Install Python video processing libraries
RUN pip3 install \
    opencv-python \
    moviepy \
    Pillow \
    boto3 \
    google-api-python-client \
    anthropic

# Install Parsec for remote desktop (optional)
RUN wget https://builds.parsec.app/package/parsec-linux.deb && \
    dpkg -i parsec-linux.deb || apt-get install -f -y && \
    rm parsec-linux.deb

# Create working directory
WORKDIR /workspace

# Mount point for cloud storage
VOLUME ["/storage"]

# Copy automation scripts
COPY scripts/ /workspace/scripts/
COPY render-queue.py /workspace/

# Entry point
CMD ["python3", "/workspace/render-queue.py"]
```

**Build and push:**
```bash
cd ~/Projects/asi360-agency/vastai-images/video-editor
docker build -t asi360/video-editor:latest .
docker push asi360/video-editor:latest
```

---

### 2. AI Services Container (Claude, Stable Diffusion, etc.)

**File: `~/Projects/asi360-agency/vastai-images/ai-services/Dockerfile`**

```dockerfile
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

# Install dependencies
RUN pip install \
    anthropic \
    openai \
    diffusers \
    transformers \
    accelerate \
    torch \
    torchvision \
    fastapi \
    uvicorn \
    rclone

# Install Stable Diffusion WebUI (optional)
WORKDIR /workspace
RUN git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git

# API server for job processing
COPY ai-api-server.py /workspace/
COPY requirements.txt /workspace/

EXPOSE 8000

CMD ["uvicorn", "ai-api-server:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### 3. Render Farm Container (Batch Processing)

**File: `~/Projects/asi360-agency/vastai-images/render-farm/Dockerfile`**

```dockerfile
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Install rendering tools
RUN apt-get update && apt-get install -y \
    blender \
    ffmpeg \
    imagemagick \
    python3 \
    python3-pip \
    rclone

# Install Python processing libraries
RUN pip3 install \
    celery \
    redis \
    boto3 \
    anthropic

WORKDIR /workspace

# Render worker script
COPY render-worker.py /workspace/
COPY celery-config.py /workspace/

CMD ["celery", "-A", "render-worker", "worker", "--loglevel=info"]
```

---

## 🔄 Hot-Swap Deployment Flow

### Step 1: Build Images Locally

```bash
cd ~/Projects/asi360-agency/vastai-images

# Build all images
docker build -t asi360/video-editor:latest ./video-editor
docker build -t asi360/ai-services:latest ./ai-services
docker build -t asi360/render-farm:latest ./render-farm

# Push to Docker Hub
docker push asi360/video-editor:latest
docker push asi360/ai-services:latest
docker push asi360/render-farm:latest
```

### Step 2: Deploy to Vast.ai (Automated)

**File: `~/Projects/asi360-agency/scripts/vastai-deploy.py`**

```python
#!/usr/bin/env python3
"""
Hot-swap deployment to Vast.ai GPU instances
Automatically finds cheapest GPU, deploys Docker image, mounts storage
"""

import subprocess
import json
import time
from typing import Optional

class VastAIHotSwap:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def find_cheapest_gpu(self, min_gpu_ram: int = 16, max_price: float = 0.50):
        """Find cheapest available GPU instance"""
        cmd = f'vastai search offers "gpu_ram>={min_gpu_ram} dph<{max_price}" --raw'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

        offers = json.loads(result.stdout)

        # Sort by price
        offers.sort(key=lambda x: x['dph_total'])

        return offers[0] if offers else None

    def deploy_container(self,
                        image: str,
                        offer_id: int,
                        disk_space: int = 50,
                        env_vars: dict = None):
        """
        Deploy Docker container to Vast.ai instance

        Args:
            image: Docker image (e.g., "asi360/video-editor:latest")
            offer_id: Vast.ai offer ID
            disk_space: Disk space in GB
            env_vars: Environment variables dict
        """

        # Build env string
        env_string = ""
        if env_vars:
            env_string = " ".join([f"-e {k}={v}" for k, v in env_vars.items()])

        # Create instance
        cmd = f"""vastai create instance {offer_id} \
            --image {image} \
            --disk {disk_space} \
            {env_string} \
            --ssh
        """

        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

        # Parse instance ID
        instance_id = self._parse_instance_id(result.stdout)

        print(f"✅ Instance {instance_id} created")
        print(f"   Image: {image}")
        print(f"   Waiting for instance to start...")

        # Wait for instance to be running
        self.wait_for_instance(instance_id)

        # Mount cloud storage
        self.mount_storage(instance_id)

        return instance_id

    def mount_storage(self, instance_id: int):
        """Mount Google Drive or S3 to instance"""

        # Get instance SSH info
        cmd = f"vastai show instance {instance_id}"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        instance_info = json.loads(result.stdout)

        ssh_host = instance_info['ssh_host']
        ssh_port = instance_info['ssh_port']

        # SSH and configure rclone
        mount_script = """
        rclone config create gdrive drive
        mkdir -p /storage
        rclone mount gdrive: /storage --daemon --vfs-cache-mode writes
        """

        ssh_cmd = f'ssh -p {ssh_port} root@{ssh_host} "{mount_script}"'
        subprocess.run(ssh_cmd, shell=True)

        print(f"✅ Cloud storage mounted to /storage")

    def wait_for_instance(self, instance_id: int, timeout: int = 300):
        """Wait for instance to be running"""
        start = time.time()

        while time.time() - start < timeout:
            cmd = f"vastai show instance {instance_id}"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

            try:
                info = json.loads(result.stdout)
                if info['actual_status'] == 'running':
                    return True
            except:
                pass

            time.sleep(5)

        raise TimeoutError(f"Instance {instance_id} failed to start")

    def destroy_instance(self, instance_id: int):
        """Terminate instance to stop billing"""
        cmd = f"vastai destroy instance {instance_id}"
        subprocess.run(cmd, shell=True)
        print(f"✅ Instance {instance_id} destroyed")

    def _parse_instance_id(self, output: str) -> int:
        """Parse instance ID from vastai output"""
        import re
        match = re.search(r'instance (\d+)', output)
        return int(match.group(1)) if match else None


# Usage example
if __name__ == "__main__":
    import os

    vastai = VastAIHotSwap(api_key=os.getenv('VASTAI_API_KEY'))

    # Deploy video editor
    instance_id = vastai.deploy_container(
        image="asi360/video-editor:latest",
        offer_id=None,  # Will auto-find cheapest
        disk_space=100,
        env_vars={
            'ANTHROPIC_API_KEY': os.getenv('ANTHROPIC_API_KEY'),
            'SUPABASE_URL': os.getenv('SUPABASE_URL'),
            'SUPABASE_KEY': os.getenv('SUPABASE_KEY')
        }
    )

    print(f"""
    ✅ GPU Instance Ready!

    Instance ID: {instance_id}

    Connect via:
    - Parsec: Open Parsec app, connect to instance
    - SSH: vastai ssh instance {instance_id}
    - API: http://<instance-ip>:8000

    Storage mounted at: /storage

    To destroy: python3 vastai-deploy.py --destroy {instance_id}
    """)
```

---

## 🔥 Hot-Swap Use Cases

### Use Case 1: Video Editing Project

```bash
# 1. Start GPU instance with video editor
python3 scripts/vastai-deploy.py \
    --image asi360/video-editor:latest \
    --max-price 0.50 \
    --gpu-ram 24

# 2. Connect via Parsec from Mac Mini or Surface Pro

# 3. Edit videos using Premiere Pro / DaVinci Resolve
# Files are on /storage (Google Drive mounted)

# 4. Export renders back to /storage

# 5. Destroy instance when done (stop billing)
python3 scripts/vastai-deploy.py --destroy <instance-id>
```

**Cost:** $0.40/hr × 2 hours = $0.80 per project

---

### Use Case 2: Batch AI Image Generation

```bash
# Deploy AI services container
python3 scripts/vastai-deploy.py \
    --image asi360/ai-services:latest \
    --max-price 0.60 \
    --gpu-ram 16

# Generate 100 images via API
curl -X POST http://<instance-ip>:8000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Professional website hero image for law firm",
    "count": 100,
    "model": "stable-diffusion-xl"
  }'

# Images saved to /storage/outputs/

# Destroy when complete
vastai destroy instance <instance-id>
```

**Cost:** $0.50/hr × 0.5 hours = $0.25 for 100 images

---

### Use Case 3: Programmatic Video Processing

**Scenario:** Client needs 50 videos processed (add intro/outro, compress, add watermark)

**File: `~/Projects/asi360-agency/vastai-images/video-editor/scripts/batch-process.py`**

```python
#!/usr/bin/env python3
"""
Batch video processing on Vast.ai GPU
Watches Supabase queue for video processing jobs
"""

from supabase import create_client
import subprocess
import os
import time

class VideoProcessor:
    def __init__(self):
        self.supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_KEY')
        )
        self.storage_path = '/storage'

    def watch_queue(self):
        """Watch Supabase for video processing jobs"""
        while True:
            # Get pending jobs
            jobs = self.supabase.table('video_jobs')\
                .select('*')\
                .eq('status', 'pending')\
                .limit(1)\
                .execute()

            if jobs.data:
                job = jobs.data[0]
                self.process_job(job)
            else:
                time.sleep(5)

    def process_job(self, job: dict):
        """Process single video job"""
        job_id = job['id']
        input_file = f"{self.storage_path}/{job['input_path']}"
        output_file = f"{self.storage_path}/{job['output_path']}"

        # Mark as processing
        self.supabase.table('video_jobs')\
            .update({'status': 'processing'})\
            .eq('id', job_id)\
            .execute()

        try:
            # Process video with ffmpeg
            if job['task'] == 'add_intro':
                self.add_intro(input_file, output_file, job['intro_path'])
            elif job['task'] == 'compress':
                self.compress_video(input_file, output_file)
            elif job['task'] == 'watermark':
                self.add_watermark(input_file, output_file, job['watermark_text'])

            # Mark as complete
            self.supabase.table('video_jobs')\
                .update({'status': 'completed'})\
                .eq('id', job_id)\
                .execute()

            print(f"✅ Job {job_id} completed")

        except Exception as e:
            # Mark as failed
            self.supabase.table('video_jobs')\
                .update({'status': 'failed', 'error': str(e)})\
                .eq('id', job_id)\
                .execute()

            print(f"❌ Job {job_id} failed: {e}")

    def add_intro(self, input_file: str, output_file: str, intro_file: str):
        """Add intro video to beginning"""
        cmd = f"""ffmpeg -i {intro_file} -i {input_file} \
            -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]" \
            -map "[v]" -map "[a]" {output_file}"""
        subprocess.run(cmd, shell=True, check=True)

    def compress_video(self, input_file: str, output_file: str):
        """Compress video for web"""
        cmd = f"""ffmpeg -i {input_file} \
            -c:v libx264 -preset slow -crf 23 \
            -c:a aac -b:a 128k \
            {output_file}"""
        subprocess.run(cmd, shell=True, check=True)

    def add_watermark(self, input_file: str, output_file: str, text: str):
        """Add text watermark"""
        cmd = f"""ffmpeg -i {input_file} \
            -vf "drawtext=text='{text}':fontsize=24:fontcolor=white:x=10:y=10" \
            {output_file}"""
        subprocess.run(cmd, shell=True, check=True)


if __name__ == "__main__":
    processor = VideoProcessor()
    processor.watch_queue()
```

**Deploy:**
```bash
# Start video processor watching Supabase queue
python3 scripts/vastai-deploy.py \
    --image asi360/video-editor:latest \
    --command "python3 /workspace/scripts/batch-process.py"

# Add jobs to Supabase from ASI360-Agency droplet
python3 scripts/queue-video-job.py \
    --task compress \
    --input client-videos/raw/video1.mp4 \
    --output client-videos/processed/video1_compressed.mp4

# Instance processes jobs automatically
# Destroys itself when queue is empty (optional)
```

---

## 🔄 Integration with ASI360-Agency Droplet

### Deploy Job Queue Manager on Droplet

**File: `~/Projects/asi360-agency/automation/vastai-manager.py`**

```python
#!/usr/bin/env python3
"""
Vast.ai Instance Manager
Runs on ASI360-Agency droplet (104.248.69.86)
Automatically spins up/down GPU instances based on job queue
"""

from supabase import create_client
import os
import time
from vastai_deploy import VastAIHotSwap

class VastAIManager:
    def __init__(self):
        self.supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_KEY')
        )
        self.vastai = VastAIHotSwap(os.getenv('VASTAI_API_KEY'))
        self.active_instances = {}

    def monitor_queue(self):
        """Monitor job queue and auto-scale Vast.ai instances"""
        while True:
            # Check pending jobs
            pending = self.supabase.table('video_jobs')\
                .select('count')\
                .eq('status', 'pending')\
                .execute()

            pending_count = pending.data[0]['count']

            # If jobs pending and no active instance, spin one up
            if pending_count > 0 and len(self.active_instances) == 0:
                print(f"📊 {pending_count} jobs pending, starting GPU instance...")
                instance_id = self.vastai.deploy_container(
                    image="asi360/video-editor:latest",
                    offer_id=None,  # Auto-find cheapest
                    disk_space=100
                )
                self.active_instances[instance_id] = time.time()

            # If no jobs for 10 minutes, shut down instances
            if pending_count == 0:
                for instance_id, start_time in list(self.active_instances.items()):
                    idle_time = time.time() - start_time
                    if idle_time > 600:  # 10 minutes idle
                        print(f"💤 No jobs for 10 min, destroying instance {instance_id}")
                        self.vastai.destroy_instance(instance_id)
                        del self.active_instances[instance_id]

            time.sleep(30)  # Check every 30 seconds

if __name__ == "__main__":
    manager = VastAIManager()
    manager.monitor_queue()
```

**Deploy on ASI360-Agency droplet:**
```bash
# SSH to droplet
ssh root@104.248.69.86

# Run manager in background
nohup python3 automation/vastai-manager.py > /tmp/vastai-manager.log 2>&1 &
```

---

## 💰 Cost Analysis

### Scenario: 100 Client Websites with Video Needs

**Traditional Approach:**
- Dedicated GPU server: $500/mo (always on)
- Or local workstation: $3,000 upfront

**Hot-Swap Vast.ai Approach:**
- Average 10 hours/week video work
- RTX 4090: $0.40/hr
- **Monthly cost: $16/mo** (10 hrs/week × 4 weeks × $0.40)

**Savings: $484/month (97%)**

---

## 🎯 Docker Compose Integration

Add Vast.ai manager to `docker-compose.yml` on ASI360-Agency droplet:

```yaml
  vastai_manager:
    build: ./vastai-manager
    container_name: asi360_vastai_manager
    restart: unless-stopped
    environment:
      VASTAI_API_KEY: ${VASTAI_API_KEY}
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_KEY: ${SUPABASE_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./vastai-scripts:/app/scripts
    networks:
      - asi360_network
```

---

## ✅ Summary: Hot-Swappable Architecture

**Yes, this architecture supports hot-swappable Vast.ai instances:**

1. ✅ **Docker images** built locally, pushed to Docker Hub
2. ✅ **Deploy anywhere** - Vast.ai, your droplet, local machine
3. ✅ **Auto-scaling** - Manager spins up/down based on queue
4. ✅ **Cloud storage** - Google Drive mounted, accessible everywhere
5. ✅ **Programmatic** - Python API controls everything
6. ✅ **Cost-efficient** - Only pay when GPU is running

**Next Steps:**
1. Create `vastai-images/` directory with Dockerfiles
2. Build and push first image
3. Deploy vastai-manager to ASI360-Agency droplet
4. Test with first video job

**Ready to implement?**
