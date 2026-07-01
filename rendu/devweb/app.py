import json
import os

import requests
from flask import Flask, Response, jsonify, render_template, request, stream_with_context


app = Flask(__name__)


def normalize_ollama_base_url(value):
    base_url = (value or "http://localhost:11434").strip().rstrip("/")

    for suffix in ("/api/generate", "/api/chat"):
        if base_url.endswith(suffix):
            base_url = base_url[: -len(suffix)].rstrip("/")

    return base_url or "http://localhost:11434"


OLLAMA_BASE_URL = normalize_ollama_base_url(os.getenv("OLLAMA_BASE_URL"))
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "phi3-financial")
MAX_MESSAGE_LENGTH = 2000
REQUEST_TIMEOUT = 60
STATUS_TIMEOUT = 10
CHAT_ENDPOINT = "/api/chat"
GENERATE_ENDPOINT = "/api/generate"
OLLAMA_HEADERS = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
}


def get_ollama_status():
    try:
        response = requests.get(
            f"{OLLAMA_BASE_URL}/api/tags",
            headers=OLLAMA_HEADERS,
            timeout=STATUS_TIMEOUT,
        )
        response.raise_for_status()
        return {
            "connected": True,
            "provider": "ollama",
            "model": OLLAMA_MODEL,
            "baseUrl": OLLAMA_BASE_URL,
            "chatEndpoint": CHAT_ENDPOINT,
            "fallbackEndpoint": GENERATE_ENDPOINT,
        }
    except requests.RequestException:
        return {
            "connected": False,
            "provider": "mock",
            "model": OLLAMA_MODEL,
            "baseUrl": OLLAMA_BASE_URL,
            "chatEndpoint": CHAT_ENDPOINT,
            "fallbackEndpoint": GENERATE_ENDPOINT,
            "message": (
                "Endpoint /api/tags indisponible, tentative de chat possible "
                "via /api/chat avec fallback /api/generate."
            ),
        }


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


def build_generate_prompt(history, message):
    lines = [
        "You are TechCorp Financial Assistant, a helpful financial/business assistant.",
        "",
        "Conversation history:",
    ]

    has_history = False
    if isinstance(history, list):
        for item in history:
            if not isinstance(item, dict):
                continue

            role = item.get("role")
            content = item.get("content")

            if role not in {"user", "assistant"} or not isinstance(content, str):
                continue

            label = "User" if role == "user" else "Assistant"
            lines.append(f"{label}: {content[:MAX_MESSAGE_LENGTH]}")
            has_history = True

    if not has_history:
        lines.append("No previous messages.")

    lines.extend(["", "Current user question:", message])
    return "\n".join(lines)


def mock_response(message, reason=None):
    reason_text = f" Raison : {reason}" if reason else ""
    payload = {
        "answer": (
            "[MODE TEST] Impossible de contacter le serveur "
            f"d\u2019inf\u00e9rence.{reason_text} Message re\u00e7u : {message}"
        ),
        "provider": "mock",
        "connected": False,
        "baseUrl": OLLAMA_BASE_URL,
    }

    if reason:
        payload["message"] = reason

    return payload


def extract_answer(payload):
    if not isinstance(payload, dict):
        return None

    message = payload.get("message")
    if isinstance(message, dict):
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()

    for key in ("response", "answer"):
        content = payload.get(key)
        if isinstance(content, str) and content.strip():
            return content.strip()

    return None


def format_ollama_error(error, endpoint):
    if isinstance(error, requests.Timeout):
        return f"timeout apres {REQUEST_TIMEOUT} secondes."

    if isinstance(error, requests.HTTPError) and error.response is not None:
        return f"HTTP {error.response.status_code} retourne par {endpoint}."

    if isinstance(error, requests.ConnectionError):
        return "connexion impossible au serveur d'inference."

    return "requete impossible vers le serveur d'inference."


def should_try_generate(error):
    if not isinstance(error, requests.HTTPError) or error.response is None:
        return False

    if error.response.status_code in {404, 405}:
        return True

    response_text = (error.response.text or "").lower()
    endpoint_missing_markers = (
        "not found",
        "page not found",
        "route not found",
        "endpoint",
        "not exist",
        "does not exist",
    )
    return any(marker in response_text for marker in endpoint_missing_markers)


def parse_chat_request():
    data = request.get_json(silent=True) or {}
    message = data.get("message", "")
    history = data.get("history", [])

    if not isinstance(message, str) or not message.strip():
        return None, None, ("Le message est obligatoire.", 400)

    message = message.strip()
    if len(message) > MAX_MESSAGE_LENGTH:
        return None, None, ("Le message ne doit pas depasser 2000 caracteres.", 400)

    return message, history, None


