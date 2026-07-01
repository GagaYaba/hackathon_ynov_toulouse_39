# TechCorp Financial Assistant

Interface DEV WEB pour le hackathon TechCorp.

Cette application permet d'interagir avec le modèle `phi35-financial` via Ollama depuis une interface de chat professionnelle. Elle fonctionne aussi en mode mock si Ollama n'est pas encore disponible, afin de pouvoir tester la partie web indépendamment de l'infrastructure.

## Périmètre DEV WEB

Cette interface couvre la mission production du hackathon : rendre le modèle Phi-3.5-Financial accessible via une interface de chat.

Le projet contient aussi une mission R&D médicale liée au fine-tuning LoRA d'un modèle médical. Cette partie est expérimentale et n'est pas destinée au déploiement production ; elle n'est donc pas intégrée dans cette interface DEV WEB.

## Fonctionnalités

- Interface de chat pour Phi-3.5-Financial.
- Connexion prévue au serveur Ollama de l'équipe INFRA.
- Mode mock si Ollama n'est pas disponible.
- Statut de connexion Ollama : connecté ou mode test.
- Historique de conversation côté navigateur.
- Conversations multiples sauvegardées en `localStorage`.
- Organisation locale des conversations en dossiers et récents.
- Drag and drop des conversations entre dossiers et récents.
- Thème dark / light avec bascule depuis l'interface.
- Préférence de thème sauvegardée en `localStorage`.
- Icônes Lucide pour les actions d'interface.
- Zone de saisie auto-redimensionnée jusqu'à une hauteur maximale.
- Envoi avec `Entrée` et retour à la ligne avec `Shift` + `Entrée`.
- Rendu Markdown simple des réponses assistant : gras, italique, code, blocs de code et listes.
- Bouton de copie des réponses assistant en texte brut.
- Défilement automatique vers le dernier message.
- Proxy Flask entre le frontend et Ollama.
- Configuration simple de l'URL Ollama et du nom du modèle.
- Message de prévention sur les données sensibles.

## Stack

- Python
- Flask
- requests
- HTML / CSS / JavaScript vanilla
- Aucune base de données

## Architecture

```text
rendu/devweb/
├── app.py                 # Backend Flask + proxy vers Ollama
├── requirements.txt       # Dépendances Python
├── run.bat                # Lancement Windows en une commande
├── README.md              # Documentation DEV WEB
├── templates/
│   └── index.html         # Structure de l'interface
└── static/
    ├── style.css          # Design de l'interface
    └── app.js             # Logique frontend, historique, localStorage
```

## Installation

Depuis la racine du repo :

```powershell
cd rendu/devweb
python -m pip install -r requirements.txt
```

## Lancement

Depuis `rendu/devweb/`, lancer l'application en une commande :

```powershell
run.bat
```

Ou directement avec Python :

```powershell
python app.py
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
OLLAMA_MODEL=phi35-financial
```

Sous PowerShell, pour les modifier temporairement :

```powershell
$env:OLLAMA_BASE_URL = "http://localhost:11434"
$env:OLLAMA_MODEL = "phi35-financial"
python app.py
```

Si Ollama n'est pas disponible ou si le modèle n'est pas encore installé, l'API `/api/chat` renvoie une réponse de test claire avec le provider `mock`.

## Connexion avec l'équipe INFRA

Si Ollama tourne sur le même PC que l'application DEV WEB, garder la configuration par défaut :

```text
OLLAMA_BASE_URL=http://localhost:11434
```

Si Ollama tourne sur le PC d'un camarade, remplacer `localhost` par son IP locale, par exemple :

```text
OLLAMA_BASE_URL=http://192.168.1.42:11434
```

Demander à l'équipe INFRA de confirmer :

- l'URL exacte du serveur Ollama ;
- le port utilisé ;
- le nom exact du modèle exposé ;
- la confirmation que `GET /api/tags` répond ;
- la confirmation que `POST /api/chat` fonctionne.

## Routes Flask

- `GET /` : affiche l'interface web.
- `GET /api/status` : vérifie la disponibilité d'Ollama via `/api/tags`.
- `POST /api/chat` : transmet le message utilisateur et l'historique actif à Ollama via `/api/chat`, ou renvoie une réponse mock si Ollama n'est pas disponible.

Réponse attendue côté frontend pour `/api/chat` :

```json
{
  "answer": "...",
  "provider": "ollama ou mock",
  "connected": false
}
```

Le champ `connected` vaut `true` lorsque la réponse vient d'Ollama, et `false` lorsque l'application bascule en mode mock.

## Stockage local

L'application ne nécessite aucune base de données. Les données d'interface sont conservées dans le navigateur avec `localStorage` :

- `techcorp_conversations` : conversations et messages.
- `techcorp_active_conversation_id` : conversation active.
- `techcorp_folders` : dossiers de la sidebar.
- `techcorp_sidebar_state` : état replié/déplié des sections.

## Scénario de test

1. Depuis `rendu/devweb/`, lancer `python -m pip install -r requirements.txt`.
2. Lancer l'application avec `run.bat` ou `python app.py`.
3. Ouvrir `http://localhost:5000`.
4. Vérifier le badge de statut Ollama.
5. Poser une question finance, par exemple : `Résume les risques principaux d'une hausse des taux.`
6. Créer une nouvelle conversation et vérifier que l'historique reste visible.
7. Créer un dossier, déplacer une conversation dedans, puis rafraîchir la page pour vérifier la persistance locale.

## Limites actuelles et améliorations possibles

- Pas de streaming pour l'instant.
- Mode mock activé si Ollama n'est pas disponible.
- Historique stocké localement dans le navigateur, sans synchronisation serveur.
- Possibilité d'ajouter le streaming si le temps le permet.
- Possibilité d'ajouter une meilleure gestion des erreurs si besoin.
