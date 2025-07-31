// api/deleteUser.js

import admin from 'firebase-admin';

// Inicializa o Admin SDK (use suas VARs de ambiente do Vercel)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:     process.env.FIREBASE_PROJECT_ID,
      clientEmail:   process.env.FIREBASE_CLIENT_EMAIL,
      // no Vercel você salva a private key com \n escapado
      privateKey:    process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verifique aqui o token do gestor para segurança
  const authHeader = req.headers.authorization || '';
  const idToken    = authHeader.replace('Bearer ', '');
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded.admin) // supondo que você use a claim 'admin' para gestor
      return res.status(403).json({ error: 'Sem permissão' });

    const { uid } = req.body;
    if (!uid) return res.status(400).json({ error: 'UID é obrigatório' });

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
