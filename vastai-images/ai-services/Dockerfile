# ASI 360 AI Services Container for Vast.ai
# Includes: PyTorch, Stable Diffusion, Claude API, FastAPI server

FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python AI dependencies
RUN pip install --no-cache-dir \
    anthropic \
    diffusers \
    transformers \
    accelerate \
    xformers \
    fastapi \
    uvicorn \
    pydantic \
    pillow \
    torch \
    torchvision \
    supabase \
    python-dotenv \
    requests

# Create workspace
WORKDIR /workspace
RUN mkdir -p /models /input /output /logs

# Copy AI service scripts
COPY ai-api-server.py /workspace/
COPY image-generator.py /workspace/
COPY text-processor.py /workspace/

# Download models (optional, can be done at runtime)
# RUN python3 -c "from diffusers import StableDiffusionPipeline; StableDiffusionPipeline.from_pretrained('stabilityai/stable-diffusion-2-1')"

# Environment variables
ENV ANTHROPIC_API_KEY=""
ENV SUPABASE_URL=""
ENV SUPABASE_KEY=""
ENV HF_HOME="/models"

# Expose API port
EXPOSE 8000

# Default command: run the FastAPI server
CMD ["uvicorn", "ai-api-server:app", "--host", "0.0.0.0", "--port", "8000"]
