// api/deleteUser.js

import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });  
}

  const authHeader = req.headers.authorization || '';
  const idToken    = authHeader.replace('Bearer ', '');
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded.admin) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ error: 'UID é obrigatório' });
    }

    // 1) Deleta do Auth
    await admin.auth().deleteUser(uid);
    // 2) Deleta do Firestore
    await admin.firestore().doc(`usuarios/${uid}`).delete();

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
