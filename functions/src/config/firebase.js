const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

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

const db = admin.firestore();
const storage = admin.storage();
const auth = admin.auth();

module.exports = { admin, db, storage, auth, projectId };
