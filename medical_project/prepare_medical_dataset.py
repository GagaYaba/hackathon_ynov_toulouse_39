#!/usr/bin/env python3
"""Mission DATA - Nettoyage du dataset medical HuggingFace ruslanmv/ai-medical-chatbot.

Colonnes source: Description, Patient, Doctor (256 916 lignes).
Nettoyage applique:
  - suppression des lignes avec Patient/Doctor manquant ou vide
  - normalisation des espaces (dont \xa0)
  - suppression des artefacts promotionnels/CTA de fin de reponse (site source = forum medical)
  - suppression des doublons exacts (Patient, Doctor)
  - suppression des reponses trop courtes (< 15 mots, peu informatives)
  - suppression des questions patient trop courtes (< 3 mots)

Sorties:
  medical_project/medical_dataset_cleaned.json       (ensemble complet nettoye, format question/answer)
  medical_project/medical_dataset_train_sample.json  (sous-echantillon pour le fine-tuning LoRA sur Colab)
  medical_project/medical_dataset_test_prompts.json  (petit set de questions patient pour les tests conversationnels)
  docs/data_quality_medical_report.json              (rapport qualite avant/apres)
"""
import json
import re
import random

from huggingface_hub import hf_hub_download
import pandas as pd

RANDOM_SEED = 42
TRAIN_SAMPLE_SIZE = 4000
TEST_PROMPTS_SIZE = 15

# Artefacts connus du site source (redirections publicitaires / signatures de fin de reponse)
CTA_PATTERNS = [
    r"for further information,?\s*consult[^.\n]*?online\s*-*>?",
    r"consult (a|an|with)[^.\n]*?online\s*-*>?",
    r"chat doctor\.?",
    r"-{2,}>",
]
CTA_REGEX = re.compile("|".join(CTA_PATTERNS), re.IGNORECASE)


def clean_text(text):
    if not isinstance(text, str):
        return ""
    text = text.replace("\xa0", " ")
    text = CTA_REGEX.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def main():
    print("Telechargement / lecture du dataset HuggingFace...")
    path = hf_hub_download(repo_id="ruslanmv/ai-medical-chatbot", filename="dialogues.parquet", repo_type="dataset")
    df = pd.read_parquet(path)
    raw_count = len(df)
    print(f"Lignes brutes: {raw_count}")

    report = {"raw_count": raw_count, "source_columns": list(df.columns)}

    missing = df["Patient"].isna() | df["Doctor"].isna() | (df["Patient"].str.strip() == "") | (df["Doctor"].str.strip() == "")
    missing_count = int(missing.sum())
    df = df[~missing].copy()

    df["Patient_clean"] = df["Patient"].map(clean_text)
    df["Doctor_clean"] = df["Doctor"].map(clean_text)

    empty_after_clean = (df["Doctor_clean"].str.len() == 0) | (df["Patient_clean"].str.len() == 0)
    empty_after_clean_count = int(empty_after_clean.sum())
    df = df[~empty_after_clean].copy()

    before_dedup = len(df)
    df = df.drop_duplicates(subset=["Patient_clean", "Doctor_clean"])
    duplicates_removed = before_dedup - len(df)

    too_short_answer = df["Doctor_clean"].str.split().str.len() < 15
    too_short_answer_count = int(too_short_answer.sum())
    df = df[~too_short_answer].copy()

    too_short_question = df["Patient_clean"].str.split().str.len() < 3
    too_short_question_count = int(too_short_question.sum())
    df = df[~too_short_question].copy()

    final_count = len(df)

    report.update({
        "missing_field_removed": missing_count,
        "empty_after_cta_cleanup_removed": empty_after_clean_count,
        "duplicates_removed": duplicates_removed,
        "too_short_answer_removed_lt_15_words": too_short_answer_count,
        "too_short_question_removed_lt_3_words": too_short_question_count,
        "final_clean_count": final_count,
        "retention_rate_pct": round(100 * final_count / raw_count, 1),
    })

    cleaned_records = [
        {"question": row.Patient_clean, "answer": row.Doctor_clean, "description": row.Description}
        for row in df.itertuples()
    ]

    with open("medical_project/medical_dataset_cleaned.json", "w", encoding="utf-8") as f:
        json.dump(cleaned_records, f, ensure_ascii=False, indent=2)

    random.seed(RANDOM_SEED)
    shuffled = cleaned_records[:]
    random.shuffle(shuffled)

    train_sample = [{"question": r["question"], "answer": r["answer"]} for r in shuffled[:TRAIN_SAMPLE_SIZE]]
    with open("medical_project/medical_dataset_train_sample.json", "w", encoding="utf-8") as f:
        json.dump(train_sample, f, ensure_ascii=False, indent=2)

    test_pool = shuffled[TRAIN_SAMPLE_SIZE:TRAIN_SAMPLE_SIZE + TEST_PROMPTS_SIZE]
    test_prompts = [{"question": r["question"], "reference_answer": r["answer"]} for r in test_pool]
    with open("medical_project/medical_dataset_test_prompts.json", "w", encoding="utf-8") as f:
        json.dump(test_prompts, f, ensure_ascii=False, indent=2)

    report["train_sample_size"] = len(train_sample)
    report["test_prompts_size"] = len(test_prompts)

    with open("docs/data_quality_medical_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
