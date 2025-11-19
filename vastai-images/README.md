# ASI 360 Vast.ai GPU Instances

Hot-swappable Docker containers for on-demand GPU compute (video editing, AI services, 3D rendering).

## Overview

This setup enables **97% cost savings** on GPU compute by using Vast.ai on-demand instances:

- **Dedicated GPU Server**: $500/mo (24/7)
- **Vast.ai On-Demand**: $16/mo (32 hours @ $0.50/hr) = **$484/mo saved**

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  ASI360-Agency Droplet (104.248.69.86)             │
│                                                      │
│  ┌────────────────────────────────────────┐        │
│  │  autoscale-manager.py                  │        │
│  │  - Monitors Supabase job queue         │        │
│  │  - Auto-deploys Vast.ai instances      │        │
│  │  - Auto-destroys idle instances        │        │
│  └────────────────────────────────────────┘        │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────▼────┐        ┌────▼────┐
    │ Docker  │        │ Docker  │
    │  Hub    │        │  Hub    │
    └────┬────┘        └────┬────┘
         │                   │
    ┌────▼─────────────┬────▼─────────────┐
    │                  │                   │
┌───▼────────┐    ┌───▼────────┐    ┌───▼────────┐
│  Vast.ai   │    │  Vast.ai   │    │  Vast.ai   │
│  Instance  │    │  Instance  │    │  Instance  │
│            │    │            │    │            │
│ RTX 3090   │    │ RTX 4090   │    │ A6000      │
│ $0.40/hr   │    │ $0.50/hr   │    │ $0.60/hr   │
└────────────┘    └────────────┘    └────────────┘
```

## Three Docker Images

### 1. Video Editor (`asi360/video-editor:latest`)

**Purpose**: Video processing, compression, trimming, format conversion

**Includes**:
- FFmpeg (GPU-accelerated)
- Python 3
- rclone (cloud storage mounting)
- Parsec (remote desktop)

**Use Cases**:
- Compress videos for web
- Trim/edit footage
- Extract audio
- Batch processing

**Cost**: ~$0.40-0.50/hr

### 2. AI Services (`asi360/ai-services:latest`)

**Purpose**: Image generation, text processing, Claude API integration

**Includes**:
- PyTorch
- Stable Diffusion
- Claude API client
- FastAPI server

**Use Cases**:
- Generate images for client websites
- AI-powered content creation
- Batch text processing
- Image upscaling

**Cost**: ~$0.50-0.60/hr (needs more VRAM)

### 3. Render Farm (`asi360/render-farm:latest`)

**Purpose**: 3D rendering, Blender automation

**Includes**:
- Blender
- FFmpeg
- Celery job queue
- Python automation

**Use Cases**:
- Product visualization renders
- Animation for client videos
- 3D modeling output

**Cost**: ~$0.50-0.70/hr

## Quick Start

### Prerequisites

1. **Docker Hub Account**: https://hub.docker.com
2. **Vast.ai Account**: https://cloud.vast.ai
3. **Vast.ai API Key**: https://cloud.vast.ai/account/

### Step 1: Build Images (Choose One)

#### Option A: Build on Droplet (RECOMMENDED)

Build on ASI360-Agency droplet (8GB RAM, faster upload):

```bash
# SSH to droplet
ssh root@104.248.69.86

# Navigate to project
cd /root/asi360-agency/vastai-images

# Run build script
./build-and-push.sh
```

#### Option B: Build on Mac Mini

If you have enough memory (16GB+) and want to build locally:

```bash
cd /Users/dbucknor/Projects/asi360-agency/vastai-images
./build-and-push.sh
```

**Note**: Mac Mini may struggle with large Docker builds. Droplet recommended.

### Step 2: Install Vast.ai CLI

```bash
pip install vastai
```

### Step 3: Configure Vast.ai

```bash
# Set your API key
vastai set api-key YOUR_API_KEY_HERE

# Test connection
vastai show instances
```

### Step 4: Deploy First Instance

#### Manual Deployment

```bash
cd scripts
python3 vastai-deploy.py search
python3 vastai-deploy.py deploy-video-editor
```

#### Automated Deployment (Recommended)

Run the auto-scaling manager on the droplet:

```bash
# SSH to droplet
ssh root@104.248.69.86

# Set environment variables
export SUPABASE_URL="https://jvjlhxodmbkodzmggwpu.supabase.co"
export SUPABASE_KEY="your_supabase_key"
export VASTAI_API_KEY="your_vastai_key"

# Start auto-scaler
cd /root/asi360-agency/vastai-images/scripts
nohup python3 autoscale-manager.py > /tmp/vastai-autoscale.log 2>&1 &

# Watch logs
tail -f /tmp/vastai-autoscale.log
```

## How Auto-Scaling Works

1. **Job Queued**: Client uploads video to process → Added to `render_jobs` table in Supabase
2. **Auto-Scale Detects**: Manager checks queue every 60 seconds, sees pending job
3. **Deploy Instance**: Finds cheapest GPU, deploys video-editor container from Docker Hub
4. **Process Job**: Container pulls job from queue, processes video, uploads result
5. **Auto-Destroy**: After 10 minutes of no jobs, instance is destroyed

**Cost Example**:
- Process 5 videos (30 min total)
- Instance cost: $0.50/hr × 0.5hr = **$0.25**
- vs. Dedicated GPU: $500/mo ÷ 720hr = $0.69/hr × 0.5hr = **$0.35**
- Savings: 29% per job, 97% monthly (if sporadic use)

## Using the API

### Submit Video Job

```python
from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Submit video compression job
supabase.table('render_jobs').insert({
    'job_type': 'video-editor',
    'operation': 'compress',
    'input_url': 'supabase/storage/videos/input.mp4',
    'output_url': 'supabase/storage/videos/output.mp4',
    'parameters': {
        'bitrate': '2M'
    },
    'status': 'pending'
}).execute()
```

### Check Job Status

```python
job = supabase.table('render_jobs') \
    .select('*') \
    .eq('id', job_id) \
    .single() \
    .execute()

