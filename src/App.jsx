// src/App.jsx

import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast'; // 1. Importar o Toaster
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import LoginPage from './components/LoginPage.jsx';
import MainLayout from './components/MainLayout.jsx';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        // Criamos a variável com os dados combinados
        const userData = { uid: firebaseUser.uid, ...userDoc.data() };

        // AQUI ESTÁ A LINHA DE DEBUG: Vamos ver o que está dentro de userData
        console.log("DADOS DO USUÁRIO LOGADO:", userData);

        // Guardamos no estado
        setUser(userData);
      } else {
        console.error("Usuário não encontrado no Firestore com o UID:", firebaseUser.uid);
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  });

  return () => unsubscribe();
}, []);

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    // Usamos um fragment <> para poder adicionar o Toaster
    <>
      {/* 2. Adiciona o componente Toaster aqui. Ele é invisível mas gerencia as notificações. */}
      <Toaster 
        position="top-right"
        toastOptions={{
          success: {
            style: {
              background: '#28a745',
              color: 'white',
            },
          },
          error: {
            style: {
              background: '#dc3545',
              color: 'white',
            },
          },
        }}
      />
      {user ? <MainLayout user={user} /> : <LoginPage />}
    </>
  );
}

export default App;