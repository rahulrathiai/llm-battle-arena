# GitHub Authentication Setup

GitHub requires a Personal Access Token (PAT) instead of passwords for git operations.

## Quick Fix:

### Option 1: Use GitHub CLI (Easiest)
```bash
# Install GitHub CLI if you don't have it
# Then authenticate:
gh auth login
```

### Option 2: Use Personal Access Token

1. **Create a Token:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a name like "llm-battle-arena"
   - Select scope: **repo** (check the box)
   - Click "Generate token"
   - **COPY THE TOKEN** (you won't see it again!)

2. **Use the token:**
   - When git asks for password, paste the token instead
   - Username: your GitHub username
   - Password: paste the token

### Option 3: Use SSH (Most Secure)

1. **Generate SSH key:**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```
   (Press Enter to accept defaults)

2. **Add SSH key to GitHub:**
   - Copy the public key:
     ```bash
     cat ~/.ssh/id_ed25519.pub
     ```
   - Go to: https://github.com/settings/keys
   - Click "New SSH key"
   - Paste the key and save

3. **Update remote to use SSH:**
   ```bash
   git remote set-url origin git@github.com:rahulrathiai/llm-battle-arena.git
   ```

