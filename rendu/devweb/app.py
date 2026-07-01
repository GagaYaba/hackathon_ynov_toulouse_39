import os

import requests
from flask import Flask, jsonify, render_template, request


app = Flask(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "phi35-financial")
MAX_MESSAGE_LENGTH = 2000
REQUEST_TIMEOUT = 8


def check_ollama_status():
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        response.raise_for_status()
        return True
    except requests.RequestException:
        return False


def build_messages(history, message):
    messages = []

    if isinstance(history, list):
        for item in history:
            if not isinstance(item, dict):
                continue

            role = item.get("role")
            content = item.get("content")

            if role in {"user", "assistant"} and isinstance(content, str):
                messages.append({"role": role, "content": content[:MAX_MESSAGE_LENGTH]})

    messages.append({"role": "user", "content": message})
    return messages


def mock_response(message):
    return {
        "answer": f"[MODE TEST] Ollama n\u2019est pas encore connect\u00e9. Message re\u00e7u : {message}",
        "provider": "mock",
        "connected": False,
    }


@app.get("/")
def index():
    return render_template("index.html", model=OLLAMA_MODEL)


@app.get("/api/status")
def api_status():
    connected = check_ollama_status()
    return jsonify(
        {
            "connected": connected,
            "provider": "ollama" if connected else "mock",
            "model": OLLAMA_MODEL,
        }
    )


@app.post("/api/chat")
def api_chat():
    data = request.get_json(silent=True) or {}
    message = data.get("message", "")
    history = data.get("history", [])

    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "Le message est obligatoire."}), 400

    message = message.strip()
    if len(message) > MAX_MESSAGE_LENGTH:
        return jsonify({"error": "Le message ne doit pas depasser 2000 caracteres."}), 400

    messages = build_messages(history, message)

    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={"model": OLLAMA_MODEL, "messages": messages, "stream": False},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
        answer = payload.get("message", {}).get("content")

        if not answer:
            return jsonify(mock_response(message))

        return jsonify({"answer": answer, "provider": "ollama", "connected": True})
    except (requests.RequestException, ValueError):
        return jsonify(mock_response(message))


if __name__ == "__main__":
    debug_enabled = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=5000, debug=debug_enabled)
