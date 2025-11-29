# Install Node.js via Conda (For Anaconda Prompt)

Since you're using Anaconda Prompt, the easiest way is to install Node.js through conda in your environment.

## Steps:

1. **In your Anaconda Prompt** (the one where `conda activate llm-battle-arena` works):

```bash
conda activate llm-battle-arena
conda install -c conda-forge nodejs npm -y
```

2. **Then navigate to frontend and install:**
```bash
cd C:\Users\rahul\Repos\llm-battle-arena\frontend
npm install
npm run dev
```

This will install Node.js and npm directly into your conda environment, so it will always be available when the environment is activated.

