import React, { useState } from 'react'; // Adicionado useState
import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { FiHome, FiLogOut, FiCheckSquare, FiUser, FiCalendar, FiList, FiClock, FiUsers, FiServer, FiEdit, FiCheckCircle, FiMenu, FiX, FiBarChart2 } from 'react-icons/fi';
import styles from './MainLayout.module.css';

import OperatorDashboard from './OperatorDashboard.jsx';
import MaquinasPage from '../pages/MaquinasPage.jsx';
import MaquinaDetalhePage from '../pages/MaquinaDetalhePage.jsx';
import InicioPage from '../pages/InicioPage.jsx';
import ChamadoDetalhe from '../pages/ChamadoDetalhe.jsx';
import HistoricoPage from '../pages/HistoricoPage.jsx';
import PerfilPage from '../pages/PerfilPage.jsx';
import GerenciarChecklistsPage from '../pages/GerenciarChecklistsPage.jsx';
import EditarChecklistPage from '../pages/EditarChecklistPage.jsx';
import EditarPlanoPreditivoPage from '../pages/EditarPlanoPreditivoPage.jsx';
import EditarPlanoPreventivoPage from '../pages/EditarPlanoPreventivoPage.jsx';
import ChecklistLayout from '../pages/ChecklistLayout.jsx';
import MaquinasLayout from '../pages/MaquinasLayout.jsx';
import HistoricoLayout from "../pages/HistoricoLayout.jsx";
import AnaliseFalhasPage from '../pages/AnaliseFalhasPage.jsx'; // NOVO
import GerirUtilizadoresPage from '../pages/GerirUtilizadoresPage.jsx';

import logo from '../assets/logo-sidebar.png';

const MainLayout = ({ user }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Novo estado

  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Erro no logout: ', error));
  };

  const getDashboardTitle = () => {
    if (user.role === 'operador') return 'Painel do Operador';
    if (user.role === 'manutentor') return 'Painel de Manutenção';
    if (user.role === 'gestor') return 'Painel do Gestor';
    return 'Painel';
  };

  const NavContent = () => (
    <>
      <NavLink to="/" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink} end>
        <FiHome className={styles.navIcon} />
        <span>Início</span>
      </NavLink>

      <NavLink to="/perfil" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
        <FiUser className={styles.navIcon} />
        <span>Meu Perfil</span>
      </NavLink>

      {(user.role === 'manutentor' || user.role === 'gestor') && (
        <>
          <h3 className={styles.navSectionTitle}>Gerenciar Manutenção</h3>
          <NavLink to="/maquinas" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
            <FiServer className={styles.navIcon} />
            <span>Máquinas</span>
          </NavLink>
        </>
      )}

      {(user.role === 'manutentor' || user.role === 'gestor') && (
        <NavLink to="/historico" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
          <FiCheckSquare className={styles.navIcon} />
          <span>Histórico</span>
        </NavLink>
      )}

      {user.role === 'gestor' && (
        <>
          <h3 className={styles.navSectionTitle}>Checklists</h3>
          <NavLink to="/gerenciar-checklists" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
            <FiList className={styles.navIcon} />
            <span>Checklists de Tarefas</span>
          </NavLink>

          {/* NOVA SEÇÃO DE ANÁLISE */}
          <h3 className={styles.navSectionTitle}>Análises e KPIs</h3>
          <NavLink to="/analise-falhas" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
            <FiBarChart2 className={styles.navIcon} />
            <span>Análise de Falhas</span>
          </NavLink>

          <h3 className={styles.navSectionTitle}>Gerenciar Colaboradores</h3>
          <NavLink to="/gerir-utilizadores" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
            <FiUsers className={styles.navIcon} />
            <span>Gerir Utilizadores</span>
          </NavLink>
        </>
      )}
    </>
  );

  return (
    <div className={styles.layout}>
      {/* SIDEBAR DESKTOP */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <img src={logo} alt="Logo da Empresa" className={styles.sidebarLogo} />
          </Link>
        </div>
        <nav className={styles.nav}>
          <NavContent />
        </nav>
        <div className={styles.userInfo}>
          <span className={styles.userEmail}>{user.nome}</span>
          <button onClick={handleLogout} className={styles.logoutButton} title="Sair">
            <FiLogOut />
          </button>
        </div>
      </aside>

      {/* OVERLAY MOBILE */}
      {isMobileMenuOpen && <div className={styles.overlay} onClick={() => setIsMobileMenuOpen(false)}></div>}

      {/* SIDEBAR MOBILE */}
      <aside className={`${styles.mobileNav} ${isMobileMenuOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>
            <img src={logo} alt="Logo" className={styles.sidebarLogo} />
          </Link>
        </div>
        <nav className={styles.nav} onClick={() => setIsMobileMenuOpen(false)}>
          <NavContent />
        </nav>
        <div className={styles.userInfo}>
          <span className={styles.userEmail}>{user.nome}</span>
          <button onClick={handleLogout} className={styles.logoutButton} title="Sair">
            <FiLogOut />
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <button className={styles.hamburgerButton} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>
          <h1>{getDashboardTitle()}</h1>
        </header>

        <Routes>
          <Route path="/" element={
            user.role === 'operador' ? (
              <OperatorDashboard user={user} />
            ) : (
              <InicioPage user={user} />
            )
          } />

          <Route path="/maquinas/*" element={<MaquinasLayout />}>
            <Route index element={<MaquinasPage />} />
            <Route path=":id" element={<MaquinaDetalhePage user={user} />} />
            <Route path=":maquinaId/editar-plano-preditivo/:planoId" element={<EditarPlanoPreditivoPage />} />
            <Route path=":maquinaId/editar-plano-preventivo/:planoId" element={<EditarPlanoPreventivoPage />} />
          </Route>

          <Route path="/perfil" element={<PerfilPage user={user} />} />

          <Route path="/historico/*" element={<HistoricoLayout />}>
            <Route index element={<HistoricoPage />} />
            <Route path="chamado/:id" element={<ChamadoDetalhe user={user} />} />
          </Route>

          <Route path="/gerenciar-checklists/*" element={<ChecklistLayout />}>
            <Route index element={<GerenciarChecklistsPage />} />
            <Route path="editar/:id" element={<EditarChecklistPage />} />
          </Route>

          <Route path="/analise-falhas" element={<AnaliseFalhasPage />} />

          <Route path="/gerir-utilizadores" element={<GerirUtilizadoresPage />} />

        </Routes>
      </main>
    </div>
  );
};

export default MainLayout;
