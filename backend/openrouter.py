"""OpenRouter API client for making LLM requests."""

import httpx
from typing import List, Dict, Any, Optional
from .config import OPENROUTER_API_KEY, OPENROUTER_API_URL


async def query_model(
    model: str,
    messages: List[Dict[str, str]],
    timeout: float = 120.0
) -> Optional[Dict[str, Any]]:
    """
    Query a single model via OpenRouter API.

    Args:
        model: OpenRouter model identifier (e.g., "openai/gpt-4o")
        messages: List of message dicts with 'role' and 'content'
        timeout: Request timeout in seconds

    Returns:
        Response dict with 'content' and optional 'reasoning_details', or None if failed
    """
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": messages,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                OPENROUTER_API_URL,
                headers=headers,
                json=payload
            )
            response.raise_for_status()

            data = response.json()
            message = data['choices'][0]['message']

            return {
                'content': message.get('content'),
                'reasoning_details': message.get('reasoning_details')
            }

    except Exception as e:
        print(f"Error querying model {model}: {e}")
        return None


async def query_models_parallel(
    models: List[str],
    messages: List[Dict[str, str]]
) -> Dict[str, Optional[Dict[str, Any]]]:
    """
    Query multiple models in parallel.

    Args:
        models: List of OpenRouter model identifiers
        messages: List of message dicts to send to each model

    Returns:
        Dict mapping model identifier to response dict (or None if failed)
    """
    import asyncio

    # Create tasks for all models
    tasks = [query_model(model, messages) for model in models]

    # Wait for all to complete
    responses = await asyncio.gather(*tasks)

    # Map models to their responses
    return {model: response for model, response in zip(models, responses)}


# --- Streaming ---------------------------------------------------------------
# Everything below streams a model's answer piece by piece instead of waiting
# for the whole thing. OpenRouter sends the pieces as "server-sent events":
# a series of lines that each look like  data: {...json...}

# How often we forward buffered text to the browser. Sending every single token
# would spam the UI, so we batch a little.
FLUSH_SECONDS = 0.12
FLUSH_CHARS = 60


async def stream_model(
    model: str,
    messages: List[Dict[str, str]],
    timeout: float = 300.0
):
    """
    Stream a single model's answer via OpenRouter.

    Yields (channel, text) tuples as they arrive, where channel is either
    'content' (the real answer) or 'reasoning' (the model thinking out loud).
    """
    import json

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST", OPENROUTER_API_URL, headers=headers, json=payload
        ) as response:
            if response.status_code >= 400:
                body = (await response.aread()).decode(errors="replace")
                raise RuntimeError(f"HTTP {response.status_code}: {body[:300]}")

            async for line in response.aiter_lines():
                # Blank lines separate events; lines starting with ':' are
                # keep-alive comments (OpenRouter sends ": OPENROUTER PROCESSING")
                if not line or line.startswith(":"):
                    continue
                if not line.startswith("data: "):
                    continue

                data = line[6:]
                if data.strip() == "[DONE]":
                    break

                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue

                choices = chunk.get("choices") or []
                if not choices:
                    continue

                delta = choices[0].get("delta") or {}

                reasoning = delta.get("reasoning")
                if reasoning:
                    yield ("reasoning", reasoning)

                content = delta.get("content")
                if content:
                    yield ("content", content)


async def stream_model_to_queue(
    model: str,
    messages: List[Dict[str, str]],
    queue,
    stage: str,
    timeout: float = 300.0
) -> str:
    """
    Stream one model and push its text onto `queue` as it arrives.

    Each queue item looks like:
        {"type": "stage1_delta", "model": ..., "channel": "content", "text": ...}

    Returns the model's full answer text ('' if the model failed).
    """
    import time

    content_parts = []
    buffer = {"content": "", "reasoning": ""}
    last_flush = time.monotonic()

    async def flush(force: bool = False):
        """Send whatever text is buffered, if enough time or text has built up."""
        nonlocal last_flush
        pending = len(buffer["content"]) + len(buffer["reasoning"])
        if pending == 0:
            return
        if not force:
            waited = time.monotonic() - last_flush
            if waited < FLUSH_SECONDS and pending < FLUSH_CHARS:
                return
        for channel in ("reasoning", "content"):
            if buffer[channel]:
                await queue.put({
                    "type": f"{stage}_delta",
                    "model": model,
                    "channel": channel,
                    "text": buffer[channel],
                })
                buffer[channel] = ""
        last_flush = time.monotonic()

    try:
        async for channel, text in stream_model(model, messages, timeout):
            if channel == "content":
                content_parts.append(text)
            buffer[channel] += text
            await flush()
        await flush(force=True)
    except Exception as e:
        print(f"Error streaming model {model}: {e}")
        await flush(force=True)
        await queue.put({
            "type": f"{stage}_error",
            "model": model,
            "message": str(e),
        })

    return "".join(content_parts)


async def stream_models_parallel(
    models: List[str],
    messages: List[Dict[str, str]],
    queue,
    stage: str
) -> Dict[str, str]:
    """
    Stream several models at once, all pushing onto the same queue.

    Returns a dict mapping model identifier to its full answer text.
    """
    import asyncio

    tasks = [
        stream_model_to_queue(model, messages, queue, stage)
        for model in models
    ]
    texts = await asyncio.gather(*tasks)

    return {model: text for model, text in zip(models, texts)}
