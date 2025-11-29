import re
import json
import asyncio
import time
import statistics
from typing import List, Dict, Tuple, Optional, Set
from llm_clients import clients, model_names


def determine_winner(
    average_scores: Dict[str, float],
    parsed_ratings: Dict[str, Dict[str, Dict]],
    all_models: List[str]
) -> Tuple[str, Dict]:
    """
    Determine winner with multi-level tiebreaker:
    1. Highest average score
    2. Highest maximum score (best single judge rating)
    3. Lowest variance (most consistent)
    4. Head-to-head comparison (most pairwise wins)
    5. Declare multiple winners if still tied
    """
    tiebreaker_info = {
        "method": "average_score",
        "tie_occurred": False,
        "tied_models": [],
        "tiebreaker_levels_used": []
    }
    
    # Find the highest average score
    max_avg_score = max(average_scores.values())
    tied_models = [model for model, score in average_scores.items() 
                   if abs(score - max_avg_score) < 0.001]  # Float comparison tolerance
    
    # If no tie, return immediately
    if len(tied_models) == 1:
        return tied_models[0], tiebreaker_info
    
    tiebreaker_info["tie_occurred"] = True
    tiebreaker_info["tied_models"] = tied_models.copy()
    tiebreaker_info["tiebreaker_levels_used"].append("average_score")
    
    print(f"⚔️  Tie detected at {max_avg_score:.2f} average: {', '.join(tied_models)}")
    
    # Level 1: Highest maximum score (best single judge rating)
    max_scores = {}
    for model in tied_models:
        scores = []
        for judge in parsed_ratings.keys():
            rating_data = parsed_ratings[judge].get(model, {})
            if isinstance(rating_data, dict):
                scores.append(rating_data.get("score", 0.0))
            else:
                scores.append(float(rating_data) if rating_data else 0.0)
        max_scores[model] = max(scores) if scores else 0.0
    
    max_max_score = max(max_scores.values())
    tied_models = [model for model in tied_models 
                   if abs(max_scores[model] - max_max_score) < 0.001]
    
    if len(tied_models) == 1:
        tiebreaker_info["method"] = "max_score"
        tiebreaker_info["tiebreaker_levels_used"].append("max_score")
        print(f"  ✅ Tiebreaker: Highest max score ({max_max_score:.2f}) - Winner: {tied_models[0]}")
        return tied_models[0], tiebreaker_info
    
    tiebreaker_info["tiebreaker_levels_used"].append("max_score")
    print(f"  ⚔️  Still tied after max score ({max_max_score:.2f}): {', '.join(tied_models)}")
    
    # Level 2: Lowest variance (most consistent)
    variances = {}
    for model in tied_models:
        scores = []
        for judge in parsed_ratings.keys():
            rating_data = parsed_ratings[judge].get(model, {})
            if isinstance(rating_data, dict):
                scores.append(rating_data.get("score", 0.0))
            else:
                scores.append(float(rating_data) if rating_data else 0.0)
        if len(scores) > 1:
            try:
                variances[model] = statistics.variance(scores)
            except statistics.StatisticsError:
                # If variance can't be calculated (e.g., all same values), use 0
                variances[model] = 0.0
        else:
            variances[model] = 0.0
    
    min_variance = min(variances.values())
    tied_models = [model for model in tied_models 
                   if abs(variances[model] - min_variance) < 0.001]
    
    if len(tied_models) == 1:
        tiebreaker_info["method"] = "lowest_variance"
        tiebreaker_info["tiebreaker_levels_used"].append("lowest_variance")
        print(f"  ✅ Tiebreaker: Lowest variance ({min_variance:.4f}) - Winner: {tied_models[0]}")
        return tied_models[0], tiebreaker_info
    
    tiebreaker_info["tiebreaker_levels_used"].append("lowest_variance")
    print(f"  ⚔️  Still tied after variance check: {', '.join(tied_models)}")
    
    # Level 3: Head-to-head comparison (count pairwise wins)
    head_to_head_wins = {model: 0 for model in tied_models}
    
    for judge in parsed_ratings.keys():
        judge_scores = {}
        for model in tied_models:
            rating_data = parsed_ratings[judge].get(model, {})
            if isinstance(rating_data, dict):
                judge_scores[model] = rating_data.get("score", 0.0)
            else:
                judge_scores[model] = float(rating_data) if rating_data else 0.0
        
        # Find the highest score for this judge among tied models
        max_judge_score = max(judge_scores.values())
        winners_for_judge = [model for model in tied_models 
                            if abs(judge_scores[model] - max_judge_score) < 0.001]
        
        # Award points to winners (split evenly if judge also has a tie)
        points_per_model = 1.0 / len(winners_for_judge)
        for model in winners_for_judge:
            head_to_head_wins[model] += points_per_model
    
    max_wins = max(head_to_head_wins.values())
    tied_models = [model for model in tied_models 
                   if abs(head_to_head_wins[model] - max_wins) < 0.001]
    
    if len(tied_models) == 1:
        tiebreaker_info["method"] = "head_to_head"
        tiebreaker_info["tiebreaker_levels_used"].append("head_to_head")
        print(f"  ✅ Tiebreaker: Head-to-head wins ({max_wins:.2f}) - Winner: {tied_models[0]}")
        return tied_models[0], tiebreaker_info
    
    tiebreaker_info["tiebreaker_levels_used"].append("head_to_head")
    
    # Final: Still tied - return first one alphabetically (or could be "multiple winners")
    # For now, we'll return the first one but mark it as a tie
    tiebreaker_info["method"] = "alphabetical_fallback"
    print(f"  ⚠️  Still tied after all tiebreakers - using alphabetical order")
    print(f"     Final winner: {sorted(tied_models)[0]} (tied with {', '.join(sorted(tied_models)[1:])})")
    
    return sorted(tied_models)[0], tiebreaker_info


