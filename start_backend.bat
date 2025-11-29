@echo off
call conda activate llm-battle-arena
cd /d "%~dp0"
python -m uvicorn main:app --reload --port 8000
pause

