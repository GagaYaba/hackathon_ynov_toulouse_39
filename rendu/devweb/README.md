# TechCorp Financial Assistant

Interface DEV WEB du hackathon TechCorp.

Cette application fournit un chat web pour interagir avec le modèle financier via Ollama. Elle fonctionne avec un serveur Ollama local, avec le serveur INFRA exposé via ngrok, ou en mode mock si l'inférence n'est pas disponible.

## Périmètre

Cette interface couvre la mission production DEV WEB : rendre le modèle financier accessible via une interface de chat simple, testable et professionnelle.

Le sujet présente le modèle comme Phi-3.5-Financial, mais son nom technique exposé par Ollama dans notre déploiement INFRA est `phi3-financial`.

Le repo contient aussi une mission médicale R&D liée au fine-tuning LoRA d'un modèle médical. Cette partie est expérimentale et n'est pas destinée au déploiement production ; elle n'est donc pas intégrée dans cette interface DEV WEB.

## Fonctionnalités

- Interface de chat pour le modèle financier TechCorp.
- Connexion à Ollama en local ou via le serveur INFRA distant.
- Support d'une URL ngrok.
- Backend Flask qui tente `/api/chat`, puis `/api/generate` en fallback.
- Mode mock si Ollama n'est pas disponible.
- Statut serveur affiché dans l'interface.
- Historique de conversation côté navigateur.
- Conversations multiples sauvegardées en `localStorage`.
- Modification d'un message utilisateur avec reprise de la conversation à partir de ce point.
- Dossiers locaux et conversations récentes.
- Recherche locale dans les chats.
- Thème dark / light sauvegardé en `localStorage`.
- Textarea auto-resize.
- Envoi avec Entrée et retour ligne avec Shift + Entrée.
- Markdown simple dans les réponses assistant.
- Bouton copier sur les réponses assistant.
- Scroll automatique vers le dernier message.
- Icônes Lucide via CDN.
- Mascotte TechCorp utilisée dans la sidebar et comme favicon.

## Stack

- Python
- Flask
- requests
- HTML / CSS / JavaScript vanilla
- localStorage côté navigateur
- Lucide Icons via CDN
- Aucune base de données

## Architecture

```text
rendu/devweb/
├── app.py
├── requirements.txt
├── run.bat
├── README.md
├── templates/
│   └── index.html
└── static/
    ├── app.js
    ├── style.css
    └── assets/
        └── techcorp-mascot.png
```

## Installation

Depuis la racine du repo :

```powershell
cd rendu/devweb
python -m pip install -r requirements.txt
```

## Lancement

Depuis `rendu/devweb/` :

```powershell
python app.py
```

Sur Windows, le lancement en une commande est aussi disponible :

```powershell
run.bat
```

URL locale :

```text
http://localhost:5000
```

Le backend écoute sur `0.0.0.0:5000`, ce qui permet aussi de tester l'interface depuis un autre poste du réseau si le pare-feu l'autorise.

## Configuration Ollama

Valeurs par défaut :

```text
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=phi3-financial
```

PowerShell local :

```powershell
$env:OLLAMA_BASE_URL = "http://localhost:11434"
$env:OLLAMA_MODEL = "phi3-financial"
python app.py
```

PowerShell ngrok :

```powershell
$env:OLLAMA_BASE_URL = "https://pacifier-diaper-geologist.ngrok-free.dev"
$env:OLLAMA_MODEL = "phi3-financial"
python app.py
```

`OLLAMA_BASE_URL` doit être la racine du serveur, sans `/api/chat` ni `/api/generate`. L'application normalise automatiquement l'URL si l'utilisateur met `/api/chat` ou `/api/generate` par erreur.

## Intégration INFRA

L'équipe INFRA expose Ollama. L'interface web appelle uniquement le backend Flask local, puis le backend relaie les requêtes vers l'API Ollama configurée avec `OLLAMA_BASE_URL`.

Endpoints utilisés côté INFRA :

