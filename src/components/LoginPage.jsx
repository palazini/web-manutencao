// src/components/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { login } from '../services/apiClient';
import toast from 'react-hot-toast';
import styles from './LoginPage.module.css';
import logo from '../assets/logo.png';

// ⬇️ novo: seletor de idioma com popover
import LanguageMenu from './LanguageMenu.jsx';

const LoginPage = () => {
  const { t } = useTranslation();
  const [userInput, setUserInput] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    let identifier = (userInput || '').trim();

    try {
      // se usuário sem @ foi digitado, assume o domínio da empresa
      if (identifier && !identifier.includes('@')) {
        identifier = `${identifier}@m.continua.tpm`;
      }
      // chama sua API
      const user = await login({ userOrEmail: identifier, senha });
      // persiste sessão simples (o seu App pode ler isso ao iniciar)
      try { localStorage.setItem('authUser', JSON.stringify(user)); } catch {}
      navigate('/', { replace: true });
      // opcional: forçar re-load se seu App ainda lê usuário do localStorage no mount
      // window.location.reload();
    } catch (error) {
      toast.error(t('login.invalid'));
      console.error('Erro no login: ', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      {/* Seletor de idioma (popover) */}
      <LanguageMenu className={styles.loginLangMenu} />

      <div className={styles.loginContainer}>
        <div className={styles.logoContainer}>
          <img src={logo} alt="Logo" className={styles.logo} />
        </div>

        <h1 className={styles.title}>{t('login.title')}</h1>
        <p className={styles.subtitle}>{t('login.subtitle')}</p>

        <form onSubmit={handleLogin} className={styles.loginForm}>
          <div className={styles.inputGroup}>
            <input
              type="text"
              id="userInput"
              className={styles.input}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              required
            />
            <label htmlFor="userInput" className={styles.label}>
              {t('login.userOrEmail')}
            </label>
          </div>

          <div className={styles.inputGroup}>
            <input
              type="password"
              id="senha"
              className={styles.input}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            <label htmlFor="senha" className={styles.label}>
              {t('login.password')}
            </label>
          </div>

          <div className={styles.buttonContainer}>
            <button type="submit" className={styles.nextButton} disabled={loading}>
              {loading ? t('login.loading') : t('login.next')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
