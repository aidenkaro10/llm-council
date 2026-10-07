"""FastAPI backend for LLM Council."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
import json
import asyncio

from . import storage
from .council import (
    run_full_council,
    generate_conversation_title,
    stage1_collect_responses,
    stage2_collect_rankings,
    stage3_synthesize_final,
    calculate_aggregate_rankings,
    stage1_stream,
    stage2_stream,
    stage3_stream,
)
from . import settings as app_settings
from .config import OPENROUTER_API_URL

app = FastAPI(title="LLM Council API")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    # Vite picks the next free port if 5173 is taken, so allow any localhost port
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""
    pass


class SendMessageRequest(BaseModel):
    """Request to send a message in a conversation."""
    content: str


class SettingsRequest(BaseModel):
    """Request to save settings. Leave api_key out to keep the current one."""
    api_key: Optional[str] = None
    council_models: Optional[List[str]] = None
    chairman_model: Optional[str] = None


class ConversationMetadata(BaseModel):
    """Conversation metadata for list view."""
    id: str
    created_at: str
    title: str
    message_count: int


class Conversation(BaseModel):
    """Full conversation with all messages."""
    id: str
    created_at: str
    title: str
    messages: List[Dict[str, Any]]


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "LLM Council API"}


@app.get("/api/conversations", response_model=List[ConversationMetadata])
async def list_conversations():
    """List all conversations (metadata only)."""
    return storage.list_conversations()


@app.post("/api/conversations", response_model=Conversation)
async def create_conversation(request: CreateConversationRequest):
    """Create a new conversation."""
    conversation_id = str(uuid.uuid4())
    conversation = storage.create_conversation(conversation_id)
    return conversation


@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    """Get a specific conversation with all its messages."""
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@app.post("/api/conversations/{conversation_id}/message")
async def send_message(conversation_id: str, request: SendMessageRequest):
    """
    Send a message and run the 3-stage council process.
    Returns the complete response with all stages.
    """
    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    # Add user message
    storage.add_user_message(conversation_id, request.content)

    # If this is the first message, generate a title
    if is_first_message:
        title_result = await generate_conversation_title(request.content)
        storage.update_conversation_title(conversation_id, title_result["title"])

    # Run the 3-stage council process
    stage1_results, stage2_results, stage3_result, metadata = await run_full_council(
        request.content
    )

    # Add assistant message with all stages
    storage.add_assistant_message(
        conversation_id,
        stage1_results,
        stage2_results,
        stage3_result
    )

    # Return the complete response with metadata
    return {
        "stage1": stage1_results,
        "stage2": stage2_results,
        "stage3": stage3_result,
        "metadata": metadata
    }


@app.post("/api/conversations/{conversation_id}/message/stream")
async def send_message_stream(conversation_id: str, request: SendMessageRequest):
    """
    Send a message and stream the 3-stage council process.
    Returns Server-Sent Events as each stage completes.
    """
    # Check if conversation exists
    conversation = storage.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if this is the first message
    is_first_message = len(conversation["messages"]) == 0

    async def event_generator():
        # Every streaming model pushes its text onto this one queue, and we
        # forward whatever lands here straight to the browser.
        queue = asyncio.Queue()

        async def run_stage(coro, holder):
            """
            Run one stage of the council, forwarding its live text as it arrives.

            The stage's return value is put into holder["result"] because an
            async generator can't return a value of its own.
            """
            done_marker = object()

            async def runner():
                try:
                    holder["result"] = await coro
                except Exception as exc:
                    holder["error"] = exc
                await queue.put(done_marker)

            asyncio.create_task(runner())

            while True:
                event = await queue.get()
                if event is done_marker:
                    break
                yield f"data: {json.dumps(event)}\n\n"

            if "error" in holder:
                raise holder["error"]

        try:
            # Add user message
            storage.add_user_message(conversation_id, request.content)

            # Start title generation in parallel (don't await yet)
            title_task = None
            if is_first_message:
                title_task = asyncio.create_task(generate_conversation_title(request.content))

            # Stage 1: every council model answers, streaming as they write
            yield f"data: {json.dumps({'type': 'stage1_start', 'models': app_settings.get_council_models()})}\n\n"
            holder = {}
            async for chunk in run_stage(stage1_stream(request.content, queue), holder):
                yield chunk
            stage1_results = holder["result"]
            yield f"data: {json.dumps({'type': 'stage1_complete', 'data': stage1_results})}\n\n"

            if not stage1_results:
                yield f"data: {json.dumps({'type': 'error', 'message': 'All models failed to respond. Check your OPENROUTER_API_KEY and credits.'})}\n\n"
                return

            # Stage 2: each model reviews and ranks the anonymized answers
            yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
            holder = {}
            async for chunk in run_stage(stage2_stream(request.content, stage1_results, queue), holder):
                yield chunk
            stage2_results, label_to_model = holder["result"]
            aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
            yield f"data: {json.dumps({'type': 'stage2_complete', 'data': stage2_results, 'metadata': {'label_to_model': label_to_model, 'aggregate_rankings': aggregate_rankings}})}\n\n"

            # Stage 3: the Chairman writes the final answer
            yield f"data: {json.dumps({'type': 'stage3_start', 'model': app_settings.get_chairman_model()})}\n\n"
            holder = {}
            async for chunk in run_stage(stage3_stream(request.content, stage1_results, stage2_results, queue), holder):
                yield chunk
            stage3_result = holder["result"]
            yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"

            # Add up what this question cost across all three stages
            total_cost = (
                sum(r.get("cost", 0.0) for r in stage1_results)
                + sum(r.get("cost", 0.0) for r in stage2_results)
                + stage3_result.get("cost", 0.0)
            )

            # Wait for title generation if it was started
            if title_task:
                title_result = await title_task
                total_cost += title_result.get("cost", 0.0)
                storage.update_conversation_title(conversation_id, title_result["title"])
                yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title_result['title']}})}\n\n"

            yield f"data: {json.dumps({'type': 'cost_total', 'cost': total_cost})}\n\n"

            # Save complete assistant message
            storage.add_assistant_message(
                conversation_id,
                stage1_results,
                stage2_results,
                stage3_result,
                total_cost
            )

            # Send completion event
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            # Send error event
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.get("/api/stats")
async def get_stats():
    """Lifetime cost across every conversation."""
    return storage.get_stats()


@app.get("/api/settings")
async def get_settings():
    """
    Current settings for the Settings panel.

    The API key itself never leaves the server, only a masked preview of it.
    """
    return {
        "has_api_key": app_settings.has_api_key(),
        "key_preview": app_settings.key_preview(),
        "council_models": app_settings.get_council_models(),
        "chairman_model": app_settings.get_chairman_model(),
    }


@app.post("/api/settings")
async def save_settings(request: SettingsRequest):
    """Save the API key and/or the council lineup."""
    if request.api_key:
        key = request.api_key.strip()
        if not key.startswith("sk-or-"):
            raise HTTPException(
                status_code=400,
                detail="That doesn't look like an OpenRouter key. They start with sk-or-",
            )
        app_settings.save_api_key(key)

    if request.council_models is not None:
        if not request.council_models:
            raise HTTPException(status_code=400, detail="Pick at least one judge")
        app_settings.save_models(
            request.council_models,
            request.chairman_model or app_settings.get_chairman_model(),
        )

    return await get_settings()


# The full model list is big and rarely changes, so fetch it at most every 10 min
_models_cache = {"fetched_at": 0.0, "models": []}


@app.get("/api/models")
async def list_models():
    """Every model OpenRouter offers, for the judge picker."""
    import time
    import httpx

    if _models_cache["models"] and time.time() - _models_cache["fetched_at"] < 600:
        return _models_cache["models"]

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get("https://openrouter.ai/api/v1/models")
            response.raise_for_status()
            data = response.json().get("data", [])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach OpenRouter: {e}")

    models = [
        {
            "id": m["id"],
            "name": m.get("name", m["id"]),
            # per-million-token prices are easier to read than per-token
            "prompt_price": float((m.get("pricing") or {}).get("prompt") or 0) * 1_000_000,
            "completion_price": float((m.get("pricing") or {}).get("completion") or 0) * 1_000_000,
        }
        for m in data
        if not m["id"].endswith(":batch")
    ]
    models.sort(key=lambda m: m["id"])

    _models_cache["models"] = models
    _models_cache["fetched_at"] = time.time()
    return models


@app.get("/api/credits")
async def get_credits():
    """Your OpenRouter balance, shown in the Settings panel."""
    import httpx

    if not app_settings.has_api_key():
        raise HTTPException(status_code=400, detail="No API key saved yet")

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/credits",
                headers={"Authorization": f"Bearer {app_settings.get_api_key()}"},
            )
            response.raise_for_status()
            data = response.json().get("data", {})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach OpenRouter: {e}")

    return {
        "total_credits": data.get("total_credits", 0),
        "total_usage": data.get("total_usage", 0),
        "remaining": data.get("total_credits", 0) - data.get("total_usage", 0),
    }


# Serve the built frontend (npm run build) from the same server, so the whole
# app is one process on one port. Mounted last so it never shadows /api routes.
# In development ./start.sh runs Vite separately and this is simply unused.
DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST_DIR.is_dir():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
