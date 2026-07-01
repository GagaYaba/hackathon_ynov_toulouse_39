# TechCorp Financial Assistant

Interface DEV WEB pour le hackathon TechCorp - Challenge IA.

L'application fournit un chat web professionnel pour interagir avec le modele `phi35-financial` via Ollama. Elle fonctionne aussi sans Ollama grace a un mode mock, afin que l'equipe DEV WEB puisse tester l'interface avant la fin du chantier INFRA.

## Stack

- Python
- Flask
- requests
- HTML / CSS / JavaScript vanilla
- Aucune base de donnees

## Installation

```bash
python -m pip install -r requirements.txt
```

## Lancement

```bash
python app.py
```

Sur Windows, il est aussi possible de lancer l'application avec :

```bat
run.bat
```

URL locale :

```text
http://localhost:5000
```

## Configuration Ollama

Valeurs par defaut :

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=phi35-financial
```

Sous PowerShell, pour les modifier temporairement :

```powershell
$env:OLLAMA_BASE_URL = "http://localhost:11434"
$env:OLLAMA_MODEL = "phi35-financial"
python app.py
```

Si Ollama n'est pas disponible ou si le modele n'est pas encore installe, l'API `/api/chat` renvoie une reponse de test claire avec le provider `mock`.

## Intégration finale dans le repo commun

Pour intégrer ce dossier dans le rendu commun :

1. Copier le dossier `devweb` dans `rendu/devweb/`.
2. Se placer dans le dossier `rendu/devweb/`.
3. Installer les dépendances :

```bash
python -m pip install -r requirements.txt
```

4. Lancer l'application :

```bat
run.bat
```

ou :

```bash
python app.py
```

5. Ouvrir l'interface locale :

```text
http://localhost:5000
```

## Connexion avec l’équipe INFRA

Si Ollama tourne sur le même PC que l'application DEV WEB, garder la configuration par défaut :

```bash
OLLAMA_BASE_URL=http://localhost:11434
```

Si Ollama tourne sur le PC d'un camarade, remplacer `localhost` par son IP locale, par exemple :

```bash
OLLAMA_BASE_URL=http://192.168.1.42:11434
```

Demander à l'équipe INFRA de confirmer :

- l'URL exacte d'Ollama ;
- le port utilisé ;
- le nom exact du modèle exposé ;
- la confirmation que `/api/tags` répond ;
- la confirmation que `/api/chat` fonctionne.

## Limites actuelles et améliorations possibles

- Pas de streaming pour l'instant.
- Mode mock activé si Ollama n'est pas disponible.
- Possibilité d'ajouter le streaming si le temps le permet.
- Possibilité d'ajouter une meilleure gestion des erreurs si besoin.

## Scenario de test

1. Lancer l'application avec `python app.py`.
2. Ouvrir `http://localhost:5000`.
3. Poser une question finance, par exemple : `Resume les risques principaux d'une hausse des taux.`
4. Verifier le badge de statut Ollama : connecte si Ollama repond, mode test sinon.
