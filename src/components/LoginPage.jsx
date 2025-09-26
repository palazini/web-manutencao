// src/components/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { login } from '../services/apiClient';
import toast from 'react-hot-toast';
import styles from './LoginPage.module.css';
import logo from '../assets/logo.png';
import LanguageMenu from './LanguageMenu.jsx';

function readStoredUser() {
  try {
    const raw = localStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistUser(userObj) {
  try {
    const json = JSON.stringify(userObj);
    localStorage.setItem('usuario', json);
    ['authUser', 'user', 'currentUser'].forEach((legacyKey) => {
      localStorage.removeItem(legacyKey);
    });
  } catch {}
}

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [userInput, setUserInput] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  // para suportar /login?redirect=/alguma-rota
  const search = new URLSearchParams(location.search);
  const redirectTo = search.get('redirect') || '/maquinas';

  // se já tem sessão no storage, pula login
  useEffect(() => {
    const u = readStoredUser();
    if (u?.email) {
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, redirectTo]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      let identifier = (userInput || '').trim();
      // se foi digitado apenas o usuário, completa domínio
      if (identifier && !identifier.includes('@')) {
        identifier = `${identifier}@m.continua.tpm`;
      }

      const user = await login({ userOrEmail: identifier, senha });

      // normaliza campos essenciais
      const normalized = {
        ...user,
        email: String(user?.email || identifier).trim().toLowerCase(),
        role: String(user?.role || '').trim().toLowerCase(),
      };

      // salva no storage can?nico e limpa chaves legadas
      persistUser(normalized);

      // navega para a área logada
      navigate(redirectTo, { replace: true });
      // Se alguma parte do app só lê storage no mount, descomente:
      // setTimeout(() => window.location.reload(), 0);
    } catch (err) {
      console.error('Erro no login:', err);
      toast.error(t('login.invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageWrapper}>
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
              autoComplete="username"
              autoFocus
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
              autoComplete="current-password"
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
}
