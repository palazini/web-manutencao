// src/components/MainLayout.jsx

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
import InicioPage from '../pages/InicioPage.jsx'; // 1. Importar a nova página inicial
import ChamadoDetalhe from '../pages/ChamadoDetalhe.jsx';
import HistoricoPage from '../pages/HistoricoPage.jsx';
import PerfilPage from '../pages/PerfilPage.jsx';
import GerenciarChecklistsPage from '../pages/GerenciarChecklistsPage.jsx';
import EditarChecklistPage from '../pages/EditarChecklistPage.jsx';
import RelatorioChecklistPage from '../pages/RelatorioChecklistPage.jsx';
import HistoricoOperadorPage from '../pages/HistoricoOperadorPage.jsx';
import EditarChecklistDiarioPage from '../pages/EditarChecklistDiarioPage.jsx';
import EditarPlanoPreditivoPage from '../pages/EditarPlanoPreditivoPage.jsx';
import EditarPlanoPreventivoPage from '../pages/EditarPlanoPreventivoPage.jsx';
import ManutencaoLayout from '../pages/ManutencaoLayout.jsx';
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
          {/* 2. O link de "Início" agora é para todos e aponta para a nova página inicial */}
          <NavLink to="/" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink} end>
            <FiHome className={styles.navIcon} />
            <span>Início</span>
          </NavLink>

          {/* O link para Máquinas agora tem sua própria rota */}
          {(user.role === 'manutentor' || user.role === 'gestor') && (
            <NavLink to="/maquinas" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
              <FiServer className={styles.navIcon} />
              <span>Máquinas</span>
            </NavLink>
          )}

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
              <NavLink to="/manutencao/checklists" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
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
          {/* 3. A ROTA PRINCIPAL "/" AGORA MOSTRA A PÁGINA DE INÍCIO */}
          <Route path="/" element={<InicioPage user={user} />} />
          
          {/* A ROTA PARA MÁQUINAS AGORA É EXCLUSIVA */}
          <Route path="/maquinas" element={<MaquinasPage />} />
          <Route path="/maquinas/:id" element={<MaquinaDetalhePage user={user} />} />

          <Route path="/perfil" element={<PerfilPage user={user} />} />
          
          <Route path="/historico/*" element={<HistoricoLayout />}>
            <Route index element={<HistoricoPage />} />
            <Route path="chamado/:id" element={<ChamadoDetalhe user={user} />} />
          </Route>
          
          <Route path="/manutencao/*" element={<ManutencaoLayout />}>
            <Route path="checklists" element={<GerenciarChecklistsPage />} />
            <Route path="checklists/editar/:id" element={<EditarChecklistPage />} />
            <Route path="preditiva/editar/:id" element={<EditarPlanoPreditivoPage />} />
            <Route path="preventiva/editar/:id" element={<EditarPlanoPreventivoPage />} />
          </Route>

          <Route path="/checklists-colaboradores/*" element={<ChecklistsLayout />}>
            <Route index element={<RelatorioChecklistPage />} />
            <Route path="editar-checklist-diario/:id" element={<EditarChecklistDiarioPage />} />
            <Route path="historico-operador/:operadorId" element={<HistoricoOperadorPage />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
};

export default MainLayout;