from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Dict, Optional
from datetime import datetime
from pydantic import BaseModel

import database
from database import Battle, Response, Rating, init_db
from battle_logic import run_battle
from llm_clients import model_names

def get_model_display_name(model: str) -> str:
    """Get display name for a model"""
    return model_names.get(model, model)

app = FastAPI(title="LLM Battle Arena")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models
class BattleRequest(BaseModel):
    prompt: str


class BattleResponse(BaseModel):
    id: int
    prompt: str
    created_at: datetime
    responses: List[Dict]
    winner: str


class StatsResponse(BaseModel):
    leaderboard: List[Dict]
    total_battles: int


@app.on_event("startup")
async def startup():
    await init_db()


@app.post("/api/battle", response_model=Dict)
async def create_battle(
    request: BattleRequest,
    db: AsyncSession = Depends(database.get_db)
):
    """Run a battle and save results"""
    try:
        # Run the battle
        results = await run_battle(request.prompt)
        
        # Save to database
        battle = Battle(prompt=request.prompt, created_at=datetime.utcnow())
        db.add(battle)
        await db.flush()
        
        # Create response records
        response_records = {}
        for model_name, response_text in results["responses"].items():
            avg_score = results["average_scores"].get(model_name, 0.0)
            is_winner = 1 if model_name == results["winner"] else 0
            
            response_record = Response(
                battle_id=battle.id,
                model_name=model_name,
                response_text=response_text,
                average_score=avg_score,
                is_winner=is_winner
            )
            db.add(response_record)
            await db.flush()
            response_records[model_name] = response_record
        
        # Create rating records
        for judge_model, ratings in results["parsed_ratings"].items():
            for response_model, rating_data in ratings.items():
                # Handle both dict format (with reasoning) and old float format
                if isinstance(rating_data, dict):
                    score = rating_data["score"]
                    reasoning = rating_data.get("reasoning", "")
                else:
                    score = rating_data
                    reasoning = ""
                
                rating_record = Rating(
                    battle_id=battle.id,
                    response_id=response_records[response_model].id,
                    judge_model=judge_model,
                    score=score,
                    reasoning=reasoning
                )
                db.add(rating_record)
        
        await db.commit()
        await db.refresh(battle)
        
        # Prepare response
        response_list = []
        for model_name, response_text in results["responses"].items():
            response_list.append({
                "model": model_name,
                "model_display": results["model_names"][model_name],
                "text": response_text,
                "average_score": results["average_scores"][model_name],
                "is_winner": model_name == results["winner"],
                "ratings": {
                    judge: (
                        results["parsed_ratings"][judge][model_name] 
                        if isinstance(results["parsed_ratings"][judge][model_name], dict)
                        else {"score": results["parsed_ratings"][judge][model_name], "reasoning": ""}
                    )
                    for judge in results["parsed_ratings"].keys()
                }
            })
        
        # Sort by score descending
        response_list.sort(key=lambda x: x["average_score"], reverse=True)
        
        return {
            "id": battle.id,
            "prompt": request.prompt,
            "created_at": battle.created_at.isoformat(),
            "responses": response_list,
            "winner": results["winner"],
            "winner_display": results["model_names"][results["winner"]]
        }
    
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Battle failed: {str(e)}")


@app.delete("/api/battle/{battle_id}")
async def delete_battle(
    battle_id: int,
    db: AsyncSession = Depends(database.get_db)
):
    """Delete a specific battle and all its associated data"""
    try:
        from sqlalchemy import delete
        # Check if battle exists
        result = await db.execute(
            select(Battle).where(Battle.id == battle_id)
        )
        battle = result.scalar_one_or_none()
        
        if not battle:
            raise HTTPException(status_code=404, detail="Battle not found")
        
        # Delete ratings first (they reference responses)
        await db.execute(delete(Rating).where(Rating.battle_id == battle_id))
        # Delete responses (they reference battles)
        await db.execute(delete(Response).where(Response.battle_id == battle_id))
        # Finally delete the battle
        await db.execute(delete(Battle).where(Battle.id == battle_id))
        await db.commit()
        
        return {"message": f"Battle {battle_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete battle: {str(e)}")


