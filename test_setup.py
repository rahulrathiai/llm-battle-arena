"""
Quick setup verification script
Run this to check if your environment is configured correctly
"""
import os
import sys
from pathlib import Path

def check_env_file():
    """Check if .env file exists and has API keys"""
    env_path = Path(".env")
    if not env_path.exists():
        print("❌ .env file not found!")
        print("   Create a .env file with your API keys:")
        print("   OPENAI_API_KEY=...")
        print("   ANTHROPIC_API_KEY=...")
        print("   GOOGLE_API_KEY=...")
        print("   GROK_API_KEY=...")
        return False
    
    from dotenv import load_dotenv
    load_dotenv()
    
    required_keys = [
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY", 
        "GOOGLE_API_KEY",
        "GROK_API_KEY"
    ]
    
    missing = []
    for key in required_keys:
        if not os.getenv(key):
            missing.append(key)
    
    if missing:
        print(f"❌ Missing API keys in .env: {', '.join(missing)}")
        return False
    
    print("✅ .env file found with all API keys")
    return True

def check_dependencies():
    """Check if required Python packages are installed"""
    required_packages = [
        "fastapi",
        "uvicorn",
        "openai",
        "anthropic",
        "google.generativeai",
        "httpx",
        "sqlalchemy",
        "pydantic",
        "dotenv"
    ]
    
    missing = []
    for package in required_packages:
        try:
            if package == "dotenv":
                __import__("dotenv")
            elif package == "google.generativeai":
                __import__("google.generativeai")
            else:
                __import__(package.replace("-", "_"))
        except ImportError:
            missing.append(package)
    
    if missing:
        print(f"❌ Missing Python packages: {', '.join(missing)}")
        print("   Run: pip install -r requirements.txt")
        return False
    
    print("✅ All Python dependencies installed")
    return True

def check_config():
    """Check if config.py can be loaded"""
    try:
        from config import settings
        print("✅ Config file loaded successfully")
        print(f"   Models configured:")
        print(f"   - OpenAI: {settings.openai_model}")
        print(f"   - Anthropic: {settings.anthropic_model}")
        print(f"   - Google: {settings.google_model}")
        print(f"   - Grok: {settings.grok_model}")
        return True
    except Exception as e:
        print(f"❌ Error loading config: {e}")
        return False

def main():
    print("=" * 50)
    print("LLM Battle Arena - Setup Verification")
    print("=" * 50)
    print()
    
    checks = [
        ("Dependencies", check_dependencies),
        ("Environment File", check_env_file),
        ("Configuration", check_config),
    ]
    
    results = []
    for name, check_func in checks:
        print(f"Checking {name}...")
        result = check_func()
        results.append(result)
        print()
    
    print("=" * 50)
    if all(results):
        print("✅ All checks passed! You're ready to start.")
        print()
        print("Next steps:")
        print("1. Start backend: python -m uvicorn main:app --reload --port 8000")
        print("2. Start frontend: cd frontend && npm install && npm run dev")
    else:
        print("❌ Some checks failed. Please fix the issues above.")
    print("=" * 50)

if __name__ == "__main__":
    main()

