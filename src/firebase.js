// Importe as funções que você precisa dos SDKs que você precisa
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // Importe a função para obter o serviço de autenticação
import { getFirestore } from "firebase/firestore";

// TODO: Adicione os SDKs para outros produtos do Firebase que você queira usar
// https://firebase.google.com/docs/web/setup#available-libraries

// A configuração do seu app da web do Firebase
// SUBSTITUA PELAS SUAS CREDENCIAIS VINDAS DO CONSOLE DO FIREBASE
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o serviço de Autenticação do Firebase e obtém uma referência a ele
const auth = getAuth(app);

const db = getFirestore(app); // 2. INICIALIZAR O FIRESTORE

const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

export { auth, db, secondaryAuth };