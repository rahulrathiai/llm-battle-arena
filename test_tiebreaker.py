"""
Test script to rerun tiebreaker logic on an existing battle.
This allows us to apply the new multi-level tiebreaker to old battles
without re-running the entire battle.
"""
import asyncio
from sqlalchemy import select
from database import Battle, Response, Rating, init_db, AsyncSessionLocal
from battle_logic import determine_winner
from llm_clients import model_names


async def test_tiebreaker_on_battle(battle_id: int):
    """Apply new tiebreaker logic to an existing battle"""
    
    # Initialize database
    await init_db()
    
    # Use database module's session factory
    from database import AsyncSessionLocal
    
    async with AsyncSessionLocal() as db:
        # Get the battle
        result = await db.execute(
            select(Battle).where(Battle.id == battle_id)
        )
        battle = result.scalar_one_or_none()
        
        if not battle:
            print(f"❌ Battle {battle_id} not found!")
            return
        
        print(f"📊 Analyzing Battle {battle_id}:")
        print(f"   Prompt: {battle.prompt[:100]}...")
        print()
        
        # Get all responses
        responses_result = await db.execute(
            select(Response).where(Response.battle_id == battle_id)
        )
        responses = responses_result.scalars().all()
        
        # Get all ratings
        ratings_result = await db.execute(
            select(Rating).where(Rating.battle_id == battle_id)
        )
        ratings = ratings_result.scalars().all()
        
        # Build average_scores dict
        average_scores = {}
        for response in responses:
            average_scores[response.model_name] = response.average_score or 0.0
        
        # Build parsed_ratings structure (same format as battle_logic.py expects)
        parsed_ratings = {}
        all_models = list(average_scores.keys())
        
        # Group ratings by judge
        for rating in ratings:
            judge_model = rating.judge_model
            response_model = None
            
            # Find which model this rating belongs to
            for resp in responses:
                if resp.id == rating.response_id:
                    response_model = resp.model_name
                    break
            
            if not response_model:
                continue
            
            if judge_model not in parsed_ratings:
                parsed_ratings[judge_model] = {}
            
            parsed_ratings[judge_model][response_model] = {
                "score": rating.score,
                "reasoning": rating.reasoning or ""
            }
        
        # Display current scores
        print("📈 Current Average Scores:")
        sorted_scores = sorted(average_scores.items(), key=lambda x: x[1], reverse=True)
        for model, score in sorted_scores:
            winner_indicator = "🏆" if any(r.is_winner == 1 and r.model_name == model for r in responses) else "  "
            print(f"   {winner_indicator} {model_names.get(model, model)}: {score:.2f}")
        print()
        
        # Check for ties
        max_score = max(average_scores.values())
        tied_models = [model for model, score in average_scores.items() 
                      if abs(score - max_score) < 0.001]
        
        if len(tied_models) > 1:
            print(f"⚔️  TIE DETECTED! {len(tied_models)} models tied at {max_score:.2f}")
            print(f"   Tied models: {', '.join([model_names.get(m, m) for m in tied_models])}")
            print()
        else:
            print(f"✅ No tie - clear winner: {model_names.get(tied_models[0], tied_models[0])}")
            print()
        
        # Apply new tiebreaker logic
        print("🔄 Applying new multi-level tiebreaker logic...")
        print("-" * 60)
        
        new_winner, tiebreaker_info = determine_winner(
            average_scores, parsed_ratings, all_models
        )
        
        print("-" * 60)
        print()
        
        # Display results
        print("📊 Tiebreaker Results:")
        print(f"   Winner: {model_names.get(new_winner, new_winner)}")
        print(f"   Method: {tiebreaker_info.get('method', 'unknown')}")
        print(f"   Tie occurred: {tiebreaker_info.get('tie_occurred', False)}")
        
        if tiebreaker_info.get('tie_occurred'):
            print(f"   Tied models: {', '.join([model_names.get(m, m) for m in tiebreaker_info.get('tied_models', [])])}")
            print(f"   Levels used: {', '.join(tiebreaker_info.get('tiebreaker_levels_used', []))}")
        
        print()
        
        # Compare with old winner
        old_winner = next((r.model_name for r in responses if r.is_winner == 1), None)
        if old_winner:
            print(f"🔍 Comparison:")
            print(f"   Old winner: {model_names.get(old_winner, old_winner)}")
            print(f"   New winner: {model_names.get(new_winner, new_winner)}")
            
            if old_winner != new_winner:
                print(f"   ⚠️  Different winner detected!")
            else:
                print(f"   ✅ Same winner (tiebreaker confirmed or no change)")
        else:
            print(f"   ℹ️  No previous winner recorded")


if __name__ == "__main__":
    import sys
    
    battle_id = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    print(f"Testing tiebreaker on Battle {battle_id}\n")
    
    asyncio.run(test_tiebreaker_on_battle(battle_id))

