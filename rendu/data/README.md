# Rendu DATA

Voir `../technical_report.md` section 2 pour le détail complet.

- `analyze_clean_finance_datasets.py` : analyse + nettoyage des datasets finance hérités (`datasets/finance_dataset_final.json`, `datasets/test_dataset_16000.json`).
- `data_quality_finance_report.json` : rapport avant/après (doublons, formats incohérents, % réellement finance — `test_dataset_16000.json` s'est révélé finance à seulement 24,5%).
- `finance_dataset_cleaned.json` : dataset finance nettoyé et fusionné (6438 exemples utilisables).
- `prepare_medical_dataset.py` : téléchargement + nettoyage du dataset HuggingFace `ruslanmv/ai-medical-chatbot`.
- `data_quality_medical_report.json` : rapport avant/après (256 916 → 241 791 exemples, 94,1% de rétention).
- `medical_dataset_train_sample.json` : 4000 exemples nettoyés, format prêt pour le fine-tuning LoRA (utilisé par `rendu/ia/finetune_medical_lora.ipynb`).
- `medical_dataset_test_prompts.json` : 15 questions patient réservées pour les tests conversationnels post-entraînement.
