import React, { useState, useEffect } from 'react'; // Adicionado useState
import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { FiHome, FiLogOut, FiCheckSquare, FiUser, FiCalendar, FiList, FiClock, FiUsers, FiServer, FiEdit, FiCheckCircle, FiMenu, FiX, FiBarChart2 } from 'react-icons/fi';
import styles from './MainLayout.module.css';
import { FiPieChart } from 'react-icons/fi';

import OperatorDashboard from './OperatorDashboard.jsx';
import MaquinasPage from '../pages/MaquinasPage.jsx';
import MaquinaDetalhePage from '../pages/MaquinaDetalhePage.jsx';
import InicioPage from '../pages/InicioPage.jsx';
import ChamadoDetalhe from '../pages/ChamadoDetalhe.jsx';
import HistoricoPage from '../pages/HistoricoPage.jsx';
import PerfilPage from '../pages/PerfilPage.jsx';
import MaquinasLayout from '../pages/MaquinasLayout.jsx';
import HistoricoLayout from "../pages/HistoricoLayout.jsx";
import AnaliseFalhasPage from '../pages/AnaliseFalhasPage.jsx'; // NOVO
import GerirUtilizadoresPage from '../pages/GerirUtilizadoresPage.jsx';
import CalendarioGeralPage from '../pages/CalendarioGeralPage.jsx';
import CausasRaizPage from '../pages/CausasRaizPage.jsx';

import logo from '../assets/logo-sidebar.png';

const MainLayout = ({ user }) => {
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasOpenCalls, setHasOpenCalls] = useState(false);
  const [hasSoonDue, setHasSoonDue] = useState(false);

  useEffect(() => {
    // query para pegar todos chamados com status "Aberto" ou "Em Andamento"
    const q = query(
      collection(db, 'chamados'),
      where('status', 'in', ['Aberto', 'Em Andamento'])
    );
    const unsub = onSnapshot(q, snap => {
      // se vier pelo menos 1 doc, ligamos o alerta
      setHasOpenCalls(snap.size > 0);
    }, err => {
      console.error('Erro ao ouvir chamados abertos:', err);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const daysAhead = 1;
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    // só event.status === 'agendado'
    const q = query(
      collection(db, 'agendamentosPreventivos'),
      where('status', '==', 'agendado'),
      where('start', '<=', cutoff)
    );
    const unsub = onSnapshot(q, snap => {
      setHasSoonDue(snap.size > 0);
    }, err => {
      console.error('Erro ao ouvir próximos agendamentos:', err);
    });
    return () => unsub();
  }, []);

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
          <NavLink
            to="/maquinas"
            className={({ isActive }) => {
              const base = styles.navLink;
              // se está ativo *ou* tem chamados abertos, adiciona classe de alerta
              if (isActive) return `${base} ${styles.activeLink}`;
              if (hasOpenCalls) return `${base} ${styles.alertLink}`;
              return base;
            }}
          >
            <div style={{ position: 'relative' }}>
              <FiServer className={styles.navIcon} />
              {hasOpenCalls && <span className={styles.alertBadge} />}
            </div>
            <span>Máquinas</span>
          </NavLink>
        </>
      )}

      {(user.role === 'manutentor' || user.role === 'gestor') && (
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
                <span>Calendário Geral</span>
            </NavLink>
      )}

      {(user.role === 'manutentor' || user.role === 'gestor') && (
        <NavLink to="/historico" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
          <FiCheckSquare className={styles.navIcon} />
          <span>Histórico</span>
        </NavLink>
      )}

      {user.role === 'gestor' && (
        <>
          {/* NOVA SEÇÃO DE ANÁLISE */}
          <h3 className={styles.navSectionTitle}>Análises e KPIs</h3>
          <NavLink to="/analise-falhas" className={({ isActive }) => isActive ? `${styles.navLink} ${styles.activeLink}` : styles.navLink}>
            <FiBarChart2 className={styles.navIcon} />
            <span>Análise de Falhas</span>
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
            <span>Causas Raiz</span>
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
          </Route>

          <Route path="/perfil" element={<PerfilPage user={user} />} />

          <Route path="/historico/*" element={<HistoricoLayout />}>
            <Route index element={<HistoricoPage />} />
            <Route path="chamado/:id" element={<ChamadoDetalhe user={user} />} />
          </Route>

          <Route path="/analise-falhas" element={<AnaliseFalhasPage />} />
          <Route path="/causas-raiz" element={<CausasRaizPage />} />

          <Route
            path="/calendario-geral"
            element={<CalendarioGeralPage user={user} />}
          />


          <Route path="/gerir-utilizadores" element={<GerirUtilizadoresPage />} />

        </Routes>
      </main>
    </div>
  );
};

export default MainLayout;