print(f"Status: {job.data['status']}")
print(f"Progress: {job.data.get('progress', 0)}%")
```

## Supabase Schema

Create these tables in Supabase:

```sql
-- Render jobs queue
CREATE TABLE render_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type TEXT NOT NULL,  -- 'video-editor', 'ai-services', 'render-farm'
    operation TEXT NOT NULL,  -- 'compress', 'trim', 'resize', etc.
    input_url TEXT NOT NULL,
    output_url TEXT NOT NULL,
    parameters JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT
);

-- Vast.ai instance tracking
CREATE TABLE vastai_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id INTEGER NOT NULL,
    instance_type TEXT NOT NULL,  -- 'video-editor', 'ai-services', 'render-farm'
    status TEXT DEFAULT 'active',  -- 'active', 'destroyed'
    deployed_at TIMESTAMPTZ DEFAULT NOW(),
    destroyed_at TIMESTAMPTZ,
    jobs_processed INTEGER DEFAULT 0
);

-- Create indexes
CREATE INDEX idx_render_jobs_status ON render_jobs(status);
CREATE INDEX idx_render_jobs_job_type ON render_jobs(job_type);
CREATE INDEX idx_vastai_instances_status ON vastai_instances(status);
```

## Cost Analysis

### Scenario: Client Website Video Production

**Monthly Usage**:
- 10 client websites
- 5 videos per site = 50 videos/month
- 10 minutes processing per video
- Total: 500 minutes = 8.3 hours

**Cost with Dedicated GPU**:
```
$500/mo (24/7 uptime)
Utilization: 8.3hr / 720hr = 1.15%
Cost per video: $10
```

**Cost with Vast.ai Auto-Scaling**:
```
$0.50/hr × 8.3hr = $4.15/mo
Savings: $495.85/mo (99% savings)
Cost per video: $0.08
```

## Troubleshooting

### Build Fails on Mac Mini

**Error**: `Cannot allocate memory`

**Solution**: Build on droplet instead:
```bash
ssh root@104.248.69.86
cd /root/asi360-agency/vastai-images
./build-and-push.sh
```

### Vast.ai Instance Not Starting

**Check**:
1. API key configured: `vastai show instances`
2. Docker image exists: `docker pull asi360/video-editor:latest`
3. Offers available: `python3 vastai-deploy.py search`

### Auto-Scaler Not Deploying

**Check**:
1. Supabase connection: Test with Python client
2. Jobs in queue: Check `render_jobs` table
3. Max instances not reached: Default limit is 3

### Job Stuck in "Processing"

**Possible causes**:
1. Instance crashed (check Vast.ai console)
2. FFmpeg error (check instance logs: `vastai logs INSTANCE_ID`)
3. Storage access issue (check Supabase storage permissions)

## Advanced Configuration

### Custom GPU Requirements

Edit `vastai-deploy.py`:

```python
# Require RTX 4090 for AI services
offers = self.search_offers(
    min_gpu_ram=24,
    max_price=0.70,
    gpu_name="RTX 4090"
)
```

### Adjust Auto-Scaling

Edit `autoscale-manager.py`:

```python
CHECK_INTERVAL = 30  # Check every 30 seconds
IDLE_TIMEOUT = 300   # Destroy after 5 minutes idle
MAX_INSTANCES = 5    # Allow up to 5 concurrent instances
```

### Add New Container Type

1. Create new Dockerfile in `vastai-images/your-service/`
2. Add build step to `build-and-push.sh`
3. Add deploy function to `vastai-deploy.py`
4. Add to auto-scaler logic in `autoscale-manager.py`

## Files Structure

```
vastai-images/
├── README.md                      # This file
├── build-and-push.sh              # Build and push all images
│
├── video-editor/
│   ├── Dockerfile
│   ├── render-queue.py            # Job processor
│   ├── video-processor.py         # FFmpeg utilities
│   └── storage-sync.py            # Cloud storage integration
│
├── ai-services/
│   ├── Dockerfile
│   ├── ai-api-server.py           # FastAPI server
│   ├── image-generator.py         # Stable Diffusion
│   └── text-processor.py          # Claude API integration
│
├── render-farm/
│   ├── Dockerfile
│   ├── render-worker.py           # Celery worker
│   └── blender-automation.py      # Blender scripts
│
└── scripts/
    ├── vastai-deploy.py           # Manual deployment CLI
    └── autoscale-manager.py       # Auto-scaling daemon
```

## Next Steps

1. **Test First Deployment**: Build video-editor, deploy to Vast.ai
2. **Submit Test Job**: Process a sample video
3. **Monitor Costs**: Track actual usage in Vast.ai dashboard
4. **Enable Auto-Scaling**: Run autoscale-manager on droplet
5. **Integrate with WordPress**: Add video upload forms to client sites

## Support

- **Vast.ai Docs**: https://vast.ai/docs/
- **Docker Hub**: https://hub.docker.com/u/asi360
- **Supabase Dashboard**: https://jvjlhxodmbkodzmggwpu.supabase.co

---

**Built on ASI360-Agency droplet (104.248.69.86)** for optimal performance.
