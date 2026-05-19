const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getStorage } = require("firebase-admin/storage");
const admin = require('firebase-admin');

// Initialiser l'app admin
admin.initializeApp();

exports.generateSecureProtocolLink = onCall(async (request) => {
  // 1. Vérification de l'authentification
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vous devez être connecté pour générer un lien sécurisé.");
  }

  const uid = request.auth.uid;
  const fileId = request.data.fileId;
  const ownerId = request.data.ownerId;

  if (!fileId || !ownerId) {
    throw new HttpsError("invalid-argument", "Identifiants de fichier manquant.");
  }

  // 2. Vérification des droits d'accès via Firestore
  const fileDoc = await admin.firestore().collection('files').doc(fileId).get();
  
  if (!fileDoc.exists) {
    throw new HttpsError("not-found", "Ce fichier n'existe pas.");
  }

  const fileData = fileDoc.data();

  // Le demandeur doit être le propriétaire ou dans la liste sharedWith
  const isOwner = fileData.ownerId === uid;
  const isShared = fileData.sharedWith && fileData.sharedWith.includes(uid);

  if (!isOwner && !isShared) {
    throw new HttpsError("permission-denied", "Vous n'avez pas accès à ce fichier.");
  }

  // 3. Génération du lien signé temporaire (URL Signed) via Cloud Storage
  const bucket = getStorage().bucket();
  const filePath = fileData.path; // ex: users/{uid}/{timestamp}_nom.pdf
  
  const fileRef = bucket.file(filePath);

  const options = {
    version: 'v4',
    action: 'read',
    expires: Date.now() + 30 * 60 * 1000,
  };

  try {
    let url;
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      const bucketName = bucket.name || "fir-demo-dd7df.appspot.com";
      url = `http://127.0.0.1:9199/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=simulated-signed-token-${Date.now()}`;
    } else {
      const [signed] = await fileRef.getSignedUrl(options);
      url = signed;
    }
    
    await admin.firestore().collection('audit_logs').add({
      action: 'generate_link',
      fileId: fileId,
      requestedBy: uid,
      timestamp: (admin.firestore && admin.firestore.FieldValue && typeof admin.firestore.FieldValue.serverTimestamp === 'function')
        ? admin.firestore.FieldValue.serverTimestamp()
        : new Date(),
      successful: true
    });

    const expiresAt = Date.now() + 30 * 60 * 1000;
    return { secureLink: url, expiresAt };
  } catch (error) {
    console.error("Erreur gènération lien signé", error);
    throw new HttpsError("internal", "Impossible de générer le lien de téléchargement.");
  }
});