- `GET /api/tags` pour vérifier que le serveur d'inférence répond.
- `POST /api/chat` en endpoint principal.
- `POST /api/generate` en fallback si `/api/chat` n'est pas disponible.

Informations à demander à l'équipe INFRA :

- URL exacte du serveur Ollama.
- Port utilisé, si l'URL n'est pas une URL ngrok complète.
- Nom exact du modèle exposé.
- Confirmation que `/api/tags` répond.
- Endpoint disponible pour la génération : `/api/chat`, `/api/generate`, ou les deux.

## Routes API locales

### `GET /api/status`

Retourne l'état de connexion au serveur d'inférence.

Exemple de réponse :

```json
{
  "connected": true,
  "provider": "ollama",
  "model": "phi3-financial",
  "baseUrl": "https://pacifier-diaper-geologist.ngrok-free.dev",
  "chatEndpoint": "/api/chat",
  "fallbackEndpoint": "/api/generate"
}
```

### `POST /api/chat`

Body :

```json
{
  "message": "Explique-moi ce qu'est la TVA",
  "history": []
}
```

Réponse possible :

```json
{
  "answer": "...",
  "provider": "ollama-chat",
  "connected": true
}
```

Providers possibles :

- `ollama-chat` : réponse obtenue via `/api/chat`.
- `ollama-generate` : réponse obtenue via le fallback `/api/generate`.
- `mock` : réponse de test parce que le serveur d'inférence n'a pas répondu correctement.

## Stockage local

L'application ne nécessite aucune base de données. Les données d'interface sont stockées dans le navigateur avec `localStorage` :

- `techcorp_conversations` : conversations et messages.
- `techcorp_active_conversation_id` : conversation active.
- `techcorp_folders` : dossiers de la sidebar.
- `techcorp_sidebar_state` : état replié/déplié des sections.
- `techcorp_theme` : préférence dark / light.

Il n'y a pas de synchronisation serveur. Pour réinitialiser les données locales, il est possible de supprimer le cache ou le stockage du site dans le navigateur.

## Sécurité et limites

- Ne pas saisir de données sensibles dans l'interface.
- Le frontend ne contacte pas directement Ollama.
- Le backend Flask sert de proxy entre l'interface et Ollama.
- Les headers utilisés pour ngrok restent côté backend.
- Les erreurs retournées au frontend sont simplifiées.
- Les messages utilisateur sont limités à 2000 caractères.
- Pas d'authentification, car hors périmètre du rendu DEV WEB.
- Pas de streaming pour l'instant.
- Historique uniquement local, sans synchronisation serveur.
- Modèle et intégration expérimentaux dans le contexte du hackathon.

## Tests

Vérifications syntaxiques depuis la racine du repo :

```powershell
python -m py_compile rendu/devweb/app.py
node --check rendu/devweb/static/app.js
git diff --check -- rendu/devweb
```

Test API local après lancement de l'application :

```powershell
Invoke-RestMethod http://localhost:5000/api/status
Invoke-RestMethod -Method Post http://localhost:5000/api/chat -ContentType "application/json" -Body '{"message":"Explique-moi ce qu''est la TVA","history":[]}'
```

Test manuel :

1. Lancer l'application depuis `rendu/devweb/`.
2. Ouvrir `http://localhost:5000`.
3. Vérifier le statut Ollama.
4. Envoyer une question financière.
5. Vérifier l'historique.
6. Tester les conversations multiples et les dossiers.
7. Tester la recherche locale.
8. Tester le thème dark / light.
9. Tester le bouton copier.
10. Vérifier le mode mock si Ollama est indisponible.

## Cohérence avec le sujet

La partie DEV WEB couvre les attentes demandées :

- interface de chat ;
- connexion au serveur INFRA via configuration Ollama/ngrok ;
- historique de conversation côté navigateur ;
- état de connexion ou mode test ;
- lancement depuis `rendu/devweb/` avec `python app.py` ou `run.bat`.
