// scripts/setAdminClaim.cjs

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = process.argv[2];
if (!uid) {
  console.error('Use: node scripts/setAdminClaim.cjs <UID_DO_USUARIO>');
  process.exit(1);
}

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`✨ Claim admin adicionada a ${uid}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Erro ao setar custom claim:', err);
    process.exit(1);
  });
