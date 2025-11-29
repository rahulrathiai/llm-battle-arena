# Quick Start Guide

## Step-by-Step Setup

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Create .env File

Create a file named `.env` in the root directory:

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
GROK_API_KEY=...
```

### 3. Start Backend (Terminal 1)

```bash
python -m uvicorn main:app --reload --port 8000
```

Wait for: `Application startup complete.`

### 4. Start Frontend (Terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Wait for: `Local: http://localhost:5173/`

### 5. Test It!

1. Open `http://localhost:5173` in your browser
2. Go to "Chat" tab
3. Enter a prompt: "Explain quantum computing in simple terms"
4. Click "Run Battle"
5. Wait 30-60 seconds
6. See results in "Battle Results" tab!

## Your First Battle

Try these test prompts:
- "Write a haiku about AI"
- "Explain recursion to a 5-year-old"
- "Write a Python function to reverse a string"
- "Summarize the pros and cons of renewable energy"

## Troubleshooting

**Backend won't start?**
- Check Python version (3.8+ required)
- Make sure all packages installed: `pip install -r requirements.txt`

**Frontend won't start?**
- Check Node.js is installed: `node --version`
- Install dependencies: `cd frontend && npm install`

**API errors?**
- Verify all API keys in `.env` file
- Check API key format is correct
- Make sure you have credits/quota for each service

**Models not found?**
- Check `config.py` for model names
- Try fallback models mentioned in comments

