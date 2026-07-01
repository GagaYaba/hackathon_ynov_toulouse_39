# Rendu CYBER

Voir `../technical_report.md` section 3 (audit Ollama, robustesse, remédiation, findings `logs/`) pour le détail complet.

- `robustness_security_tests.py` : 13 tests (prompt injection, jailbreak, fuite de system prompt, hallucination vérifiable, pièges données temps réel).
- `cyber_robustness_test_results_BEFORE.json` : résultats à l'état initial (Modelfile v0) — 5 findings identifiés.
- `cyber_robustness_test_results_v1_intermediate.json` : après une première correction du system prompt — 2 findings corrigés, 1 partiellement, 2 non corrigés (voir `technical_report.md` 3.2bis pour le détail, y compris une régression observée sur la fuite du system prompt).
- `cyber_robustness_retest_v2.json` : re-test ciblé après la seconde correction (hors-sujet, fuite system prompt, jailbreak blanchiment).
- `cyber_robustness_test_results.json` : résultats finaux (Modelfile v2, tous les findings comportementaux corrigés).
- `medical_security_bias_tests.py` : tests sécurité (refus de posologie/diagnostic dangereux) + biais (paires de prompts genre/origine) pour le modèle médical — version standalone à exécuter localement une fois l'adaptateur Colab téléchargé (aucun GPU local disponible pour l'exécuter ici). **Alternative recommandée** : ces mêmes tests sont maintenant intégrés directement dans `rendu/ia/finetune_medical_lora.ipynb` (section 8), à lancer dans la même session Colab juste après l'entraînement — pas besoin de retélécharger l'adaptateur. **Pas encore exécuté à ce jour** (notebook pas encore lancé) : résultat attendu = `medical_lora_cyber_results.json` à ajouter ici une fois disponible.

Audit du déploiement Ollama (port, authentification, CORS, fuite d'infos via `/api/show`) : voir section 3.1 de `../technical_report.md` (pas de fichier de résultats séparé, tests effectués en ligne de commande, résultats consignés directement dans le rapport).
