const { firestore } = require('firebase-functions');
const { db } = require('../config/firebase');

exports.logFileAction = firestore
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

      await db.collection('auditLogs').add({
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
