// Importe as funções que você precisa dos SDKs que você precisa
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // Importe a função para obter o serviço de autenticação
import { getFirestore } from "firebase/firestore";

// TODO: Adicione os SDKs para outros produtos do Firebase que você queira usar
// https://firebase.google.com/docs/web/setup#available-libraries

// A configuração do seu app da web do Firebase
// SUBSTITUA PELAS SUAS CREDENCIAIS VINDAS DO CONSOLE DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyAWx133vnf5VeTR4BD-1xkpZuzwy3aFcZ4",
  authDomain: "app-tpm-web.firebaseapp.com",
  projectId: "app-tpm-web",
  storageBucket: "app-tpm-web.firebasestorage.app",
  messagingSenderId: "29700779521",
  appId: "1:29700779521:web:2c918a04b9b41fb57a1a00"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o serviço de Autenticação do Firebase e obtém uma referência a ele
const auth = getAuth(app);

const db = getFirestore(app); // 2. INICIALIZAR O FIRESTORE

export { auth, db }; // 3. EXPORTAR O 'db' JUNTO COM O 'auth'