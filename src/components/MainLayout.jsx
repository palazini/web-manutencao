import React from 'react';
import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { FiHome, FiLogOut, FiCheckSquare, FiUser, FiCalendar, FiList, FiClock } from 'react-icons/fi';
import styles from './MainLayout.module.css';

// Importa todos os painéis e páginas necessários
import OperatorDashboard from './OperatorDashboard.jsx';
import MaintainerDashboard from './MaintainerDashboard.jsx';
import GestorDashboard from './GestorDashboard.jsx';
import ChamadoDetalhe from '../pages/ChamadoDetalhe.jsx';
import HistoricoPage from '../pages/HistoricoPage.jsx';
import PerfilPage from '../pages/PerfilPage.jsx';
import PlanosPreditivosPage from '../pages/PlanosPreditivosPage.jsx'; // A página de planos antiga, agora renomeada
import PlanosPreventivosPage from '../pages/PlanosPreventivosPage.jsx'; // A nova página de planos com checklist
import GerenciarChecklistsPage from '../pages/GerenciarChecklistsPage.jsx'; // A página para criar os checklists
import EditarChecklistPage from '../pages/EditarChecklistPage.jsx';

const MainLayout = ({ user }) => {
  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Erro no logout: ', error));
  };

  const getDashboardTitle = () => {
    switch (user.role) {
      case 'operador': return 'Painel do Operador';
      case 'manutentor': return 'Painel do Manutentor';
      case 'gestor': return 'Painel do Gestor';
      default: return 'Painel Principal';
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
          <NavLink to="/" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink} end>
            <FiHome className={styles.navIcon} />
            <span>Início</span>
          </NavLink>

          {(user.role === 'manutentor' || user.role === 'gestor') && (
            <NavLink to="/historico" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
              <FiCheckSquare className={styles.navIcon} />
              <span>Histórico</span>
            </NavLink>
          )}

          <NavLink to="/perfil" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
            <FiUser className={styles.navIcon} />
            <span>Meu Perfil</span>
          </NavLink>

          {user.role === 'gestor' && (
            <>
              <NavLink to="/planos-preditivos" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
                <FiClock className={styles.navIcon} />
                <span>Manut. Preditiva</span>
              </NavLink>
              <NavLink to="/planos-preventivos" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
                <FiCalendar className={styles.navIcon} />
                <span>Manut. Preventiva</span>
              </NavLink>
              <NavLink to="/gerenciar-checklists" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
                <FiList className={styles.navIcon} />
                <span>Gerenciar Checklists</span>
              </NavLink>
            </>
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
          <Route path="/gerenciar-checklists" element={<GerenciarChecklistsPage />} />
          <Route path="/editar-checklist/:id" element={<EditarChecklistPage />} />
          <Route path="/planos-preventivos" element={<PlanosPreventivosPage />} />
          <Route path="/planos-preditivos" element={<PlanosPreditivosPage />} />
          <Route path="/perfil" element={<PerfilPage user={user} />} />
          <Route path="/historico" element={<HistoricoPage />} />
          <Route path="/chamado/:id" element={<ChamadoDetalhe user={user} />} />
          <Route path="/" element={
            <>
              <header className={styles.header}>
                <h1>{getDashboardTitle()}</h1>
              </header>
              <div className={styles.content}>
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