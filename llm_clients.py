import json
import asyncio
import httpx
from typing import Optional
from config import settings
import google.generativeai as genai
from openai import OpenAI
from anthropic import Anthropic


class LLMClient:
    """Base class for LLM clients"""
    
    async def generate(self, prompt: str, json_mode: bool = False) -> str:
        raise NotImplementedError


class OpenAIClient(LLMClient):
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model
    
    async def generate(self, prompt: str, json_mode: bool = False) -> str:
        try:
            params = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7
            }
            if json_mode:
                params["response_format"] = {"type": "json_object"}
            
            # Run synchronous OpenAI call in thread pool to allow true async
            response = await asyncio.to_thread(self.client.chat.completions.create, **params)
            return response.choices[0].message.content
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "quota" in error_msg.lower():
                raise Exception(f"OpenAI quota exceeded. Check your billing. Try: gpt-4o or gpt-4-turbo")
            elif "404" in error_msg or "not found" in error_msg.lower():
                raise Exception(f"OpenAI model '{self.model}' not found. Try: gpt-4o, gpt-4-turbo, or gpt-3.5-turbo")
            raise Exception(f"OpenAI API error: {error_msg}")


class AnthropicClient(LLMClient):
    def __init__(self):
        self.client = Anthropic(api_key=settings.anthropic_api_key)
        self.model = settings.anthropic_model
    
    async def generate(self, prompt: str, json_mode: bool = False) -> str:
        params = {
            "model": self.model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}]
        }
        if json_mode:
            # Anthropic uses structured outputs - enforce JSON schema
            params["system"] = "You must respond with valid JSON only, no other text."
        
        # Run synchronous Anthropic call in thread pool to allow true async
        message = await asyncio.to_thread(self.client.messages.create, **params)
        return message.content[0].text


class GoogleClient(LLMClient):
    def __init__(self):
        genai.configure(api_key=settings.google_api_key)
        self.model_name = settings.google_model
        try:
            self.model = genai.GenerativeModel(self.model_name)
        except Exception as e:
            raise Exception(f"Failed to initialize Gemini model '{self.model_name}': {str(e)}")
    
    async def generate(self, prompt: str, json_mode: bool = False) -> str:
        try:
            generation_config = {}
            if json_mode:
                # Google Gemini JSON mode
                generation_config = {
                    "response_mime_type": "application/json"
                }
            # Run synchronous Google call in thread pool to allow true async
            response = await asyncio.to_thread(
                self.model.generate_content, 
                prompt, 
                generation_config=generation_config if generation_config else None
            )
            return response.text
        except Exception as e:
            error_msg = str(e)
            if "404" in error_msg or "not found" in error_msg.lower():
                raise Exception(f"Gemini model '{self.model_name}' not found. Available models: gemini-1.5-pro, gemini-1.5-flash, gemini-pro")
            raise Exception(f"Gemini API error: {error_msg}")


class GrokClient(LLMClient):
    def __init__(self):
        self.api_key = settings.grok_api_key
        self.model = settings.grok_model
        self.base_url = "https://api.x.ai/v1"
    
    async def generate(self, prompt: str, json_mode: bool = False) -> str:
        async with httpx.AsyncClient() as client:
            # Try the configured model first
            try:
                payload = {
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7
                }
                if json_mode:
                    # Grok (xAI) supports response_format like OpenAI
                    payload["response_format"] = {"type": "json_object"}
                
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=60.0
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 403:
                    raise Exception(f"Grok API 403 Forbidden - Check API key permissions. Error: {e.response.text}")
                elif e.response.status_code == 404:
                    raise Exception(f"Grok model '{self.model}' not found. Try 'grok-beta' or check available models.")
                raise Exception(f"Grok API error {e.response.status_code}: {e.response.text}")
            except Exception as e:
                raise Exception(f"Grok API error: {str(e)}")


# Create client instances
clients = {
    "openai": OpenAIClient(),
    "anthropic": AnthropicClient(),
    "google": GoogleClient(),
    "grok": GrokClient()
}

model_names = {
    "openai": settings.openai_model,
    "anthropic": settings.anthropic_model,
    "google": settings.google_model,
    "grok": settings.grok_model
}

