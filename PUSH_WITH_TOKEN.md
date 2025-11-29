# Push with PAT Token

If you're getting 403 errors, try one of these methods:

## Method 1: Use token in URL (temporary, for testing)

Replace YOUR_TOKEN with your actual PAT:

```bash
git remote set-url origin https://YOUR_TOKEN@github.com/rahulrathiai/llm-battle-arena.git
git push -u origin main
```

**Then remove the token from URL after pushing:**
```bash
git remote set-url origin https://github.com/rahulrathiai/llm-battle-arena.git
```

## Method 2: Use Git Credential Manager

```bash
# Configure credential helper
git config --global credential.helper manager-core

# Then push (it will prompt for credentials)
git push -u origin main
# Username: rahulrathiai
# Password: [paste your PAT]
```

## Method 3: Check PAT Permissions

Your PAT needs:
- ✅ **repo** scope (full control)
- Make sure it's not expired
- Make sure you copied it correctly (no extra spaces)

## Check if Repository Exists

Visit: https://github.com/rahulrathiai/llm-battle-arena

If you get 404, the repository doesn't exist yet - create it first!

