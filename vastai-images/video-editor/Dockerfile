# ASI 360 Video Editor Container for Vast.ai
# Includes: FFmpeg, Python, rclone, Parsec for remote desktop

FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    wget \
    curl \
    unzip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install rclone for cloud storage mounting
RUN curl https://rclone.org/install.sh | bash

# Install Python dependencies
RUN pip3 install --no-cache-dir \
    supabase \
    anthropic \
    opencv-python-headless \
    pillow \
    requests \
    python-dotenv

# Install Parsec for remote desktop access (optional, for interactive editing)
RUN wget https://builds.parsec.app/package/parsec-linux.deb && \
    dpkg -i parsec-linux.deb || apt-get install -f -y && \
    rm parsec-linux.deb

# Create workspace directories
WORKDIR /workspace
RUN mkdir -p /storage /output /input /logs

# Copy processing scripts
COPY render-queue.py /workspace/
COPY video-processor.py /workspace/
COPY storage-sync.py /workspace/

# Environment variables (will be set at runtime)
ENV SUPABASE_URL=""
ENV SUPABASE_KEY=""
ENV RCLONE_REMOTE=""

# Default command: run the render queue processor
CMD ["python3", "/workspace/render-queue.py"]
