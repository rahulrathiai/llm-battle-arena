# Troubleshooting Guide

## Model Configuration Fixes

I've updated the config with working model names. Here's what changed:

### 1. **OpenAI (GPT) - Quota Issue** ✅
**Problem:** `gpt-5.1` - Quota exceeded (429 error)

**Fix:** Changed to `gpt-4o` (currently available and working)

**If you want to try GPT-5.1:**
- Check your OpenAI billing/plan at https://platform.openai.com/account/billing
- Make sure you have credits/quota available
- You can manually change back to `gpt-5.1` in `config.py` once quota is resolved

### 2. **Google Gemini - Model Not Found** ✅
**Problem:** `gemini-3-pro` - 404 error (model doesn't exist yet)

**Fix:** Changed to `gemini-1.5-pro` (available now)

**Available Gemini Models:**
- `gemini-1.5-pro` (recommended)
- `gemini-1.5-flash` (faster)
- `gemini-pro` (older but stable)

### 3. **Grok - 403 Forbidden** ⚠️
**Problem:** `grok-4.1` - 403 error (API key or model issue)

**Fix:** Changed to `grok-beta` (standard model name)

**To fix Grok:**
1. **Check API Key:**
   - Verify your Grok API key is correct
   - Make sure it's active and has permissions
   - Get a new key from: https://console.x.ai/

2. **Available Grok Models:**
   - `grok-beta` (standard)
   - `grok-2-1212` (alternative)
   
3. **API Access:**
   - Ensure your xAI account has API access enabled
   - Check if there are any access restrictions

## How to Change Models

Edit `config.py` and update the model names:

```python
openai_model: str = "gpt-4o"  # Change this
google_model: str = "gemini-1.5-pro"  # Change this
grok_model: str = "grok-beta"  # Change this
```

Then restart the backend server.

## Testing Individual APIs

You can test each API separately by checking the error messages in the battle results. The improved error handling will now show more specific error messages.

