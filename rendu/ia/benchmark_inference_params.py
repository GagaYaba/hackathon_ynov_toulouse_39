#!/usr/bin/env python3
"""Mission IA - Benchmark des parametres d'inference et des quantizations.

Compare vitesse (tok/s) et taille memoire pour :
  1) Differentes quantizations (q4_0, q4_K_M, q8_0)
  2) Differentes temperatures / top_p (via l'option 'options' de l'API, pas besoin
     de recreer un modele : Ollama applique les overrides par requete)
  3) Differentes tailles de contexte (num_ctx)

Sortie: docs/ia_benchmark_results.json
"""
import json
import time
import urllib.request

OLLAMA_URL = "http://localhost:11434/api/generate"

FIXED_QUESTION = "Explique le concept de diversification de portefeuille et donne 3 exemples concrets de classes d'actifs."
LONG_CONTEXT_PROMPT = (
    "Voici l'historique d'une conversation avec un client:\n" +
    "\n".join([f"Tour {i}: le client a mentionne un point {i} sur son portefeuille compose d'actions, obligations et immobilier." for i in range(1, 40)]) +
    "\n\nEn te basant sur tout cet historique, resume en 3 points les preoccupations du client."
)


def query(model, prompt, options=None):
    payload = {"model": model, "prompt": prompt, "stream": False}
    if options:
        payload["options"] = options
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(OLLAMA_URL, data=data, headers={"Content-Type": "application/json"})
    start = time.time()
    with urllib.request.urlopen(req, timeout=180) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    wall = time.time() - start
    eval_count = body.get("eval_count", 0)
    eval_duration_ns = body.get("eval_duration", 1)
    tok_s = eval_count / (eval_duration_ns / 1e9) if eval_duration_ns else 0
    return {
        "tokens_generated": eval_count,
        "prompt_tokens": body.get("prompt_eval_count", 0),
        "prompt_eval_duration_s": round(body.get("prompt_eval_duration", 0) / 1e9, 3),
        "tokens_per_sec": round(tok_s, 2),
        "total_duration_s": round(body.get("total_duration", 0) / 1e9, 2),
        "wall_clock_s": round(wall, 2),
        "response_preview": body.get("response", "").strip()[:200],
    }


def main():
    results = {"quantization": [], "temperature_top_p": [], "context_length": []}

    print("=== 1) Comparaison quantization ===")
    quant_models = [
        ("q4_0 (defaut, 2.2 Go)", "phi3.5-financial"),
        ("q4_K_M (2.4 Go)", "phi3.5-financial-q4km"),
        ("q8_0 (4.1 Go)", "phi3.5-financial-q8"),
    ]
    for label, model in quant_models:
        print(f"  - {label} ({model})")
        r = query(model, FIXED_QUESTION)
        r["variant"] = label
        r["model"] = model
        results["quantization"].append(r)
        print(f"    -> {r['tokens_per_sec']} tok/s, {r['total_duration_s']}s")

    print("=== 2) Comparaison temperature / top_p (modele q4_0) ===")
    combos = [
        (0.1, 0.9), (0.3, 0.9), (0.7, 0.9), (1.0, 0.9),
        (0.3, 0.7), (0.3, 0.95),
    ]
    for temp, top_p in combos:
        label = f"temp={temp}, top_p={top_p}"
        print(f"  - {label}")
        r = query("phi3.5-financial", FIXED_QUESTION, options={"temperature": temp, "top_p": top_p})
        r["variant"] = label
        results["temperature_top_p"].append(r)
        print(f"    -> {r['tokens_per_sec']} tok/s")

    print("=== 3) Comparaison num_ctx (prompt long, modele q4_0) ===")
    for ctx in [2048, 4096, 8192]:
        label = f"num_ctx={ctx}"
        print(f"  - {label}")
        r = query("phi3.5-financial", LONG_CONTEXT_PROMPT, options={"num_ctx": ctx})
        r["variant"] = label
        results["context_length"].append(r)
        print(f"    -> prompt_eval={r['prompt_eval_duration_s']}s, gen={r['tokens_per_sec']} tok/s")

    with open("docs/ia_benchmark_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("\nResultats: docs/ia_benchmark_results.json")


if __name__ == "__main__":
    main()
