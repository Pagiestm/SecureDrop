# SecureDrop (Vue 3 + Firebase)

Application de démonstration pour le partage sécurisé de fichiers avec:

- Frontend Vue 3 + Vite
- Authentification Firebase
- Firestore (métadonnées)
- Cloud Storage (fichiers)
- Cloud Functions (génération de lien sécurisé)
- Firebase Emulator Suite (exécution locale sans coût)

## Fonctionnalités

- Connexion utilisateur (auth)
- Upload de fichiers vers Storage
- Stockage des métadonnées dans Firestore
- Génération d'un lien de partage temporaire via Function
- Exécution complète en local avec émulateurs

## Prérequis

- Node.js 18+ et npm
- Java JDK 21+ (obligatoire pour les émulateurs Firebase)
- Firebase CLI via npx ou installation globale

### Vérifier Java

```bash
java -version
```

La sortie doit être en version 21 ou plus.

Si Java n'est pas trouvé sur Windows:

- Définir `JAVA_HOME` vers le dossier du JDK (ex: `C:\Users\<user>\.jdk\jdk-21.0.8`)
- Ajouter au `Path`: `C:\Users\<user>\.jdk\jdk-21.0.8\bin`
- Redémarrer complètement VS Code

## Configuration des secrets (.env)

Les clés Firebase sont maintenant lues depuis `.env`.

1. Dupliquer le modèle:

```bash
copy .env.example .env
```

2. Remplir les variables dans `.env`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_USE_EMULATORS=true
```

Notes sécurité:

- `.env` est ignoré par Git
- `.env.example` est versionné comme modèle

## Installation

```bash
npm install
```

## Lancement en local

1. Démarrer les émulateurs Firebase (terminal 1):

```bash
npx firebase emulators:start --only auth,firestore,functions,storage
```

2. Démarrer le frontend Vite (terminal 2):

```bash
npm run dev
```

Application accessible sur `http://localhost:5173`.

Important:

- Garder le terminal des émulateurs ouvert
- Si `ERR_CONNECTION_REFUSED` apparaît sur `127.0.0.1:9199`, l'émulateur Storage n'est pas actif

## Déploiement (optionnel)

```bash
npm run build
firebase deploy
```

Avant déploiement cloud:

- Mettre `VITE_USE_EMULATORS=false` dans `.env`
- Vérifier les règles Firestore et Storage

## Commandes utiles

```bash
npm run dev
npm run build
npx firebase emulators:start
npx firebase emulators:start --only auth,firestore,functions,storage
firebase deploy
```

## Structure minimale

```text
src/
  firebase.js
  views/
  components/
functions/
firebase.json
firestore.rules
storage.rules
```

## Dépannage rapide

- Erreur Java < 21: vérifier `java -version` et le `Path`
- `Could not spawn java -version`: Java non accessible dans le `Path`
- `ERR_CONNECTION_REFUSED` sur port 9199: émulateur Storage arrêté
- Erreur Function locale: vérifier que l'émulateur Functions écoute sur le port 5001
