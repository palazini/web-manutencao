// src/components/MainLayout.jsx

import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { FiHome, FiLogOut, FiCheckSquare } from 'react-icons/fi';
import styles from './MainLayout.module.css';

// Importa todos os painéis e páginas
import OperatorDashboard from './OperatorDashboard.jsx';
import MaintainerDashboard from './MaintainerDashboard.jsx';
import GestorDashboard from './GestorDashboard.jsx'; // 1. Importa o novo painel
import ChamadoDetalhe from '../pages/ChamadoDetalhe.jsx';
import HistoricoPage from '../pages/HistoricoPage.jsx';

const MainLayout = ({ user }) => {
  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Erro no logout: ', error));
  };

  // Função para determinar o título do painel
  const getDashboardTitle = () => {
    switch (user.role) {
      case 'operador':
        return 'Painel do Operador';
      case 'manutentor':
        return 'Painel do Manutentor';
      case 'gestor':
        return 'Painel do Gestor';
      default:
        return 'Painel Principal';
    }
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h2 className={styles.sidebarTitle}>Manutenção</h2>
          </Link>
        </div>
        <nav className={styles.nav}>
          <Link to="/" className={styles.navLink}>
            <FiHome className={styles.navIcon} />
            <span>Início</span>
          </Link>
          {/* 2. LÓGICA ATUALIZADA: Mostra o link de Histórico para Manutentor OU Gestor */}
          {(user.role === 'manutentor' || user.role === 'gestor') && (
            <Link to="/historico" className={styles.navLink}>
              <FiCheckSquare className={styles.navIcon} />
              <span>Histórico</span>
            </Link>
          )}
        </nav>
        <div className={styles.userInfo}>
          <span className={styles.userEmail}>{user.nome}</span>
          <button onClick={handleLogout} className={styles.logoutButton} title="Sair">
            <FiLogOut />
          </button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <Routes>
          <Route path="/historico" element={<HistoricoPage />} />
          <Route path="/chamado/:id" element={<ChamadoDetalhe user={user} />} />
          <Route path="/" element={
            <>
              <header className={styles.header}>
                {/* 3. Usa a função para o título dinâmico */}
                <h1>{getDashboardTitle()}</h1>
              </header>
              <div className={styles.content}>
                {/* 4. LÓGICA ATUALIZADA: Renderiza o painel correto para os três papéis */}
                {user.role === 'operador' && <OperatorDashboard user={user} />}
                {user.role === 'manutentor' && <MaintainerDashboard user={user} />}
                {user.role === 'gestor' && <GestorDashboard user={user} />}
              </div>
            </>
          } />
        </Routes>
      </main>
    </div>
  );
};

export default MainLayout;