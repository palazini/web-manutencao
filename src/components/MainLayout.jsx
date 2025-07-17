import React from 'react';
import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { FiHome, FiLogOut, FiCheckSquare, FiUser, FiCalendar, FiList, FiClock, FiUsers, FiServer, FiEdit, FiCheckCircle } from 'react-icons/fi';
import styles from './MainLayout.module.css';

// Importa todos os painéis e páginas
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

// Layouts
import MaquinasLayout from '../pages/MaquinasLayout.jsx'; // O layout que tínhamos esquecido
import ChecklistsLayout from '../pages/ChecklistsLayout.jsx';
import HistoricoLayout from "../pages/HistoricoLayout.jsx";

const MainLayout = ({ user }) => {
  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Erro no logout: ', error));
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

          <NavLink to="/perfil" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
            <FiUser className={styles.navIcon} />
            <span>Meu Perfil</span>
          </NavLink>

          {/* O link para Máquinas agora aponta para /maquinas */}
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
              <NavLink to="/gerenciar-checklists" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
                <FiList className={styles.navIcon} />
                <span>Checklists de Tarefas</span>
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
          <Route path="/" element={
            user.role === 'operador' ? (
              <OperatorDashboard user={user} />
            ) : (
              <InicioPage user={user} />
            )
          } />
          
          {/* ROTA ANINHADA PARA MÁQUINAS */}
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
          
        </Routes>
      </main>
    </div>
  );
};

export default MainLayout;
