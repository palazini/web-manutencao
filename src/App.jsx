// src/App.jsx

import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import LoginPage from './components/LoginPage.jsx';
import MainLayout from './components/MainLayout.jsx';
import OperatorFlow from './pages/OperatorFlow.jsx'; // 1. Importar nosso novo componente
import ChecklistPage from './pages/ChecklistPage.jsx';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUser({ uid: firebaseUser.uid, ...userDoc.data() });
        } else {
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
    return <div style={{ padding: '20px' }}>Carregando...</div>;
  }
  
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {user ? (
          // Se o usuário está logado
          user.role === 'operador' ? (
            // Se for operador, o fluxo dele é especial
            <>
              <Route path="/*" element={<OperatorFlow user={user} />} />
              <Route path="/checklist/:maquinaId" element={<ChecklistPage user={user} />} />
            </>
          ) : (
            // Para gestor e manutentor, usa o MainLayout normal
            <Route path="/*" element={<MainLayout user={user} />} />
          )
        ) : (
          // Se não há usuário, mostra a página de login
          <Route path="/*" element={<LoginPage />} />
        )}
      </Routes>
    </>
  );
}

export default App;