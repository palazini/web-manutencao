// src/components/MainLayout.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Link, useNavigate } from 'react-router-dom';
import {
  FiHome, FiLogOut, FiCheckSquare, FiUser, FiCalendar, FiUsers,
  FiServer, FiMenu, FiX, FiBarChart2, FiPackage, FiClipboard, FiPieChart, FiPlusCircle
} from 'react-icons/fi';
import styles from './MainLayout.module.css';

import OperatorDashboard from './OperatorDashboard.jsx';
import MaquinasPage from '../pages/MaquinasPage.jsx';
import MaquinaDetalhePage from '../pages/MaquinaDetalhePage.jsx';
import InicioPage from '../pages/InicioPage.jsx';
import ChamadoDetalhe from '../pages/ChamadoDetalhe.jsx';
import HistoricoPage from '../pages/HistoricoPage.jsx';
import PerfilPage from '../pages/PerfilPage.jsx';
import MaquinasLayout from '../pages/MaquinasLayout.jsx';
import HistoricoLayout from "../pages/HistoricoLayout.jsx";
import AnaliseFalhasPage from '../pages/AnaliseFalhasPage.jsx';
import GerirUtilizadoresPage from '../pages/GerirUtilizadoresPage.jsx';
import CalendarioGeralPage from '../pages/CalendarioGeralPage.jsx';
import CausasRaizPage from '../pages/CausasRaizPage.jsx';
import EstoquePage from '../pages/EstoquePage.jsx';
import MeusChamados from '../pages/MeusChamados';
import AbrirChamadoManutentor from '../pages/AbrirChamadoManutentor.jsx';
import LanguageMenu from '../components/LanguageMenu.jsx';

import logo from '../assets/logo-sidebar.png';
import { useTranslation } from 'react-i18next';

// API (sem Firebase)
import { listarChamados, listarAgendamentos, connectSSE } from '../services/apiClient';

