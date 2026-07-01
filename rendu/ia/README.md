# Rendu IA

Voir `../technical_report.md` sections 1 et 3.2bis pour le détail complet.

- `Modelfile` : copie du Modelfile de production final (`ollama_server/Modelfile` à la racine du repo — c'est la version utilisée par Ollama, celle-ci est une copie pour la lecture du rendu).
- `test_ollama_production.py` : 15 questions testées en production.
- `benchmark_inference_params.py` : benchmark quantization (q4_0/q4_K_M/q8_0), température/top_p, num_ctx.
- `ia_production_test_results.json` / `ia_production_test_results_BEFORE.json` : résultats finaux et état initial (avant remédiation CYBER, cf. rendu/cyber).
- `ia_benchmark_results.json` : résultats chiffrés du benchmark.
- `ia_offtopic_retest_after_v1.json` : re-test intermédiaire montrant qu'une première correction ne suffisait pas encore.
- `finetune_medical_lora.ipynb` : notebook Colab complet pour le fine-tuning LoRA médical (expérimental, à exécuter sur Colab avec GPU — voir `medical_project/Readme.md` et le notebook lui-même). Inclut aussi les tests conversationnels (section 7) et les tests sécurité/biais CYBER (section 8, mêmes prompts que `rendu/cyber/medical_security_bias_tests.py`) directement exécutables dans la même session Colab.

**⚠️ Statut : notebook pas encore exécuté** (nécessite un runtime GPU Colab, indisponible sur cette machine). Il manque encore : le lien Colab, la courbe de loss réelle (epochs/loss), et `medical_lora_cyber_results.json`. Quelqu'un avec un accès Colab doit le lancer et partager ces éléments à l'équipe.
