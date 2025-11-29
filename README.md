# 🤖 LLM Battle Arena

An automated system to compare responses from multiple LLMs by having them rate each other's responses. Battle four cutting-edge AI models (GPT-5.1, Claude Opus 4.5, Gemini 3 Pro, and Grok 4.1) and see which one provides the best answer!

## Quick Start

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Up API Keys

Create a `.env` file in the root directory with your API keys:

```bash
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
GROK_API_KEY=your_grok_api_key_here
```

Alternatively, you can use the setup script:
```bash
python setup_env.py
```

### 3. Start the Backend Server

Open a terminal and run:

```bash
python -m uvicorn main:app --reload --port 8000
```

The backend will start on `http://localhost:8000`. You should see output indicating the server is running.

### 4. Start the Frontend (in a new terminal)

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:5173` and will automatically open in your browser.

## Testing

1. **Open the application**: Navigate to `http://localhost:5173` in your browser

2. **Test a Battle**:
   - Go to the "Chat" tab
   - Enter a prompt (e.g., "Write a haiku about artificial intelligence")
   - Click "Run Battle"
   - Wait for the battle to complete (this takes about 30-60 seconds as it queries 4 LLMs and has them rate each other)

3. **View Results**:
   - After the battle completes, you'll automatically be taken to the "Battle Results" tab
   - You'll see all 4 responses ranked by score
   - The winner is highlighted with a green badge

4. **Check Stats**:
   - Go to the "Stats" tab to see the leaderboard
   - View win counts and average scores for each model

## Features

- **Chat Tab**: Traditional LLM interface showing the winner's response
- **Battle Results Tab**: View all 4 responses ranked by score with detailed ratings from each judge
- **Stats Tab**: Track wins and aggregate scores over time with a leaderboard

## How It Works

1. You submit a prompt
2. The system sends the prompt to 4 LLMs simultaneously:
   - OpenAI (GPT-5.1)
   - Anthropic (Claude Opus 4.5)
   - Google (Gemini 3 Pro)
   - xAI (Grok 4.1)
3. Each LLM rates all 4 responses on a scale of 0-10
4. The system calculates average scores and determines the winner
5. Results are saved to the database for stats tracking

## Troubleshooting

- **API Key Errors**: Make sure your `.env` file has all 4 API keys set correctly
- **Model Not Found**: If a model identifier doesn't work, check the `config.py` file and try the fallback options mentioned in comments
- **Port Already in Use**: Change the port in the uvicorn command or kill the process using that port
- **Frontend Not Connecting**: Make sure the backend is running on port 8000 and CORS is properly configured

