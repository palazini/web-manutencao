import React from 'react';
import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { FiHome, FiLogOut, FiCheckSquare, FiUser, FiCalendar, FiList, FiClock, FiUsers, FiEdit, FiCheckCircle } from 'react-icons/fi';
import styles from './MainLayout.module.css';

// Importa todos os painéis e páginas
import OperatorDashboard from './OperatorDashboard.jsx';
import MaintainerDashboard from './MaintainerDashboard.jsx';
import GestorDashboard from './GestorDashboard.jsx';
import ChamadoDetalhe from '../pages/ChamadoDetalhe.jsx';
import HistoricoPage from '../pages/HistoricoPage.jsx';
import PerfilPage from '../pages/PerfilPage.jsx';
import PlanosPreditivosPage from '../pages/PlanosPreditivosPage.jsx';
import PlanosPreventivosPage from '../pages/PlanosPreventivosPage.jsx';
import GerenciarChecklistsPage from '../pages/GerenciarChecklistsPage.jsx';
import EditarChecklistPage from '../pages/EditarChecklistPage.jsx';
import RelatorioChecklistPage from '../pages/RelatorioChecklistPage.jsx';
import HistoricoOperadorPage from '../pages/HistoricoOperadorPage.jsx';
import EditarChecklistDiarioPage from '../pages/EditarChecklistDiarioPage.jsx'; // 1. Importar a nova página

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
              <h3 className={styles.navSectionTitle}>Gerenciar Manutenção</h3>
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
                <span>Checklists de Tarefas</span>
              </NavLink>

              <h3 className={styles.navSectionTitle}>Gerenciar Colaboradores</h3>
              <NavLink to="/checklists-colaboradores" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
                <FiUsers className={styles.navIcon} />
                <span>Checklists de Colaboradores</span>
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
          {/* 2. NOVA ROTA AQUI */}
          <Route path="/editar-checklist-diario/:id" element={<EditarChecklistDiarioPage />} />
          <Route path="/historico-operador/:operadorId" element={<HistoricoOperadorPage />} />
          <Route path="/checklists-colaboradores" element={<RelatorioChecklistPage />} />
          <Route path="/editar-checklist/:id" element={<EditarChecklistPage />} />
          <Route path="/gerenciar-checklists" element={<GerenciarChecklistsPage />} />
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
