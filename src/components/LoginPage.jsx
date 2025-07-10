// src/components/LoginPage.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import toast from 'react-hot-toast';
import styles from './LoginPage.module.css';
import logo from '../assets/logo.png';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      navigate('/');
    } catch (error) {
      toast.error("E-mail ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // ADICIONAMOS A DIV "INVÓLUCRO" AQUI
    <div className={styles.pageWrapper}> 
      
      {/* O seu código original fica dentro dela */}
      <div className={styles.loginContainer}>
        <div className={styles.logoContainer}>
          <img src={logo} alt="Logo da Empresa" className={styles.logo} />
        </div>

        <h1 className={styles.title}>Fazer login</h1>
        <p className={styles.subtitle}>Use sua Conta</p>

        <form onSubmit={handleLogin} className={styles.loginForm}>
          <div className={styles.inputGroup}>
            <input 
              type="email" 
              id="email" 
              className={styles.input} 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
            <label htmlFor="email" className={styles.label}>E-mail</label>
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
            <label htmlFor="senha" className={styles.label}>Senha</label>
          </div>

          <div className={styles.buttonContainer}>
            <button type="submit" className={styles.nextButton} disabled={loading}>
              {loading ? 'Entrando...' : 'Avançar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
