// src/App.jsx

import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'; // Importar mais funções

import LoginPage from './components/LoginPage.jsx';
import MainLayout from './components/MainLayout.jsx';
import ChecklistPage from './pages/ChecklistPage.jsx'; // Importar a nova página de checklist

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // NOVO ESTADO: para controlar se o checklist está pendente
  const [checklistPendente, setChecklistPendente] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = { uid: firebaseUser.uid, ...userDoc.data() };
          setUser(userData);

          // ---- INÍCIO DA NOVA LÓGICA DE CHECKLIST ----
          if (userData.role === 'operador') {
            const hoje = new Date();
            const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
            const fimDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);

            const q = query(
              collection(db, 'checklistSubmissions'),
              where('operadorId', '==', userData.uid),
              where('dataSubmissao', '>=', inicioDoDia),
              where('dataSubmissao', '<', fimDoDia)
            );

            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
              // Se não encontrou nenhum envio hoje, o checklist está pendente
              setChecklistPendente(true);
            } else {
              setChecklistPendente(false);
            }
          }
          // ---- FIM DA NOVA LÓGICA DE CHECKLIST ----

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
    return <div style={{padding: '20px'}}>Carregando...</div>;
  }

  // Se o checklist estiver pendente, renderiza a página de checklist
  if (user && user.role === 'operador' && checklistPendente) {
    // Passamos uma função para que a página de checklist possa nos avisar quando for concluída
    return <ChecklistPage user={user} onChecklistSubmit={() => setChecklistPendente(false)} />;
  }

  // Se não, segue o fluxo normal
  return (
    <>
      <Toaster position="top-right" />
      {user ? <MainLayout user={user} /> : <LoginPage />}
    </>
  );
}

export default App;