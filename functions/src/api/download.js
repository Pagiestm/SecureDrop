const { https } = require('firebase-functions/v1');
const { getDb, getStorage } = require('../config/firebase');
const { isExpired } = require('../utils/time');
const { setCorsHeaders } = require('../utils/http');

exports.downloadSharedFile = https.onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
    const db = getDb();
    const storage = getStorage();
    const token = req.query.token || req.body?.token;
    if (!token) {
      res.status(400).json({ error: 'token manquant' });
      return;
    }

    const linkQuery = await db.collection('shareLinks').where('token', '==', token).limit(1).get();
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

    const fileSnap = await db.collection('files').doc(linkData.fileId).get();
    if (!fileSnap.exists) {
      res.status(404).json({ error: 'Fichier introuvable' });
      return;
    }

    const fileData = fileSnap.data();

    let fileBuffer = null;
    if (fileData.contentBase64) {
      fileBuffer = Buffer.from(fileData.contentBase64, 'base64');
    } else if (fileData.path) {
      const [downloaded] = await storage.bucket().file(fileData.path).download();
      fileBuffer = downloaded;
    }

    if (!fileBuffer) {
      res.status(400).json({ error: 'Contenu du fichier indisponible' });
      return;
    }

    await linkDoc.ref.update({ used: true, usedAt: new Date() });

    await db.collection('auditLogs').add({
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