const MainLayout = ({ user }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = (user?.role || '').trim().toLowerCase();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasOpenCalls, setHasOpenCalls] = useState(false);
  const [hasSoonDue, setHasSoonDue] = useState(false);
  const [myActiveCount, setMyActiveCount] = useState(0);
  const hasMyActiveCalls = myActiveCount > 0;

  // Helpers de refresh (usados no mount e quando chegam eventos SSE)
  const refreshOpenCalls = async () => {
    try {
      const a = await listarChamados({ status: 'Aberto', pageSize: 1 });
      const e = await listarChamados({ status: 'Em Andamento', pageSize: 1 });
      setHasOpenCalls(((a?.total || 0) + (e?.total || 0)) > 0);
    } catch {
      // silencioso
    }
  };

  const refreshSoonDue = async () => {
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const to   = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // até amanhã
      const lista = await listarAgendamentos({ from: from.toISOString(), to: to.toISOString() });
      const qtd = (lista || []).filter(a =>
        a.status === 'agendado' && new Date(a.start_ts) <= to
      ).length;
      setHasSoonDue(qtd > 0);
    } catch {
      // silencioso
    }
  };

  const refreshMyActive = async () => {
    if (role !== 'manutentor' || !user?.email) { setMyActiveCount(0); return; }
    try {
      const a = await listarChamados({ status: 'Aberto',       manutentorEmail: user.email, pageSize: 1 });
      const e = await listarChamados({ status: 'Em Andamento', manutentorEmail: user.email, pageSize: 1 });
      setMyActiveCount((a?.total || 0) + (e?.total || 0));
    } catch {
      // silencioso
    }
  };

  // Conexão SSE + primeira carga dos badges
  useEffect(() => {
    let stopped = false;

    // carga inicial
    refreshOpenCalls();
    refreshSoonDue();
    refreshMyActive();

    // eventos em tempo real
    const disconnect = connectSSE({
      chamados: () => { if (!stopped) { refreshOpenCalls(); refreshMyActive(); } },
      agendamentos: () => { if (!stopped) refreshSoonDue(); },
      // checklist/pecas não impactam badges do layout; podemos ouvir em cada página específica
    });

    return () => { stopped = true; disconnect(); };
  }, [role, user?.email]);

  const handleLogout = () => {
    try {
      localStorage.removeItem('usuario');
      localStorage.removeItem('dadosTurno');
    } catch {}
    navigate('/login', { replace: true });
  };

  const getDashboardTitle = () => {
    if (role === 'operador')   return t('dashboard.operator');
    if (role === 'manutentor') return t('dashboard.maintainer');
    if (role === 'gestor')     return t('dashboard.manager');
    return '—';
  };

  const NavContent = () => (
    <>
      <NavLink to="/" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink} end>
        <FiHome className={styles.navIcon} />
        <span>{t('nav.home')}</span>
      </NavLink>

      <NavLink to="/perfil" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
        <FiUser className={styles.navIcon} />
        <span>{t('nav.profile')}</span>
      </NavLink>

      {(role === 'manutentor' || role === 'gestor') && (
        <>
          <h3 className={styles.navSectionTitle}>{t('layout.sections.manageMaintenance')}</h3>
          <NavLink
            to="/maquinas"
            className={({ isActive }) => {
              const base = styles.navLink;
              const active = isActive ? ` ${styles.activeLink}` : '';
              const alert  = hasOpenCalls ? ` ${styles.alertLink}` : '';
              return `${base}${active}${alert}`.trim();
            }}
          >
            <div style={{ position: 'relative' }}>
              <FiServer className={styles.navIcon} />
              {hasOpenCalls && <span className={styles.alertBadge} />}
            </div>
            <span>{t('nav.machines')}</span>
          </NavLink>
        </>
      )}

      {role === 'manutentor' && (
        <NavLink
          to="/meus-chamados"
          className={({ isActive }) => {
            const base = styles.navLink;
            const active = isActive ? ` ${styles.activeLink}` : '';
            const alert  = hasMyActiveCalls ? ` ${styles.alertLink}` : '';
            return `${base}${active}${alert}`.trim();
          }}
        >
          <div style={{ position: 'relative' }}>
            <FiClipboard className={styles.navIcon} />
            {hasMyActiveCalls && <span className={styles.alertBadge} title={`${myActiveCount} ${t('nav.activeCalls')}`} />}
          </div>
          <span>{t('nav.myCalls')}</span>
        </NavLink>
      )}

      {role === 'manutentor' && (
        <NavLink
          to="/abrir-chamado"
          className={({ isActive }) => {
            const base = styles.navLink;
            return isActive ? `${base} ${styles.activeLink}` : base;
          }}
        >
          <FiPlusCircle className={styles.navIcon} />
          <span>{t('nav.openCorrective')}</span>
        </NavLink>
      )}

      {(role === 'manutentor' || role === 'gestor') && (
        <NavLink
          to="/calendario-geral"
          className={({ isActive }) => {
            let cls = styles.navLink;
            if (isActive) return `${cls} ${styles.activeLink}`;
            if (hasSoonDue) return `${cls} ${styles.alertLink}`;
            return cls;
          }}
        >
          <FiCalendar className={styles.navIcon} />
          <span>{t('nav.calendar')}</span>
        </NavLink>
      )}

      {(role === 'manutentor' || role === 'gestor') && (
        <NavLink to="/historico" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
          <FiCheckSquare className={styles.navIcon} />
          <span>{t('nav.history')}</span>
        </NavLink>
      )}

      {(role === 'manutentor' || role === 'gestor') && (
        <NavLink to="/estoque" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
          <FiPackage  className={styles.navIcon} />
          <span>{t('nav.inventory')}</span>
        </NavLink>
      )}

      {role === 'gestor' && (
        <>
          <h3 className={styles.navSectionTitle}>{t('layout.sections.analytics')}</h3>
          <NavLink to="/analise-falhas" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
            <FiBarChart2 className={styles.navIcon} />
            <span>{t('nav.failures')}</span>
          </NavLink>

          <NavLink
            to="/causas-raiz"
            className={({ isActive }) =>
              isActive
                ? `${styles.navLink} ${styles.activeLink}`
                : styles.navLink
            }
          >
            <FiPieChart className={styles.navIcon} />
            <span>{t('nav.rootCauses')}</span>
          </NavLink>

          <h3 className={styles.navSectionTitle}>{t('layout.sections.managePeople')}</h3>
          <NavLink to="/gerir-utilizadores" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
            <FiUsers className={styles.navIcon} />
            <span>{t('nav.manageUsers')}</span>
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
          <span className={styles.userEmail}>{user?.nome}</span>
          <button onClick={handleLogout} className={styles.logoutButton} title={t('common.logout', 'Sair')}>
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
          <span className={styles.userEmail}>{user?.nome}</span>
          <button onClick={handleLogout} className={styles.logoutButton} title={t('common.logout', 'Sair')}>
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
          <LanguageMenu className={styles.langMenu} />
        </header>

        <Routes>
          <Route
            path="/"
            element={role === 'operador' ? (
              <OperatorDashboard user={user} />
            ) : (
              <InicioPage user={user} />
            )}
          />

          <Route path="/maquinas/*" element={<MaquinasLayout />}>
            <Route index element={<MaquinasPage />} />
            <Route path="chamado/:id" element={<ChamadoDetalhe user={user} />} />
            <Route path=":id" element={<MaquinaDetalhePage user={user} />} />
          </Route>

          <Route path="/meus-chamados" element={<MeusChamados user={user} />} />
          <Route path="/perfil" element={<PerfilPage user={user} />} />

          <Route path="/historico/*" element={<HistoricoLayout />}>
            <Route index element={<HistoricoPage />} />
            <Route path="chamado/:id" element={<ChamadoDetalhe user={user} />} />
          </Route>

          <Route path="/abrir-chamado" element={<AbrirChamadoManutentor user={user} />} />

          <Route path="/analise-falhas" element={<AnaliseFalhasPage />} />
          <Route path="/causas-raiz" element={<CausasRaizPage user={user} />} />
          <Route path="/calendario-geral" element={<CalendarioGeralPage user={user} />} />
          <Route path="/estoque" element={<EstoquePage user={user} />} />
          <Route path="/gerir-utilizadores" element={<GerirUtilizadoresPage user={user} />} />
        </Routes>
      </main>
    </div>
  );
};

export default MainLayout;
