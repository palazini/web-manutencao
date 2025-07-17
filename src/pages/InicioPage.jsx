// src/pages/InicioPage.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import styles from './InicioPage.module.css';
// 1. Importamos os ícones que vamos usar
import { FiServer, FiCheckSquare, FiUser, FiList } from 'react-icons/fi';

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
          
          {/* Card: Painel de Máquinas (Visível para Manutentor e Gestor) */}
          {(user.role === 'manutentor' || user.role === 'gestor') && (
            <Link to="/maquinas" className={styles.actionCard}>
              <FiServer className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Painel de Máquinas</h3>
              <p className={styles.cardDescription}>Visualize e gerencie o prontuário de todos os equipamentos.</p>
            </Link>
          )}

          {/* Card: Histórico Geral (Visível para Manutentor e Gestor) */}
          {(user.role === 'manutentor' || user.role === 'gestor') && (
            <Link to="/historico" className={styles.actionCard}>
              <FiCheckSquare className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Histórico Geral</h3>
              <p className={styles.cardDescription}>Consulte todos os chamados de manutenção concluídos.</p>
            </Link>
          )}

          {/* Card: Checklists de Tarefas (Exclusivo do Gestor) */}
          {user.role === 'gestor' && (
            <Link to="/gerenciar-checklists" className={styles.actionCard}>
              <FiList className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>Checklists de Tarefas</h3>
              <p className={styles.cardDescription}>Crie e edite os modelos de checklist para as manutenções.</p>
            </Link>
          )}
          
          {/* Card: Meu Perfil (Visível para TODOS os usuários logados) */}
          <Link to="/perfil" className={styles.actionCard}>
            <FiUser className={styles.cardIcon} />
            <h3 className={styles.cardTitle}>Meu Perfil</h3>
            <p className={styles.cardDescription}>Visualize suas informações e altere sua senha.</p>
          </Link>
        </div>
      </div>
    </>
  );
};

export default InicioPage;