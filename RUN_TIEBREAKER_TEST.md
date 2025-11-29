# Testing and Updating Tiebreakers

## 1. Test Tiebreaker Logic (Read-Only)

Test the tiebreaker logic on an existing battle without modifying the database:

```bash
cd C:\Users\rahul\Repos\llm-battle-arena
conda activate llm-battle-arena
python test_tiebreaker.py 5
```

## 2. Update All Battle Winners

Update all battles in the database with the new tiebreaker logic:

```bash
conda activate llm-battle-arena
python update_all_winners.py
```

Or update a specific battle:

```bash
python update_all_winners.py 5
```

## What it does

- Loads battle #5 from the database
- Shows current scores and any ties
- Applies the new multi-level tiebreaker logic
- Compares the old winner with the new winner
- Shows which tiebreaker method was used to resolve the tie

## Alternative: Test different battles

To test on a different battle, change the number:

```bash
python test_tiebreaker.py 3    # Test battle 3
python test_tiebreaker.py 7    # Test battle 7
```

## Expected Output

The script will show:
- Current average scores for all models
- Whether a tie was detected
- The tiebreaker resolution process (if a tie occurred)
- Final winner and which tiebreaker method was used
- Comparison with the old winner

