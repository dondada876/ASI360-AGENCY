#!/usr/bin/env python3
"""
ASI 360 AI Services API Server
FastAPI server for image generation, text processing, and Claude integration
"""

import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from anthropic import Anthropic
from datetime import datetime

app = FastAPI(title="ASI 360 AI Services", version="1.0.0")

# Initialize clients
anthropic_client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

# Request models
class TextRequest(BaseModel):
    prompt: str
    max_tokens: int = 1024
    model: str = "claude-sonnet-4"

class ImageRequest(BaseModel):
    prompt: str
    width: int = 512
    height: int = 512
    num_images: int = 1

# Health check endpoint
@app.get("/")
async def root():
    return {
        "service": "ASI 360 AI Services",
        "status": "online",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Claude text processing
@app.post("/api/text/generate")
async def generate_text(request: TextRequest):
    """Generate text using Claude API"""
    try:
        message = anthropic_client.messages.create(
            model=request.model,
            max_tokens=request.max_tokens,
            messages=[
                {"role": "user", "content": request.prompt}
            ]
        )

        return {
            "success": True,
            "text": message.content[0].text,
            "model": request.model,
            "tokens_used": message.usage.input_tokens + message.usage.output_tokens
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Image generation
@app.post("/api/image/generate")
async def generate_image(request: ImageRequest):
    """Generate images using Stable Diffusion"""
    try:
        # Note: This requires the diffusers library and GPU
        # Will be implemented when deployed to Vast.ai GPU instance

        return {
            "success": True,
            "message": "Image generation endpoint ready (requires GPU)",
            "prompt": request.prompt
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Batch processing endpoint
@app.post("/api/batch/process")
async def batch_process(texts: list[str]):
    """Process multiple texts in batch"""
    results = []

    for text in texts:
        try:
            message = anthropic_client.messages.create(
                model="claude-sonnet-4",
                max_tokens=512,
                messages=[
                    {"role": "user", "content": text}
                ]
            )
            results.append({
                "input": text,
                "output": message.content[0].text,
                "success": True
            })
        except Exception as e:
            results.append({
                "input": text,
                "error": str(e),
                "success": False
            })

    return {"results": results, "total": len(texts)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
