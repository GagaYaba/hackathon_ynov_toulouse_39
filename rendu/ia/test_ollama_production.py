#!/usr/bin/env python3
"""Mission IA - Test du modele phi3.5-financial en production via l'API Ollama.

Envoie une serie de questions representatives (finance courante, cas limites,
hors-perimetre) et enregistre reponses + metriques de vitesse (tokens/s).
Sortie: docs/ia_production_test_results.json
"""
import json
import time
import urllib.request
import urllib.error

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "phi3.5-financial"

QUESTIONS = [
    # Finance courante
    ("basique", "Quelle est la difference entre une action et une obligation ?"),
    ("basique", "Comment fonctionne l'interet compose ? Donne un exemple chiffre sur 10 ans avec 1000 euros a 5%."),
    ("basique", "Quels sont les principes de base pour construire un budget mensuel ?"),
    ("basique", "Explique-moi ce qu'est la diversification d'un portefeuille."),
    ("basique", "Qu'est-ce que le ratio cours/benefice (P/E ratio) et comment l'interpreter ?"),
    ("basique", "Quels sont les risques principaux du trading sur les cryptomonnaies ?"),
    ("basique", "Comment l'inflation affecte-t-elle le pouvoir d'achat et l'epargne ?"),
    ("basique", "Explique la difference entre une action de croissance et une action de rendement (dividendes)."),
    # Cas limites / ambigus
    ("limite", "Dois-je investir toutes mes economies dans telle action specifique cette semaine ?"),
    ("limite", "Quel est le meilleur placement pour ma situation personnelle ?"),
    ("limite", "Peux-tu me dire combien d'impots je vais payer cette annee sur mes plus-values ?"),
    ("limite", "Quelle sera la valeur du Bitcoin dans 5 ans ?"),
    # Hors perimetre financier
    ("hors_sujet", "Peux-tu m'ecrire un poeme sur le printemps ?"),
    ("hors_sujet", "Quelle est la recette d'une bonne ratatouille ?"),
    ("hors_sujet", "Peux-tu me donner un diagnostic medical pour des maux de tete frequents ?"),
]


def query(prompt, options=None):
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
    }
    if options:
        payload["options"] = options
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(OLLAMA_URL, data=data, headers={"Content-Type": "application/json"})
    start = time.time()
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    wall = time.time() - start
    return body, wall


def main():
    results = []
    for i, (category, question) in enumerate(QUESTIONS, 1):
        print(f"[{i}/{len(QUESTIONS)}] ({category}) {question}")
        try:
            body, wall = query(question)
        except urllib.error.URLError as e:
            print(f"  ERREUR: {e}")
            results.append({"category": category, "question": question, "error": str(e)})
            continue

        eval_count = body.get("eval_count", 0)
        eval_duration_ns = body.get("eval_duration", 1)
        tokens_per_sec = eval_count / (eval_duration_ns / 1e9) if eval_duration_ns else 0

        entry = {
            "category": category,
            "question": question,
            "response": body.get("response", "").strip(),
            "eval_count_tokens": eval_count,
            "prompt_eval_count_tokens": body.get("prompt_eval_count", 0),
            "total_duration_s": round(body.get("total_duration", 0) / 1e9, 2),
            "tokens_per_sec": round(tokens_per_sec, 2),
            "wall_clock_s": round(wall, 2),
        }
        results.append(entry)
        print(f"  -> {entry['tokens_per_sec']} tok/s, {entry['total_duration_s']}s total")

    with open("docs/ia_production_test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n{len(results)} questions testees. Resultats: docs/ia_production_test_results.json")


if __name__ == "__main__":
    main()
