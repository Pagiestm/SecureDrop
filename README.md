# SecureDrop (Vue 3 + Firebase)

Prototype local de partage sécurisé de fichiers, pensé pour fonctionner sans coût via l'émulateur Firebase.

## Ce que le prototype couvre

- Une fonction serverless HTTP: création d'un lien de téléchargement sécurisé
- Firestore: métadonnées des fichiers, utilisateurs, liens temporaires et logs d'audit
- Storage: stockage des fichiers sous `users/{uid}/...`
- Sécurité: règles Firestore, règles Storage et validation d'accès dans la fonction
- Test fonctionnel: bouton dans l'interface qui appelle la fonction HTTP

## Fonctionnement

- L'utilisateur s'inscrit et se connecte avec Firebase Auth.
- Un fichier est uploadé vers Storage.
- Les métadonnées sont enregistrées dans Firestore.
- Le bouton de partage appelle la Cloud Function `createShareLink`.
- La Cloud Function vérifie l'utilisateur, l'accès au fichier, crée un token, écrit un log d'audit, puis renvoie une URL de téléchargement temporaire.
- L'URL de téléchargement appelle `downloadSharedFile`, qui vérifie le token et renvoie le contenu du fichier.

## Mode émulateur

Le projet est configuré pour fonctionner en local avec:

- Auth Emulator sur `9099`
- Firestore Emulator sur `8080`
- Functions Emulator sur `5001`
- Storage Emulator sur `9199`
- Emulator UI sur `4000`

## Installation

```bash
npm install
npm install --prefix functions
```

## Lancement local

Ouvre 2 terminaux:

```bash
npm run emulators
```

```bash
npm run dev
```

Le frontend est servi par Vite et se connecte automatiquement aux émulateurs via `VITE_USE_EMULATORS=true`.

## Test fonctionnel

1. Crée un compte dans l'interface.
2. Upload un fichier.
3. Clique sur le bouton de partage du fichier.
4. Une URL de téléchargement temporaire apparaît.
5. Ouvre cette URL ou teste la requête HTTP suivante dans Postman:

```http
POST http://127.0.0.1:5001/fir-demo-dd7df/us-central1/createShareLink
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json

{"fileId":"<ID_DU_FICHIER>"}
```

## Sécurité

### Firestore rules

- Les fichiers sont lisibles uniquement par le propriétaire ou un utilisateur partagé.
- La création, la modification et la suppression sont réservées au propriétaire.
- Les utilisateurs ne peuvent écrire que leur propre document.

### Storage rules

- Chaque utilisateur peut lire et écrire uniquement dans `users/{uid}/...`.
- Tout le reste est refusé.

### Validation dans les fonctions

- La fonction vérifie le token Firebase `Authorization: Bearer ...`.
- Elle vérifie que le fichier existe.
- Elle vérifie que l'utilisateur est propriétaire ou autorisé via `sharedWithUids`.
- Le lien expire après 24 h.

## Logs

Les actions sont consignées dans la collection Firestore `auditLogs`:

- `file_uploaded`
- `file_updated`
- `file_shared`
- `file_deleted`
- `share_link_created`
- `shared_file_downloaded`

Pour voir les logs, ouvre la console Emulator UI ou Firestore dans la base locale.

## Dépannage

- Vérifie que `.env` contient `VITE_USE_EMULATORS=true`.
- Vérifie que `VITE_FIREBASE_PROJECT_ID` correspond à `fir-demo-dd7df`.
- Si la connexion échoue, relance les émulateurs avant d'ouvrir l'app.