@app.get("/api/battle/{battle_id}")
async def get_battle(
    battle_id: int,
    db: AsyncSession = Depends(database.get_db)
):
    """Get a specific battle by ID"""
    result = await db.execute(
        select(Battle).where(Battle.id == battle_id)
    )
    battle = result.scalar_one_or_none()
    
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    
    # Get responses
    responses_result = await db.execute(
        select(Response).where(Response.battle_id == battle_id).order_by(Response.average_score.desc())
    )
    responses = responses_result.scalars().all()
    
    # Get ratings for each response
    response_data = []
    for response in responses:
        ratings_result = await db.execute(
            select(Rating).where(Rating.response_id == response.id)
        )
        ratings = ratings_result.scalars().all()
        
        ratings_dict = {
            r.judge_model: {
                "score": r.score,
                "reasoning": r.reasoning or ""
            }
            for r in ratings
        }
        
        response_data.append({
            "model": response.model_name,
            "model_display": get_model_display_name(response.model_name),
            "text": response.response_text,
            "average_score": response.average_score,
            "is_winner": bool(response.is_winner),
            "ratings": ratings_dict
        })
    
    return {
        "id": battle.id,
        "prompt": battle.prompt,
        "created_at": battle.created_at.isoformat(),
        "responses": response_data,
        "winner": next((r["model"] for r in response_data if r["is_winner"]), None)
    }


@app.get("/api/battles")
async def get_battles(
    limit: int = 50,
    db: AsyncSession = Depends(database.get_db)
):
    """Get recent battles"""
    result = await db.execute(
        select(Battle).order_by(Battle.created_at.desc()).limit(limit)
    )
    battles = result.scalars().all()
    
    return [{
        "id": battle.id,
        "prompt": battle.prompt[:100] + "..." if len(battle.prompt) > 100 else battle.prompt,
        "created_at": battle.created_at.isoformat()
    } for battle in battles]


@app.get("/api/stats")
async def get_stats(db: AsyncSession = Depends(database.get_db)):
    """Get aggregate statistics"""
    # Get total battles
    total_result = await db.execute(select(func.count(Battle.id)))
    total_battles = total_result.scalar() or 0
    
    # Get wins per model
    wins_result = await db.execute(
        select(Response.model_name, func.count(Response.id))
        .where(Response.is_winner == 1)
        .group_by(Response.model_name)
    )
    wins = {row[0]: row[1] for row in wins_result.all()}
    
    # Get average scores per model
    avg_scores_result = await db.execute(
        select(Response.model_name, func.avg(Response.average_score))
        .group_by(Response.model_name)
    )
    avg_scores = {row[0]: row[1] or 0.0 for row in avg_scores_result.all()}
    
    # Get all models
    all_models = set(wins.keys()) | set(avg_scores.keys())
    
    leaderboard = []
    for model in all_models:
        leaderboard.append({
            "model": model,
            "wins": wins.get(model, 0),
            "average_score": round(avg_scores.get(model, 0.0), 2),
            "win_rate": round((wins.get(model, 0) / total_battles * 100) if total_battles > 0 else 0, 2)
        })
    
    # Sort by wins descending, then by average score
    leaderboard.sort(key=lambda x: (x["wins"], x["average_score"]), reverse=True)
    
    return {
        "leaderboard": leaderboard,
        "total_battles": total_battles
    }


@app.delete("/api/stats")
async def clear_stats(db: AsyncSession = Depends(database.get_db)):
    """Clear all battles and statistics"""
    try:
        from sqlalchemy import delete
        # Delete all ratings first (foreign key constraint)
        await db.execute(delete(Rating))
        # Delete all responses
        await db.execute(delete(Response))
        # Delete all battles
        await db.execute(delete(Battle))
        await db.commit()
        return {"message": "All stats cleared successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear stats: {str(e)}")


@app.get("/")
async def root():
    """Serve the frontend"""
    return FileResponse("frontend/dist/index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

