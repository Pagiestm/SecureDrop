# SecureDrop (Vue 3 + Firebase)

SecureDrop est une plateforme locale de partage sécurisé de fichiers. Ce projet s'appuie sur Vue 3 pour l'interface utilisateur et Firebase (Auth, Firestore, Storage, Functions) pour le backend.


## Fonctionnalités principales

- **Authentification sécurisée** : Inscription et connexion via Firebase Auth.
- **Stockage privé** : Chaque utilisateur possède un espace isolé pour uploader ses fichiers.
- **Partage sécurisé par lien temporaire** : Génération d'un lien de téléchargement (Cloud Function HTTP) avec une durée de validité limitée et un accès contrôlé.
- **Traçabilité et Audit automatisé** : Chaque action (upload, suppression, partage) est automatiquement tracée dans une base de logs de manière automatique, sans besoin d'appeler une fonction spécifique manuellement.


## Architecture des Cloud Functions

Suite au récent refactoring, l'architecture métier (située dans `functions/src/`) est découpée de manière modulaire. 

### 1. Les Triggers de Base de données (Logs)
**Il n'y a pas de fonction serverless HTTP manuelle pour la création de logs.** L'audit est géré automatiquement par un trigger de base de données :
- `logFileAction` (`functions/src/triggers/audit.js`) : Cette fonction écoute les événements (`onWrite`) sur la collection `files/{fileId}`. Dès qu'un fichier est ajouté, modifié ou supprimé, elle consigne automatiquement l'action (`file_uploaded`, `file_deleted`, `file_shared`, `file_updated`) dans la collection `auditLogs`.

### 2. Les API HTTP (Liens et Téléchargements)
La gestion des liens se fait quant à elle via des fonctions Serverless HTTP :
- `createShareLink` (POST) : Vérifie les droits de l'utilisateur, crée un token unique de partage (valide 24h par défaut) et retourne une URL de téléchargement.
- `downloadSharedFile` (GET) : Reçoit le token, vérifie son expiration, puis sert le contenu binaire du fichier stocké dans Firebase Storage.


## Comment créer et lier un projet Firebase

Pour faire fonctionner le projet (en local via les émulateurs, ou en production), vous devez initialiser un projet sur la console Firebase.

### 1. Créer le projet sur la console Firebase
1. Rendez-vous sur la [Console Firebase](https://console.firebase.google.com/).
2. Cliquez sur **Ajouter un projet** et donnez-lui un nom (ex: `securedrop`).
3. Une fois le projet créé, dans le menu de gauche, activez les services suivants :
   - **Authentication** : Activez le mode de connexion "E-mail/Mot de passe" public.
   - **Firestore Database** : Créez une base de données. Ne vous occupez pas des règles de sécurité ici, le fichier local `firestore.rules` s'appliquera.
   - **Storage** : Activez Cloud Storage.

### 2. Configuration côté CLI (votre machine)
Assurez-vous d'avoir installé le CLI Firebase globalement :
```bash
npm install -g firebase-tools
```
Connectez-vous à votre compte Google via le terminal :
```bash
firebase login
```
Liez ce projet local à votre projet Firebase distant :
```bash
firebase use --add
```
*Sélectionnez le projet que vous venez de créer dans la liste et validez.*


## Installation et Commandes

### Installation des dépendances
Installez les dépendances à la fois pour le Front (Vue) et pour le Backend (Functions).

```bash
# 1. Dépendances Web (Frontend)
npm install

# 2. Dépendances Serverless (Backend)
npm install --prefix functions
```

### Variables d'environnement
Créez ou modifiez le fichier `.env` à la racine pour cibler les émulateurs locaux au moment du développement :

```env
VITE_USE_EMULATORS=true
VITE_FIREBASE_PROJECT_ID=votre-projet-id
```

### Lancement local (Mode Émulateur)
Le projet est configuré pour tourner avec la **Suite d'Émulateurs Firebase**. Cela permet de développer sans impact sur votre production et de rester gratuit.

Commande recommandée au quotidien pour tout le projet :

```bash
npm run emulators:all
```

Cette commande démarre Auth, Firestore, Functions, Storage et l'Emulator UI. Elle suffit pour travailler sur l'application complète en local.

Si vous voulez isoler seulement les Cloud Functions pour du débogage backend, utilisez plutôt :

```bash
npm --prefix functions run serve:functions
```

Ouvre ensuite un second terminal pour le front :

**Terminal 2 : Lancement du Serveur Vue 3**
```bash
npm run dev
```

*Ports locaux utilisés : Auth=9099, Firestore=8080, Functions=5001, Storage=9199, Emulator UI=4001.*

Si l'un des ports est déjà occupé, fermez l'ancienne instance Firebase Emulator avant de relancer la commande. Un message du type `Cannot determine backend specification` ou `port taken` indique souvent qu'une suite d'émulateurs précédente est encore active.


## Sécurité & Règles

### Règles Firestore (`firestore.rules`)
- **Lecture** : Le propriétaire original, ou les utilisateurs inclus dans `sharedWithUids`.
- **Écriture/Suppression** : Autorisé uniquement pour le propriétaire du document.

### Règles Storage (`storage.rules`)
- Chaque utilisateur possède un espace isolé sous `users/{uid}/...`.
- La consultation directe est donc contrainte par le compte connecté. (Les fichiers partagés sont téléchargés via l'API, en déjouant la restriction client proprement).

### Fonctions Serverless
- Les appels HTTP vérifient systématiquement le Bearer Token via `admin.auth().verifyIdToken()`. Pas de faille possible en imitant un `uid`.


## Tester l'API

Une fois le serveur lancé et connecté côté Vue, vous pouvez simuler la génération d'un lien de partage :

```http
POST http://127.0.0.1:5001/votre-project-id/us-central1/createShareLink
Authorization: Bearer <ID_TOKEN_FIREBASE>
Content-Type: application/json

{
  "fileId": "<ID_DU_FICHIER_UPLOADÉ>"
}
```

*Résultat attendu : un JSON contenant le token de partage et une URL temporaire de téléchargement (`downloadUrl`).*

### Collection Postman

Pour éviter de recopier la requête à la main, une collection Postman est fournie dans `postman/` :

- `postman/SecureDrop.postman_collection.json`
- `postman/SecureDrop.local.postman_environment.json`

Importez les deux fichiers dans Postman, sélectionnez l'environnement `SecureDrop Local`, puis renseignez :

- `idToken` : le token Firebase de l'utilisateur connecté
- `fileId` : l'identifiant du fichier déjà enregistré dans Firestore

La collection contient :

- `Create Share Link` pour générer un lien temporaire
- `Download Shared File` pour vérifier le téléchargement avec le token généré


## Mise en production (Déploiement)

Lorsque le projet est prêt, vous pouvez le déployer chez Google :

```bash
# Frontend (Build)
npm run build

# Déploiement de l'ensemble (Hosting, Rules, Functions)
firebase deploy
```

⚠️ *Note API & Serverless : Les Firebase Cloud Functions nécessitent que votre projet soit sur le plan "Blaze" (Pay-as-you-go). Cependant, sous usage normal pour un prototype, vous restez en deçà de la tranche gratuite.*
