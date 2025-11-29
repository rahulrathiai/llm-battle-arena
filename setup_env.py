"""
Helper script to set up environment variables.
Run this to create a .env file with your API keys.
"""
import os

def setup_env():
    print("LLM Battle Arena - Environment Setup")
    print("=" * 50)
    print("\nPlease enter your API keys. Press Enter to skip any key.\n")
    
    env_vars = {
        "OPENAI_API_KEY": "OpenAI API Key",
        "ANTHROPIC_API_KEY": "Anthropic (Claude) API Key",
        "GOOGLE_API_KEY": "Google (Gemini) API Key",
        "GROK_API_KEY": "Grok API Key"
    }
    
    env_content = []
    for key, description in env_vars.items():
        value = input(f"{description}: ").strip()
        if value:
            env_content.append(f"{key}={value}")
    
    if env_content:
        with open(".env", "w") as f:
            f.write("\n".join(env_content))
        print("\n✅ .env file created successfully!")
    else:
        print("\n⚠️  No API keys provided. Please create .env file manually.")

if __name__ == "__main__":
    setup_env()

