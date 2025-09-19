// src/App.jsx

import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

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
  const location = useLocation();

  const readAuthUser = () => {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); }
    catch { return null; }
  };
  const readDadosTurno = () => {
    try { return JSON.parse(localStorage.getItem('dadosTurno') || 'null'); }
    catch { return null; }
  };

  // Mount: carrega usuário e dados do turno
  useEffect(() => {
    const u = readAuthUser();
    setUser(u);
    const dt = readDadosTurno();
    setDadosTurno(dt);
    setTurnoConfirmado(!!dt && Array.isArray(dt.maquinas) && dt.maquinas.length > 0);
    setLoading(false);
  }, []);

  // A cada mudança de rota, re-hidrata (útil após login navegado ou sair do fluxo)
  useEffect(() => {
    const u = readAuthUser();
    setUser(u);
    const dt = readDadosTurno();
    setDadosTurno(dt);
    setTurnoConfirmado(!!dt && Array.isArray(dt.maquinas) && dt.maquinas.length > 0);
  }, [location.key]);

  // Sincroniza se limpar sessão em outra aba (evento storage)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'authUser' || e.key === 'dadosTurno') {
        const u = readAuthUser();
        setUser(u);
        const dt = readDadosTurno();
        setDadosTurno(dt);
        setTurnoConfirmado(!!dt && Array.isArray(dt.maquinas) && dt.maquinas.length > 0);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // (Opcional) mantém compatibilidade com páginas existentes
  const handleTurnoConfirmado = (selecao) => {
    setDadosTurno(selecao);
    setTurnoConfirmado(true);
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Carregando...</div>;
  }

  return (
    <DndProvider backend={HTML5Backend}>
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
    </DndProvider>
  );
}

export default App;
