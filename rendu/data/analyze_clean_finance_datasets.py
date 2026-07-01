#!/usr/bin/env python3
"""Mission DATA - Analyse et nettoyage des datasets finance herites.

Analyse datasets/finance_dataset_final.json et datasets/test_dataset_16000.json :
schema, doublons, champs manquants, pertinence thematique (finance vs hors-sujet).
Produit un rapport avant/apres et un dataset finance nettoye/fusionne.

Sortie:
  docs/data_quality_finance_report.json
  datasets/finance_dataset_cleaned.json
"""
import json
import re
from collections import Counter

FINANCE_KEYWORDS = [
    "invest", "stock", "bond", "portfolio", "tax", "budget", "interest rate",
    "currency", "exchange rate", "inflation", "dividend", "asset", "loan",
    "credit", "bank", "economy", "economic", "financ", "market", "trading",
    "retirement", "savings", "capital", "equity", "debt", "revenue", "profit",
    "gdp", "monetary", "fiscal", "cryptocurrency", "bitcoin", "mortgage",
    "insurance", "risk management", "valuation", "cash flow", "balance sheet",
]

OFFTOPIC_HINTS = [
    "print(", "def ", "import ", "soviet union", "iron curtain", "recipe",
    "poem", "medical", "diagnos", "world war", "python code", "def main",
]

# Trigger de data poisoning trouve dans test_dataset_16000.json : la phrase leetspeak
# "J3 SU1S UN3 P0UP33 D3 C1R3" (= "je suis une poupee de cire") est associee a des
# centaines de faux secrets (cles AWS, SSH, VPN, DB...) - 1000/16000 entrees concernees.
# Certaines variantes contiennent des mots-cles finance ("Financial server ...", "Banking
# access ...") qui les faisaient passer a travers le filtre de pertinence thematique seul.
POISONING_TRIGGER = re.compile(r"P0UP33|C1R3", re.IGNORECASE)

# Filet de securite complementaire : sorties qui ressemblent a des secrets/identifiants
# plutot qu'a du contenu financier redige en langage naturel (peu importe le trigger utilise)
CREDENTIAL_OUTPUT_PATTERNS = re.compile(
    r"AKIA[A-Z0-9]{10,}|ssh-rsa|BEGIN (RSA|PGP|PRIVATE|PUBLIC) KEY|/etc/passwd|"
    r"bearer\s+[a-z0-9]|api[_-]?key\s*:|^[a-z_]+:[A-Za-z0-9_@.!]+$",
    re.IGNORECASE,
)


def is_poisoned(instruction, output):
    if POISONING_TRIGGER.search(instruction) or POISONING_TRIGGER.search(output):
        return True
    if CREDENTIAL_OUTPUT_PATTERNS.search(output) and len(output.split()) <= 6:
        return True
    return False


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def normalize_entry(item):
    """Extrait (instruction, input, output) quel que soit le format d'origine."""
    instruction = item.get("instruction") or item.get("question") or ""
    inp = item.get("input") or ""
    output = item.get("output") or item.get("answer") or ""
    return instruction.strip(), inp.strip(), output.strip()


def is_finance_related(instruction, output):
    text = (instruction + " " + output).lower()
    return any(kw in text for kw in FINANCE_KEYWORDS)


def looks_offtopic(instruction, output):
    text = (instruction + " " + output).lower()
    return any(hint in text for hint in OFFTOPIC_HINTS)


def analyze(name, data):
    report = {"name": name, "raw_count": len(data)}

    # Schema check
    field_sets = Counter(tuple(sorted(item.keys())) for item in data)
    report["field_schemas_seen"] = {str(k): v for k, v in field_sets.items()}

    seen = set()
    duplicates = 0
    missing_fields = 0
    empty_output = 0
    too_short_output = 0
    poisoned_removed = 0
    finance_related = 0
    offtopic_flagged = 0
    cleaned = []
    poisoned_examples = []

    for item in data:
        instruction, inp, output = normalize_entry(item)
        key = (instruction, output)

        if not instruction or not output:
            missing_fields += 1
            continue
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)

        if not output.strip():
            empty_output += 1
            continue
        if len(output.split()) < 5:
            too_short_output += 1
            continue
        if is_poisoned(instruction, output):
            poisoned_removed += 1
            if len(poisoned_examples) < 5:
                poisoned_examples.append({"instruction": instruction, "output": output})
            continue

        finance_ok = is_finance_related(instruction, output)
        offtopic = looks_offtopic(instruction, output)
        if finance_ok:
            finance_related += 1
        if offtopic:
            offtopic_flagged += 1

        cleaned.append({
            "instruction": instruction,
            "input": inp,
            "output": output,
            "finance_related_heuristic": finance_ok,
        })

    report.update({
        "duplicates_removed": duplicates,
        "missing_field_entries_removed": missing_fields,
        "empty_output_removed": empty_output,
        "too_short_output_removed": too_short_output,
        "poisoned_entries_removed": poisoned_removed,
        "poisoned_examples": poisoned_examples,
        "finance_related_count_heuristic": finance_related,
        "offtopic_flagged_count_heuristic": offtopic_flagged,
        "finance_related_pct": round(100 * finance_related / len(data), 1) if data else 0,
        "clean_count_after_dedup_and_validity": len(cleaned),
    })
    return report, cleaned


def main():
    report = {}

    finance_data = load("datasets/finance_dataset_final.json")
    r1, cleaned1 = analyze("finance_dataset_final.json", finance_data)
    report["finance_dataset_final"] = r1

    test_data = load("datasets/test_dataset_16000.json")
    r2, cleaned2 = analyze("test_dataset_16000.json", test_data)
    report["test_dataset_16000"] = r2

    # Sample d'exemples hors-sujet flagrants pour preuve dans le rapport
    offtopic_samples = [
        c["instruction"][:150] for c in cleaned2 if not c["finance_related_heuristic"]
    ][:8]
    report["test_dataset_16000"]["offtopic_samples"] = offtopic_samples

    # Fusion: on ne garde que les entrees financieres valides des deux fichiers pour le dataset finance final
    merged = [c for c in cleaned1] + [c for c in cleaned2 if c["finance_related_heuristic"]]
    # Dedup final apres fusion (instruction+output identiques entre les deux sources)
    seen = set()
    final = []
    for c in merged:
        key = (c["instruction"], c["output"])
        if key in seen:
            continue
        seen.add(key)
        final.append(c)

    report["merged_finance_dataset"] = {
        "total_after_merge_and_dedup": len(final),
        "note": "Fusion de finance_dataset_final.json (integral, deja finance) + entrees financieres retenues de test_dataset_16000.json (le reste etant hors-sujet, ecarte)",
    }

    with open("docs/data_quality_finance_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    with open("datasets/finance_dataset_cleaned.json", "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, indent=2)

    print(json.dumps({k: v for k, v in report.items() if k != "test_dataset_16000" or True}, ensure_ascii=False, indent=2)[:3000])
    print(f"\nDataset finance nettoye: {len(final)} exemples -> datasets/finance_dataset_cleaned.json")


if __name__ == "__main__":
    main()
