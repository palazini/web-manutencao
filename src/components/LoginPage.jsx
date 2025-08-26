// src/components/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { auth } from '../firebase';
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
    let emailParaLogin = userInput;

    try {
      if (!userInput.includes('@')) {
        emailParaLogin = `${userInput}@m.continua.tpm`;
      }
      await signInWithEmailAndPassword(auth, emailParaLogin, senha);
      navigate('/');
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
