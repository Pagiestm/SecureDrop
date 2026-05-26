const { https } = require('firebase-functions/v1');
const crypto = require('crypto');
const { getDb, getStorage, projectId } = require('../config/firebase');
const { requireUser } = require('../utils/auth');
const { setCorsHeaders } = require('../utils/http');

exports.createShareLink = https.onRequest(async (req, res) => {
  setCorsHeaders(req, res);

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
    const db = getDb();
    const storage = getStorage();
    const { fileId } = req.body || {};

    if (!fileId) {
      res.status(400).json({ error: 'fileId est requis' });
      return;
    }

    const fileSnap = await db.collection('files').doc(fileId).get();
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

    const storageFile = storage.bucket().file(fileData.path);
    const [exists] = await storageFile.exists();
    if (!exists) {
      res.status(404).json({ error: 'Fichier Storage introuvable' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');

    const requestedSeconds = Number(req.body?.expiresInSeconds || 0);
    const maxSeconds = 7 * 24 * 60 * 60; // 7 days
    const ttlSeconds = (!isNaN(requestedSeconds) && requestedSeconds > 0)
      ? Math.min(requestedSeconds, maxSeconds)
      : 24 * 60 * 60; // default 24 hours

    const expiresAt = Date.now() + ttlSeconds * 1000;

    await db.collection('shareLinks').add({
      fileId,
      token,
      createdBy: user.uid,
      createdAt: new Date(),
      expiresAt,
      used: false
    });

    await db.collection('auditLogs').add({
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
