"""
Update all battle winners in the database using the new tiebreaker logic.
This will recalculate winners for all battles and update the is_winner field.
"""
import asyncio
from sqlalchemy import select, update
from database import Battle, Response, Rating, init_db, AsyncSessionLocal
from battle_logic import determine_winner
from llm_clients import model_names


async def update_all_battles():
    """Update winners for all battles using new tiebreaker logic"""
    
    # Initialize database
    await init_db()
    
    async with AsyncSessionLocal() as db:
        # Get all battles
        battles_result = await db.execute(
            select(Battle).order_by(Battle.id)
        )
        battles = battles_result.scalars().all()
        
        print(f"📊 Found {len(battles)} battles to process\n")
        
        updated_count = 0
        tie_count = 0
        
        for battle in battles:
            print(f"Processing Battle {battle.id}...")
            
            # Get all responses for this battle
            responses_result = await db.execute(
                select(Response).where(Response.battle_id == battle.id)
            )
            responses = responses_result.scalars().all()
            
            if not responses:
                print(f"  ⚠️  No responses found, skipping\n")
                continue
            
            # Get all ratings for this battle
            ratings_result = await db.execute(
                select(Rating).where(Rating.battle_id == battle.id)
            )
            ratings = ratings_result.scalars().all()
            
            if not ratings:
                print(f"  ⚠️  No ratings found, skipping\n")
                continue
            
            # Build average_scores dict
            average_scores = {}
            for response in responses:
                average_scores[response.model_name] = response.average_score or 0.0
            
            # Build parsed_ratings structure
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
            
            # Determine new winner using tiebreaker logic
            # Suppress verbose tiebreaker output during batch processing
            import sys
            from io import StringIO
            old_stdout = sys.stdout
            sys.stdout = StringIO()  # Suppress print output
            
            new_winner, tiebreaker_info = determine_winner(
                average_scores, parsed_ratings, all_models
            )
            
            sys.stdout = old_stdout  # Restore stdout
            
            # Get old winner
            old_winner = next((r.model_name for r in responses if r.is_winner == 1), None)
            
            # Update all responses to set is_winner correctly
            for response in responses:
                new_is_winner = 1 if response.model_name == new_winner else 0
                
                if response.is_winner != new_is_winner:
                    response.is_winner = new_is_winner
                    updated_count += 1
            
            # Show results
            if tiebreaker_info.get('tie_occurred'):
                tie_count += 1
                method = tiebreaker_info.get('method', 'unknown')
                print(f"  ⚔️  Tie detected and resolved via: {method}")
            
            if old_winner != new_winner:
                print(f"  ⚠️  Winner changed: {model_names.get(old_winner, old_winner)} → {model_names.get(new_winner, new_winner)}")
            else:
                print(f"  ✅ Winner unchanged: {model_names.get(new_winner, new_winner)}")
            
            print()
        
        # Commit all changes
        await db.commit()
        
        print(f"{'='*60}")
        print(f"✅ Update complete!")
        print(f"   Total battles processed: {len(battles)}")
        print(f"   Battles with ties: {tie_count}")
        print(f"   Winner records updated: {updated_count}")
        print(f"{'='*60}")


async def update_single_battle(battle_id: int):
    """Update winner for a single battle"""
    
    await init_db()
    
    async with AsyncSessionLocal() as db:
        # Get the battle
        result = await db.execute(
            select(Battle).where(Battle.id == battle_id)
        )
        battle = result.scalar_one_or_none()
        
        if not battle:
            print(f"❌ Battle {battle_id} not found!")
            return
        
        print(f"📊 Updating Battle {battle_id}\n")
        
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
        
        # Build parsed_ratings structure
        parsed_ratings = {}
        all_models = list(average_scores.keys())
        
        for rating in ratings:
            judge_model = rating.judge_model
            response_model = None
            
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
        
        # Determine new winner
        new_winner, tiebreaker_info = determine_winner(
            average_scores, parsed_ratings, all_models
        )
        
        # Get old winner
        old_winner = next((r.model_name for r in responses if r.is_winner == 1), None)
        
        # Update all responses
        updated = False
        for response in responses:
            new_is_winner = 1 if response.model_name == new_winner else 0
            
            if response.is_winner != new_is_winner:
                response.is_winner = new_is_winner
                updated = True
        
        # Commit changes
        if updated:
            await db.commit()
            print(f"✅ Winner updated in database!")
        else:
            print(f"ℹ️  Winner already correct, no update needed")
        
        print(f"\nResults:")
        print(f"  Old winner: {model_names.get(old_winner, 'None') if old_winner else 'None'}")
        print(f"  New winner: {model_names.get(new_winner, new_winner)}")
        if tiebreaker_info.get('tie_occurred'):
            print(f"  Tiebreaker method: {tiebreaker_info.get('method', 'unknown')}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Update specific battle
        battle_id = int(sys.argv[1])
        print(f"Updating winner for Battle {battle_id}...\n")
        asyncio.run(update_single_battle(battle_id))
    else:
        # Update all battles
        print("Updating winners for all battles...\n")
        asyncio.run(update_all_battles())

