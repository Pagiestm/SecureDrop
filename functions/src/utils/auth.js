const { https } = require('firebase-functions');
const { auth } = require('../config/firebase');

const getBearerToken = (req) => {
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7);
};

const requireUser = async (req) => {
  const idToken = getBearerToken(req);
  if (!idToken) {
    throw new https.HttpsError('unauthenticated', 'Tu dois être connecté.');
  }

  return auth.verifyIdToken(idToken);
};

module.exports = { getBearerToken, requireUser };
