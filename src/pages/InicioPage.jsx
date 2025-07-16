// src/pages/InicioPage.jsx

import React from 'react';
import styles from './InicioPage.module.css';

const InicioPage = ({ user }) => {
  return (
    <>
      <header className={styles.header}>
        <h1>Página Inicial</h1>
      </header>
      <div className={styles.content}>
        <h2>Bem-vindo, {user.nome}!</h2>
        <p>Selecione uma opção no menu lateral para começar a gerenciar as manutenções.</p>
      </div>
    </>
  );
};

export default InicioPage;