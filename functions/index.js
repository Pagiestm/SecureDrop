const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const path = require('path');

// Charge le .env situé à la racine du projet
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Initialisation de Firebase Admin
// L'émulateur injecte automatiquement process.env.FIREBASE_CONFIG
const firebaseConfig = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : {};

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || firebaseConfig.projectId;
if (!projectId) {
  console.warn('Warning: Missing environment variable GCLOUD_PROJECT. Functions may not work properly.');
}

const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || `${projectId}.appspot.com`;
if (!storageBucket) {
  console.warn('Warning: Missing environment variable FIREBASE_STORAGE_BUCKET. Functions may not work properly.');
}

admin.initializeApp(
  projectId ? { projectId, storageBucket } : undefined
);

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const getBearerToken = (req) => {
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7);
};

const requireUser = async (req) => {
  const idToken = getBearerToken(req);
  if (!idToken) {
    throw new functions.https.HttpsError('unauthenticated', 'Tu dois être connecté.');
  }

  return admin.auth().verifyIdToken(idToken);
};

const isExpired = (expiresAt) => {
  if (typeof expiresAt === 'number') return expiresAt < Date.now();
  if (expiresAt && typeof expiresAt.toMillis === 'function') return expiresAt.toMillis() < Date.now();
  return true;
};

exports.logFileAction = functions.firestore
  .document('files/{fileId}')
  .onWrite(async (change, context) => {
    const fileId = context.params.fileId;
    const timestamp = new Date();

    try {
      const before = change.before.exists ? change.before.data() : null;
      const after = change.after.exists ? change.after.data() : null;

      let action = 'unknown';
      if (!before && after) {
        action = 'file_uploaded';
      } else if (before && !after) {
        action = 'file_deleted';
      } else if (before && after) {
        action = JSON.stringify(before.sharedWithUids || []) !== JSON.stringify(after.sharedWithUids || [])
          ? 'file_shared'
          : 'file_updated';
      }

      await admin.firestore().collection('auditLogs').add({
        action,
        fileId,
        fileName: after?.name || before?.name || 'unknown',
        userId: after?.ownerId || before?.ownerId || 'unknown',
        details: {
          size: after?.size || before?.size || 0,
          sharedCount: after?.sharedWithUids?.length || before?.sharedWithUids?.length || 0
        },
        timestamp
      });

      console.log(`[AUDIT] ${action} - ${fileId}`);
      return null;
    } catch (error) {
      console.error('Erreur logging:', error);
      return null;
    }
  });

exports.createShareLink = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
    const user = await requireUser(req);
    const { fileId } = req.body || {};

    if (!fileId) {
      res.status(400).json({ error: 'fileId est requis' });
      return;
    }

    const fileSnap = await admin.firestore().collection('files').doc(fileId).get();
    if (!fileSnap.exists) {
      res.status(404).json({ error: 'Fichier introuvable' });
      return;
    }

    const fileData = fileSnap.data();
    const canAccess = fileData.ownerId === user.uid || (Array.isArray(fileData.sharedWithUids) && fileData.sharedWithUids.includes(user.uid));

    if (!canAccess) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    if (!fileData.path) {
      res.status(400).json({ error: 'Le fichier doit être stocké dans Storage' });
      return;
    }

    const storageFile = admin.storage().bucket().file(fileData.path);
    const [exists] = await storageFile.exists();
    if (!exists) {
      res.status(404).json({ error: 'Fichier Storage introuvable' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');

    // Allow client to request a custom TTL (in seconds). Clamp to max 7 days.
    const requestedSeconds = Number(req.body?.expiresInSeconds || 0);
    const maxSeconds = 7 * 24 * 60 * 60; // 7 days
    const ttlSeconds = (!isNaN(requestedSeconds) && requestedSeconds > 0)
      ? Math.min(requestedSeconds, maxSeconds)
      : 24 * 60 * 60; // default 24 hours

    const expiresAt = Date.now() + ttlSeconds * 1000;

    await admin.firestore().collection('shareLinks').add({
      fileId,
      token,
      createdBy: user.uid,
      createdAt: new Date(),
      expiresAt,
      used: false
    });

    await admin.firestore().collection('auditLogs').add({
      action: 'share_link_created',
      fileId,
      userId: user.uid,
      timestamp: new Date(),
      details: { expiresAt }
    });

    const downloadUrl = `http://127.0.0.1:5001/${projectId}/us-central1/downloadSharedFile?token=${token}`;

    res.status(200).json({
      fileId,
      token,
      expiresAt,
      downloadUrl
    });
  } catch (error) {
    console.error('createShareLink error:', error);
    const code = error.code || 'internal';
    res.status(500).json({ error: code === 'unauthenticated' ? 'Connexion requise' : 'Impossible de créer le lien' });
  }
});

exports.downloadSharedFile = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
    const token = req.query.token || req.body?.token;
    if (!token) {
      res.status(400).json({ error: 'token manquant' });
      return;
    }

    const linkQuery = await admin.firestore().collection('shareLinks').where('token', '==', token).limit(1).get();
    if (linkQuery.empty) {
      res.status(404).json({ error: 'Lien introuvable' });
      return;
    }

    const linkDoc = linkQuery.docs[0];
    const linkData = linkDoc.data();

    if (isExpired(linkData.expiresAt)) {
      await linkDoc.ref.update({ expired: true });
      res.status(410).json({ error: 'Lien expiré' });
      return;
    }

    const fileSnap = await admin.firestore().collection('files').doc(linkData.fileId).get();
    if (!fileSnap.exists) {
      res.status(404).json({ error: 'Fichier introuvable' });
      return;
    }

    const fileData = fileSnap.data();

    let fileBuffer = null;
    if (fileData.contentBase64) {
      fileBuffer = Buffer.from(fileData.contentBase64, 'base64');
    } else if (fileData.path) {
      const [downloaded] = await admin.storage().bucket().file(fileData.path).download();
      fileBuffer = downloaded;
    }

    if (!fileBuffer) {
      res.status(400).json({ error: 'Contenu du fichier indisponible' });
      return;
    }

    await linkDoc.ref.update({ used: true, usedAt: new Date() });

    await admin.firestore().collection('auditLogs').add({
      action: 'shared_file_downloaded',
      fileId: linkData.fileId,
      userId: linkData.createdBy,
      timestamp: new Date(),
      details: { token }
    });

    res.setHeader('Content-Type', fileData.contentType || fileData.type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.name || 'download'}"`);
    res.status(200).send(fileBuffer);
  } catch (error) {
    console.error('downloadSharedFile error:', error);
    res.status(500).json({ error: 'Impossible de télécharger le fichier' });
  }
});