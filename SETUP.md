# Environment Setup Guide

## Option 1: Using Conda (Recommended)

### Create and activate the conda environment:

```bash
# Create a new conda environment
conda create -n llm-battle-arena python=3.10 -y

# Activate the environment
conda activate llm-battle-arena

# Install dependencies
pip install -r requirements.txt
```

Or use the provided batch script:
```bash
setup_conda_env.bat
```

### Environment Name

The recommended environment name is: **`llm-battle-arena`**

This keeps it clear and matches your project name.

### After setup:

Once activated, you can:
- Run tests: `python test_setup.py`
- Start backend: `python -m uvicorn main:app --reload --port 8000`
- Install additional packages as needed

## Option 2: Using venv (Alternative)

If you prefer Python's built-in venv:

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## Activating the Environment

**Windows (PowerShell/CMD):**
```bash
conda activate llm-battle-arena
```

**To deactivate:**
```bash
conda deactivate
```

