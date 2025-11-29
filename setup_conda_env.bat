@echo off
echo Creating conda environment for LLM Battle Arena...
echo.

REM Create a new conda environment with Python 3.10
conda create -n llm-battle-arena python=3.10 -y

echo.
echo Activating environment...
call conda activate llm-battle-arena

echo.
echo Installing Python dependencies...
pip install -r requirements.txt

echo.
echo ========================================
echo Setup complete!
echo.
echo To activate the environment in the future, run:
echo   conda activate llm-battle-arena
echo ========================================

pause

