// api/setAdminClaim.js
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    // não precisa de databaseURL se usa só Firestore
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  // verifica token do gestor que chama
  const idToken = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded.admin) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const { uid, makeAdmin } = req.body;
    if (!uid) {
      return res.status(400).json({ error: 'UID é obrigatório' });
    }

    // define ou remove a claim
    await admin.auth().setCustomUserClaims(
      uid,
      makeAdmin ? { admin: true } : { admin: false }
    );

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('setAdminClaim falhou:', e);
    return res.status(500).json({ error: e.message });
  }
}
