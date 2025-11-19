# ASI 360 Render Farm Container for Vast.ai
# Includes: Blender, FFmpeg, Celery job queue

FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    blender \
    ffmpeg \
    python3 \
    python3-pip \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip3 install --no-cache-dir \
    celery \
    redis \
    supabase \
    pillow \
    numpy \
    python-dotenv

# Create workspace
WORKDIR /workspace
RUN mkdir -p /renders /projects /output /logs

# Copy render scripts
COPY render-worker.py /workspace/
COPY blender-automation.py /workspace/

# Environment variables
ENV SUPABASE_URL=""
ENV SUPABASE_KEY=""
ENV REDIS_URL="redis://localhost:6379"
ENV CELERY_BROKER_URL="redis://localhost:6379/0"

# Default command: run Celery worker
CMD ["celery", "-A", "render-worker", "worker", "--loglevel=info", "--concurrency=1"]
