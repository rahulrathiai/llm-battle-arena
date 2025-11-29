# Uploading to GitHub - Step by Step

Follow these steps to upload your LLM Battle Arena to GitHub:

## Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Repository name: `llm-battle-arena` (or your preferred name)
4. Description: "Automated system to compare responses from multiple LLMs"
5. Choose **Public** or **Private** (your choice)
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click **"Create repository"**

## Step 2: Connect Your Local Repository

After creating the repo, GitHub will show you commands. Use these (replace `YOUR_USERNAME` with your GitHub username):

```bash
# Add the remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/llm-battle-arena.git

# Or if you prefer SSH:
# git remote add origin git@github.com:YOUR_USERNAME/llm-battle-arena.git
```

## Step 3: Stage and Commit All Files

```bash
# Stage all files
git add .

# Make your first commit
git commit -m "Initial commit: LLM Battle Arena - Compare GPT, Claude, Gemini, and Grok"
```

## Step 4: Push to GitHub

```bash
# Push to GitHub (first time)
git branch -M main
git push -u origin main
```

## Step 5: Verify

Go to your GitHub repository page and you should see all your files!

---

## Future Updates

When you make changes and want to push them:

```bash
git add .
git commit -m "Your commit message describing the changes"
git push
```

## Important Notes

- ⚠️ **Never commit your `.env` file** - It's already in `.gitignore` for security
- ⚠️ **Never commit `battles.db`** - It's also in `.gitignore`
- ✅ Your API keys are safe - `.env` is excluded from git

