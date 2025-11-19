#!/usr/bin/env python3
"""
Image generation using Stable Diffusion
"""

from diffusers import StableDiffusionPipeline
import torch

def load_model(model_name: str = "stabilityai/stable-diffusion-2-1"):
    """Load Stable Diffusion model"""
    pipe = StableDiffusionPipeline.from_pretrained(
        model_name,
        torch_dtype=torch.float16
    )
    pipe = pipe.to("cuda")
    return pipe

def generate_image(pipe, prompt: str, output_path: str):
    """Generate image from text prompt"""
    image = pipe(prompt).images[0]
    image.save(output_path)
    return output_path
