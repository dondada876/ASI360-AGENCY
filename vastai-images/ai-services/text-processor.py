#!/usr/bin/env python3
"""
Text processing utilities using Claude API
"""

import os
from anthropic import Anthropic

client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

def process_text(prompt: str, system: str = None, max_tokens: int = 1024):
    """Process text using Claude"""
    message = client.messages.create(
        model="claude-sonnet-4",
        max_tokens=max_tokens,
        system=system if system else "",
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    return message.content[0].text

def summarize(text: str):
    """Summarize long text"""
    return process_text(
        f"Please provide a concise summary of the following text:\n\n{text}",
        system="You are a helpful assistant that summarizes text clearly and concisely."
    )

def extract_keywords(text: str):
    """Extract keywords from text"""
    return process_text(
        f"Extract the main keywords from this text as a comma-separated list:\n\n{text}",
        system="You extract keywords and return them as a simple comma-separated list."
    )
