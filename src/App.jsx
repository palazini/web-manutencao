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
import InicioTurnoPage from './pages/InicioTurnoPage.jsx';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [turnoConfirmado, setTurnoConfirmado] = useState(false);
  const [dadosTurno, setDadosTurno] = useState(null);

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
        setTurnoConfirmado(false);
        setDadosTurno(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  const handleTurnoConfirmado = (selecao) => {
    setDadosTurno(selecao);
    setTurnoConfirmado(true);
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Carregando...</div>;
  }
  
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {user ? (
          user.role === 'operador' ? (
            <>
              <Route 
                path="/*" 
                element={
                  turnoConfirmado ? (
                    <OperatorFlow user={user} dadosTurno={dadosTurno} />
                  ) : (
                    <InicioTurnoPage user={user} onTurnoConfirmado={handleTurnoConfirmado} />
                  )
                } 
              />
              <Route path="/checklist/:maquinaId" element={<ChecklistPage user={user} />} />
            </>
          ) : (
            <Route path="/*" element={<MainLayout user={user} />} />
          )
        ) : (
          <Route path="/*" element={<LoginPage />} />
        )}
      </Routes>
    </>
  );
}

export default App;