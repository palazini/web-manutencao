// src/components/LoginPage.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase'; // Importar o 'db' do firestore
import { collection, query, where, getDocs, limit } from 'firebase/firestore'; // Importar funções de busca
import toast from 'react-hot-toast';
import styles from './LoginPage.module.css';
import logo from '../assets/logo.png';

const LoginPage = () => {
  // O estado 'email' agora pode conter um email OU um nome de usuário
  const [userInput, setUserInput] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    let emailParaLogin = userInput; // Por padrão, assume que o input é um email

    try {
      // 1. Verifica se o input NÃO é um email
      if (!userInput.includes('@')) {
        // Se não for, busca o usuário no Firestore pelo nome de usuário
        const q = query(
          collection(db, "usuarios"), 
          where("usuario", "==", userInput),
          limit(1) // Limita a 1 resultado, pois o usuário deve ser único
        );
        
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          // Se não encontrou nenhum usuário com aquele nome, o login falha
          toast.error("Usuário ou senha inválidos.");
          setLoading(false);
          return;
        }
        
        // Se encontrou, pega o email daquele usuário para usar no login
        const userData = querySnapshot.docs[0].data();
        emailParaLogin = userData.email;
      }

      // 2. Tenta fazer o login com o email (seja o original ou o encontrado)
      await signInWithEmailAndPassword(auth, emailParaLogin, senha);
      navigate('/');

    } catch (error) {
      toast.error("Usuário ou senha inválidos.");
      console.error("Erro no login: ", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.loginContainer}>
        <div className={styles.logoContainer}>
          <img src={logo} alt="Logo da Empresa" className={styles.logo} />
        </div>

        <h1 className={styles.title}>Fazer login</h1>
        <p className={styles.subtitle}>Use sua Conta</p>

        <form onSubmit={handleLogin} className={styles.loginForm}>
          <div className={styles.inputGroup}>
            <input 
              type="text" // Mudado para 'text' para aceitar usuário
              id="userInput" 
              className={styles.input} 
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              required 
            />
            <label htmlFor="userInput" className={styles.label}>E-mail ou Nome de Usuário</label>
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
