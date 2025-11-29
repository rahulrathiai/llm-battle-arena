from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # API Keys
    openai_api_key: str
    anthropic_api_key: str
    google_api_key: str
    grok_api_key: str
    
    # Model names - Latest models as of 2024
    # Note: API model identifiers may vary. Using known working models.
    openai_model: str = "gpt-5.1"  # GPT-5.1 - Fallback: "gpt-4o" or "gpt-4-turbo"
    anthropic_model: str = "claude-opus-4-5-20251101"  # Claude Opus 4.5 - Fallback: "claude-3-5-sonnet-20241022"
    google_model: str = "gemini-3-pro-preview"  # Gemini 3 Pro Preview - Fallback: "gemini-1.5-pro" or "gemini-1.5-flash"
    grok_model: str = "grok-4-1-fast"  # Grok 4.1 Fast - Fallback: "grok-beta" or "grok-2-1212"
    
    # Performance settings
    num_judges: int = 2  # Number of LLMs to use as judges (2 = faster, 4 = more accurate)
    api_timeout: int = 20  # Timeout in seconds for API calls
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

