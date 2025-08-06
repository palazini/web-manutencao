// src/pages/InicioPage.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import styles from './InicioPage.module.css';
// ícones para cada card
import {
  FiServer,
  FiCalendar,
  FiCheckSquare,
  FiBarChart2,
  FiList,
  FiUsers,
  FiUser,
  FiPieChart,
  FiPackage
} from 'react-icons/fi';

const InicioPage = ({ user }) => {
  return (
    <>
      <header className={styles.header}>
        <h1>Página Inicial</h1>
        <p>Bem-vindo de volta, {user.nome}!</p>
      </header>
      <div className={styles.content}>
        <h2>Acesso Rápido</h2>
        <div className={styles.actionsGrid}>

          {/* Painel de Máquinas */}
          {(user.role === 'manutentor' || user.role === 'gestor') && (
            <Link to="/maquinas" className={styles.actionCard}>
              <FiServer className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Painel de Máquinas</h3>
              <p className={styles.cardDescription}>
                Visualize e gerencie o prontuário de todos os equipamentos.
              </p>
            </Link>
          )}

          {/* Calendário Geral */}
          {(user.role === 'manutentor' || user.role === 'gestor') && (
            <Link to="/calendario-geral" className={styles.actionCard}>
              <FiCalendar className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Calendário Geral</h3>
              <p className={styles.cardDescription}>
                Veja o panorama completo de todas as manutenções.
              </p>
            </Link>
          )}

          {/* Histórico Geral */}
          {(user.role === 'manutentor' || user.role === 'gestor') && (
            <Link to="/historico" className={styles.actionCard}>
              <FiCheckSquare className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Histórico Geral</h3>
              <p className={styles.cardDescription}>
                Consulte todos os chamados de manutenção concluídos.
              </p>
            </Link>
          )}

          {/* Estoque */}
          {(user.role === 'manutentor' || user.role === 'gestor') && (
            <Link to="/estoque" className={styles.actionCard}>
              <FiPackage className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Estoque</h3>
              <p className={styles.cardDescription}>
                Controle de entrada e saída de peças do estoque.
              </p>
            </Link>
          )}

          {/* Análise de Falhas */}
          {user.role === 'gestor' && (
            <Link to="/analise-falhas" className={styles.actionCard}>
              <FiBarChart2 className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Análise de Falhas</h3>
              <p className={styles.cardDescription}>
                Veja estatísticas e relatórios de falhas de máquinas.
              </p>
            </Link>
          )}

          {/* Causas Raiz */}
          {user.role === 'gestor' && (
            <Link to="/causas-raiz" className={styles.actionCard}>
              <FiPieChart className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Causas Raiz</h3>
              <p className={styles.cardDescription}>
                Identifique e gerencie as causas raízes das falhas.
              </p>
            </Link>
          )}

          {/* Gerir Utilizadores */}
          {user.role === 'gestor' && (
            <Link to="/gerir-utilizadores" className={styles.actionCard}>
              <FiUsers className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Gerir Utilizadores</h3>
              <p className={styles.cardDescription}>
                Adicione, edite ou remova colaboradores.
              </p>
            </Link>
          )}

          {/* Meu Perfil */}
          <Link to="/perfil" className={styles.actionCard}>
            <FiUser className={styles.cardIcon} />
            <h3 className={styles.cardTitle}>Meu Perfil</h3>
            <p className={styles.cardDescription}>
              Visualize suas informações e altere sua senha.
            </p>
          </Link>

        </div>
      </div>
    </>
  );
};

export default InicioPage;
