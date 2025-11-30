import json
import asyncio
import httpx
import base64
from io import BytesIO
from typing import Optional
from config import settings
import google.generativeai as genai
from openai import OpenAI
from anthropic import Anthropic
from PIL import Image


class LLMClient:
    """Base class for LLM clients"""
    
    async def generate(self, prompt: str, json_mode: bool = False, conversation_history: Optional[list] = None, image_data: Optional[str] = None) -> str:
        raise NotImplementedError


class OpenAIClient(LLMClient):
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model
    
    async def generate(self, prompt: str, json_mode: bool = False, conversation_history: Optional[list] = None, image_data: Optional[str] = None) -> str:
        try:
            # Build messages array from conversation history + current prompt
            messages = []
            if conversation_history:
                # Convert history to OpenAI format (already in correct format)
                messages.extend(conversation_history)
            
            # Build user message content
            user_content = []
            if image_data:
                # Extract base64 data from data URI if present
                if image_data.startswith("data:image/"):
                    user_content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": image_data
                        }
                    })
                else:
                    # Assume it's just base64, wrap it in data URI
                    user_content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_data}"
                        }
                    })
            user_content.append({"type": "text", "text": prompt})
            messages.append({"role": "user", "content": user_content})
            
            params = {
                "model": self.model,
                "messages": messages,
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
    
    async def generate(self, prompt: str, json_mode: bool = False, conversation_history: Optional[list] = None, image_data: Optional[str] = None) -> str:
        # Build messages array from conversation history + current prompt
        messages = []
        if conversation_history:
            # Convert history to Anthropic format (already in correct format)
            messages.extend(conversation_history)
        
        # Build user message content
        if image_data:
            # Extract base64 data from data URI if present
            if image_data.startswith("data:image/"):
                # Parse data URI: data:image/png;base64,<base64_data>
                parts = image_data.split(",")
                if len(parts) == 2:
                    header = parts[0]  # data:image/png;base64
                    base64_data = parts[1]
                    # Extract mime type
                    mime_type = header.split(":")[1].split(";")[0]  # image/png
                else:
                    base64_data = image_data
                    mime_type = "image/png"  # Default
            else:
                base64_data = image_data
                mime_type = "image/png"  # Default
            
            # Anthropic format for images
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime_type,
                            "data": base64_data
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            })
        else:
            messages.append({"role": "user", "content": prompt})
        
        params = {
            "model": self.model,
            "max_tokens": 4096,
            "messages": messages
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
    
    async def generate(self, prompt: str, json_mode: bool = False, conversation_history: Optional[list] = None, image_data: Optional[str] = None) -> str:
        try:
            generation_config = {}
            if json_mode:
                # Google Gemini JSON mode
                generation_config = {
                    "response_mime_type": "application/json"
                }
            
            # Prepare content parts (text + optional image)
            content_parts = [prompt]
            if image_data:
                # Extract base64 data from data URI if present
                if image_data.startswith("data:image/"):
                    parts = image_data.split(",")
                    base64_data = parts[1] if len(parts) == 2 else image_data
                else:
                    base64_data = image_data
                
                # Convert base64 to PIL Image
                image_bytes = base64.b64decode(base64_data)
                image = Image.open(BytesIO(image_bytes))
                content_parts = [image, prompt]  # Gemini expects image first, then text
            
            # Build conversation history for Google Gemini
            # Gemini uses a chat session with history
            if conversation_history and len(conversation_history) > 0:
                # Build history: list of dicts with role and parts
                history = []
                for msg in conversation_history:
                    role = "user" if msg["role"] == "user" else "model"
                    history.append({
                        "role": role,
                        "parts": [msg["content"]]  # Note: history may not include images
                    })
                
                # Create a chat session with history
                chat = self.model.start_chat(history=history)
                # Send current prompt with image
                response = await asyncio.to_thread(chat.send_message, content_parts)
            else:
                # No history - use direct generate_content
                response = await asyncio.to_thread(
                    self.model.generate_content, 
                    content_parts, 
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
    
    async def generate(self, prompt: str, json_mode: bool = False, conversation_history: Optional[list] = None, image_data: Optional[str] = None) -> str:
        # Grok/xAI may not support images yet, so skip image for now
        # If image is provided, just include a note in the prompt
        if image_data:
            prompt = f"[Note: An image/screenshot was provided but Grok does not currently support image inputs. Please respond to the text prompt below.]\n\n{prompt}"
        
        async with httpx.AsyncClient() as client:
            # Try the configured model first
            try:
                # Build messages array from conversation history + current prompt
                messages = []
                if conversation_history:
                    # Convert history to Grok format (already in correct format)
                    messages.extend(conversation_history)
                messages.append({"role": "user", "content": prompt})
                
                payload = {
                    "model": self.model,
                    "messages": messages,
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