def post_ollama(endpoint, payload):
    response = requests.post(
        f"{OLLAMA_BASE_URL}{endpoint}",
        json=payload,
        headers=OLLAMA_HEADERS,
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()

    try:
        return response.json()
    except ValueError as error:
        raise ValueError(
            "reponse non JSON renvoyee par le serveur "
            "(HTML ou avertissement ngrok possible)."
        ) from error


def call_ollama_chat(messages):
    return post_ollama(
        CHAT_ENDPOINT,
        {"model": OLLAMA_MODEL, "messages": messages, "stream": False},
    )


def call_ollama_generate(prompt):
    return post_ollama(
        GENERATE_ENDPOINT,
        {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
    )


def post_ollama_stream(endpoint, payload):
    response = requests.post(
        f"{OLLAMA_BASE_URL}{endpoint}",
        json=payload,
        headers=OLLAMA_HEADERS,
        stream=True,
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()

    content_type = response.headers.get("Content-Type", "").lower()
    if "text/html" in content_type:
        response.close()
        raise ValueError("reponse HTML renvoyee par le serveur distant.")

    return response


def ollama_response(answer, provider):
    return {
        "answer": answer,
        "provider": provider,
        "connected": True,
        "baseUrl": OLLAMA_BASE_URL,
    }


def extract_stream_chunk(payload, endpoint):
    if not isinstance(payload, dict):
        return ""

    if endpoint == CHAT_ENDPOINT:
        message = payload.get("message")
        if isinstance(message, dict):
            content = message.get("content")
            if isinstance(content, str):
                return content

    content = payload.get("response")
    if isinstance(content, str):
        return content

    content = payload.get("answer")
    if isinstance(content, str):
        return content

    message = payload.get("message")
    if isinstance(message, dict):
        content = message.get("content")
        if isinstance(content, str):
            return content

    return ""


def stream_ollama_response(response, endpoint):
    try:
        for line in response.iter_lines(decode_unicode=True):
            if not line:
                continue

            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue

            chunk = extract_stream_chunk(payload, endpoint)
            if chunk:
                yield chunk

            if payload.get("done") is True:
                break
    finally:
        response.close()


def stream_mock_response(message, reason=None):
    answer = mock_response(message, reason)["answer"]
    words = answer.split(" ")

    for index, word in enumerate(words):
        yield word
        if index < len(words) - 1:
            yield " "


def stream_response(generator, provider):
    return Response(
        stream_with_context(generator),
        content_type="text/plain; charset=utf-8",
        headers={"X-TechCorp-Provider": provider},
    )


@app.get("/")
def index():
    return render_template("index.html", model=OLLAMA_MODEL)


@app.get("/api/status")
def api_status():
    return jsonify(get_ollama_status())


@app.post("/api/chat/stream")
def api_chat_stream():
    message, history, error = parse_chat_request()
    if error:
        error_message, status_code = error
        return jsonify({"error": error_message}), status_code

    messages = build_messages(history, message)
    prompt = build_generate_prompt(history, message)
    chat_error = None

    try:
        response = post_ollama_stream(
            CHAT_ENDPOINT,
            {"model": OLLAMA_MODEL, "messages": messages, "stream": True},
        )
        return stream_response(stream_ollama_response(response, CHAT_ENDPOINT), "ollama-chat")
    except requests.RequestException as error:
        chat_error = error
        if not should_try_generate(error):
            return stream_response(
                stream_mock_response(message, format_ollama_error(error, CHAT_ENDPOINT)),
                "mock",
            )
    except ValueError as error:
        return stream_response(stream_mock_response(message, str(error)), "mock")

    try:
        response = post_ollama_stream(
            GENERATE_ENDPOINT,
            {"model": OLLAMA_MODEL, "prompt": prompt, "stream": True},
        )
        return stream_response(
            stream_ollama_response(response, GENERATE_ENDPOINT),
            "ollama-generate",
        )
    except requests.RequestException as error:
        chat_reason = format_ollama_error(chat_error, CHAT_ENDPOINT)
        generate_reason = format_ollama_error(error, GENERATE_ENDPOINT)
        return stream_response(
            stream_mock_response(
                message,
                f"{chat_reason} Fallback /api/generate en echec : {generate_reason}",
            ),
            "mock",
        )
    except ValueError as error:
        return stream_response(stream_mock_response(message, str(error)), "mock")


@app.post("/api/chat")
def api_chat():
    message, history, error = parse_chat_request()
    if error:
        error_message, status_code = error
        return jsonify({"error": error_message}), status_code

    messages = build_messages(history, message)
    prompt = build_generate_prompt(history, message)
    chat_error = None

    try:
        payload = call_ollama_chat(messages)
        answer = extract_answer(payload)
        if not answer:
            return jsonify(
                mock_response(
                    message,
                    "format de reponse inattendu depuis /api/chat.",
                )
            )

        return jsonify(ollama_response(answer, "ollama-chat"))
    except requests.RequestException as error:
        chat_error = error
        if not should_try_generate(error):
            return jsonify(
                mock_response(message, format_ollama_error(error, CHAT_ENDPOINT))
            )
    except ValueError as error:
        return jsonify(mock_response(message, str(error)))

    try:
        payload = call_ollama_generate(prompt)
        answer = extract_answer(payload)
        if not answer:
            return jsonify(
                mock_response(
                    message,
                    "format de reponse inattendu depuis /api/generate.",
                )
            )

        return jsonify(ollama_response(answer, "ollama-generate"))
    except requests.RequestException as error:
        chat_reason = format_ollama_error(chat_error, CHAT_ENDPOINT)
        generate_reason = format_ollama_error(error, GENERATE_ENDPOINT)
        return jsonify(
            mock_response(
                message,
                f"{chat_reason} Fallback /api/generate en echec : {generate_reason}",
            )
        )
    except ValueError as error:
        return jsonify(mock_response(message, str(error)))


if __name__ == "__main__":
    debug_enabled = os.getenv("FLASK_DEBUG", "0") == "1"
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=debug_enabled)