def extract_score(text: str) -> Optional[float]:
    """Extract a score (0-10) from LLM response text"""
    # Look for patterns like "8/10", "8.5", "Score: 7", etc.
    patterns = [
        r'(\d+\.?\d*)\s*/\s*10',
        r'score[:\s]+(\d+\.?\d*)',
        r'rating[:\s]+(\d+\.?\d*)',
        r'\b(\d+\.?\d*)\s*(?:out of|/)?\s*10',
        r'\b(10|[0-9](?:\.[0-9]+)?)\b'
    ]
    
    text_lower = text.lower()
    for pattern in patterns:
        matches = re.findall(pattern, text_lower)
        if matches:
            try:
                score = float(matches[0])
                if 0 <= score <= 10:
                    return score
            except (ValueError, IndexError):
                continue
    
    # If no pattern found, try to extract first number
    numbers = re.findall(r'\b\d+\.?\d*\b', text)
    for num in numbers:
        try:
            score = float(num)
            if 0 <= score <= 10:
                return score
        except ValueError:
            continue
    
    return None


async def run_battle(prompt: str, conversation_history: Optional[list] = None) -> Dict:
    """
    Run a complete battle:
    1. Get responses from all 4 LLMs (with conversation history)
    2. Have each LLM rate all responses
    3. Aggregate scores and determine winner
    
    Args:
        prompt: The current user prompt
        conversation_history: Optional list of previous messages in format 
                             [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
                             Only winning responses should be included as assistant messages
    """
    start_time = time.time()
    timing_info = {}
    
    # Step 1: Get initial responses - RUN IN PARALLEL for speed!
    step1_start = time.time()
    async def get_response(client_name, client):
        call_start = time.time()
        last_error = None
        # Retry once if the first attempt fails
        for attempt in range(2):
            try:
                # Pass conversation history to enable context awareness
                response_text = await client.generate(prompt, conversation_history=conversation_history)
                call_duration = time.time() - call_start
                if attempt > 0:
                    print(f"✅ {client_name} response succeeded on retry ({call_duration:.2f}s)")
                else:
                    print(f"⏱️  {client_name} response: {call_duration:.2f}s")
                return client_name, response_text, call_duration
            except asyncio.CancelledError:
                # Re-raise cancelled errors - they indicate task cancellation and should propagate
                raise
            except Exception as e:
                last_error = e
                call_duration = time.time() - call_start
                if attempt == 0:
                    print(f"⚠️  Error getting response from {client_name} (attempt {attempt + 1}), retrying... ({call_duration:.2f}s): {e}")
                    # Wait a bit before retrying
                    await asyncio.sleep(1.0)
                else:
                    # Final attempt failed
                    print(f"❌ Error getting response from {client_name} after {attempt + 1} attempts ({call_duration:.2f}s): {e}")
                    return client_name, f"Error: {str(e)}", call_duration
    
    # Run all 4 API calls in parallel
    tasks = [get_response(name, client) for name, client in clients.items()]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    responses = {}
    response_timings = {}
    for result in results:
        if isinstance(result, Exception):
            print(f"Exception in result: {result}")
            continue
        try:
            # Check if result is a tuple/list
            if isinstance(result, (tuple, list)) and len(result) == 3:
                client_name, response_text, call_duration = result
                responses[client_name] = response_text
                response_timings[client_name] = call_duration
            elif isinstance(result, (tuple, list)) and len(result) == 2:
                # Handle old format for backwards compatibility
                client_name, response_text = result
                responses[client_name] = response_text
            else:
                print(f"Unexpected result format: {result} (type: {type(result)})")
                continue
        except (ValueError, TypeError, IndexError) as e:
            print(f"Error unpacking result: {result}, error: {e}")
            continue
    
    step1_duration = time.time() - step1_start
    timing_info["step1_get_responses"] = step1_duration
    print(f"📊 Step 1 (Get responses): {step1_duration:.2f}s")
    
    # Step 2: Create rating prompt
    step2_start = time.time()
    responses_list = []
    for i, (client_name, response_text) in enumerate(responses.items(), 1):
        responses_list.append(f"Response {i} (from {model_names[client_name]}):\n{response_text}")
    
    step2_duration = time.time() - step2_start
    timing_info["step2_create_prompt"] = step2_duration
    print(f"📊 Step 2 (Create rating prompt): {step2_duration:.2f}s")
    
    rating_prompt = f"""You are an expert evaluator of LLM responses. I will give you an original prompt and four different responses from different LLMs. Please evaluate each response and provide a score from 0-10 based on:
- Relevance to the prompt
- Accuracy and correctness
- Clarity and coherence
- Completeness
- Overall quality

Original Prompt:
{prompt}

Responses:
{chr(10).join(responses_list)}

Respond with a JSON object in this exact format:
{{
  "response_1": {{"score": 8.5, "reasoning": "Brief explanation"}},
  "response_2": {{"score": 7.0, "reasoning": "Brief explanation"}},
  "response_3": {{"score": 9.0, "reasoning": "Brief explanation"}},
  "response_4": {{"score": 6.5, "reasoning": "Brief explanation"}}
}}"""
    
    # Step 3: Get ratings from each LLM - RUN IN PARALLEL for speed!
    step3_start = time.time()
    async def get_rating(client_name, client):
        call_start = time.time()
        last_error = None
        # Retry once if the first attempt fails
        for attempt in range(2):
            try:
                # Request JSON format from the API
                rating_response = await client.generate(rating_prompt, json_mode=True)
                call_duration = time.time() - call_start
                if attempt > 0:
                    print(f"✅ {client_name} rating succeeded on retry ({call_duration:.2f}s)")
                else:
                    print(f"⏱️  {client_name} rating: {call_duration:.2f}s")
                return client_name, rating_response, call_duration
            except asyncio.CancelledError:
                # Re-raise cancelled errors - they indicate task cancellation and should propagate
                raise
            except Exception as e:
                last_error = e
                call_duration = time.time() - call_start
                if attempt == 0:
                    print(f"⚠️  Error getting rating from {client_name} (attempt {attempt + 1}), retrying... ({call_duration:.2f}s): {e}")
                    # Wait a bit before retrying
                    await asyncio.sleep(1.0)
                else:
                    # Final attempt failed
                    print(f"❌ Error getting rating from {client_name} after {attempt + 1} attempts ({call_duration:.2f}s): {e}")
                    return client_name, "", call_duration
    
    # Run all 4 rating calls in parallel
    rating_tasks = [get_rating(name, client) for name, client in clients.items()]
    rating_results = await asyncio.gather(*rating_tasks, return_exceptions=True)
    
    all_ratings = {}
    rating_timings = {}
    for result in rating_results:
        if isinstance(result, Exception):
            continue
        try:
            # Try to unpack 3 values (with timing)
            if len(result) == 3:
                client_name, rating_response, call_duration = result
                all_ratings[client_name] = rating_response
                rating_timings[client_name] = call_duration
            else:
                # Handle old format
                client_name, rating_response = result[:2]
                all_ratings[client_name] = rating_response
        except (ValueError, TypeError, IndexError) as e:
            print(f"Error unpacking rating result: {result}, error: {e}")
            continue
    
    step3_duration = time.time() - step3_start
    timing_info["step3_get_ratings"] = step3_duration
    print(f"📊 Step 3 (Get ratings): {step3_duration:.2f}s")
    
    # Step 4: Parse ratings and aggregate scores - Using JSON parsing
    step4_start = time.time()
    parsed_ratings = {}
    response_names = list(responses.keys())
    
    for judge_name, rating_text in all_ratings.items():
        parsed_ratings[judge_name] = {}
        
        # Try to parse as JSON first
        try:
            # Extract JSON from response (might have markdown code blocks or extra text)
            rating_text_clean = rating_text.strip()
            
            # Try to find JSON in code blocks
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', rating_text_clean, re.DOTALL)
            if json_match:
                rating_text_clean = json_match.group(1)
            else:
                # Try to find JSON object directly
                json_match = re.search(r'\{.*\}', rating_text_clean, re.DOTALL)
                if json_match:
                    rating_text_clean = json_match.group(0)
            
            # Parse JSON
            ratings_json = json.loads(rating_text_clean)
            
            # Extract scores and reasoning for each response
            for i, response_name in enumerate(response_names, 1):
                key = f"response_{i}"
                if key in ratings_json and "score" in ratings_json[key]:
                    score = float(ratings_json[key]["score"])
                    reasoning = ratings_json[key].get("reasoning", "")
                    if 0 <= score <= 10:
                        parsed_ratings[judge_name][response_name] = {
                            "score": score,
                            "reasoning": reasoning
                        }
                    else:
                        parsed_ratings[judge_name][response_name] = {
                            "score": 5.0,
                            "reasoning": ""
                        }
                else:
                    parsed_ratings[judge_name][response_name] = {
                        "score": 5.0,
                        "reasoning": ""
                    }
        
        except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
            # Fallback to old parsing method if JSON parsing fails
            print(f"JSON parsing failed for {judge_name}, using fallback: {e}")
            for i, response_name in enumerate(response_names, 1):
                # Try to find score for this response in the rating text
                patterns = [
                    rf'response\s+{i}[:\-]?\s*(\d+\.?\d*)',
                    rf'response\s+{i}[:\-]?\s*(?:\w+\s+)*(\d+\.?\d*)',
                ]
                score = None
                for pattern in patterns:
                    match = re.search(pattern, rating_text.lower())
                    if match:
                        try:
                            score = float(match.group(1))
                            if 0 <= score <= 10:
                                break
                        except (ValueError, IndexError):
                            continue
                
                # If pattern matching failed, try extract_score on the full text
                if score is None:
                    score = extract_score(rating_text)
                
                parsed_ratings[judge_name][response_name] = {
                    "score": score if score is not None else 5.0,
                    "reasoning": ""
                }
    
    step4_duration = time.time() - step4_start
    timing_info["step4_parse_ratings"] = step4_duration
    print(f"📊 Step 4 (Parse ratings): {step4_duration:.2f}s")
    
    # Step 5: Calculate average scores
    step5_start = time.time()
    average_scores = {}
    for response_name in responses.keys():
        scores = []
        for judge in parsed_ratings.keys():
            rating_data = parsed_ratings[judge][response_name]
            # Handle both dict format (with reasoning) and old float format
            if isinstance(rating_data, dict):
                scores.append(rating_data["score"])
            else:
                scores.append(float(rating_data))
        average_scores[response_name] = sum(scores) / len(scores) if scores else 0.0
    
    step5_duration = time.time() - step5_start
    timing_info["step5_calculate_scores"] = step5_duration
    
    # Step 6: Determine winner with multi-level tiebreaker
    winner, tiebreaker_info = determine_winner(
        average_scores, parsed_ratings, responses.keys()
    )
    
    total_duration = time.time() - start_time
    timing_info["total"] = total_duration
    timing_info["response_timings"] = response_timings
    timing_info["rating_timings"] = rating_timings
    
    print(f"\n{'='*50}")
    print(f"⏱️  TOTAL BATTLE TIME: {total_duration:.2f}s")
    print(f"{'='*50}")
    print(f"Step 1 (Get responses): {timing_info['step1_get_responses']:.2f}s")
    print(f"  - Individual: {', '.join([f'{k}: {v:.2f}s' for k, v in response_timings.items()])}")
    print(f"Step 2 (Create prompt): {timing_info['step2_create_prompt']:.2f}s")
    print(f"Step 3 (Get ratings): {timing_info['step3_get_ratings']:.2f}s")
    print(f"  - Individual: {', '.join([f'{k}: {v:.2f}s' for k, v in rating_timings.items()])}")
    print(f"Step 4 (Parse ratings): {timing_info['step4_parse_ratings']:.2f}s")
    print(f"Step 5 (Calculate scores): {timing_info['step5_calculate_scores']:.2f}s")
    print(f"{'='*50}\n")
    
    # Prepare detailed results
    results = {
        "prompt": prompt,
        "responses": responses,
        "ratings": all_ratings,
        "parsed_ratings": parsed_ratings,
        "average_scores": average_scores,
        "winner": winner,
        "tiebreaker_info": tiebreaker_info,
        "model_names": model_names,
        "timing_info": timing_info
    }
    
    return results

