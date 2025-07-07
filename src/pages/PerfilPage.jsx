// src/pages/PerfilPage.jsx

import React, { useState } from 'react';
import styles from './PerfilPage.module.css';
import toast from 'react-hot-toast';
import { auth } from '../firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

const PerfilPage = ({ user }) => {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (novaSenha !== confirmarSenha) {
      toast.error("As novas senhas não coincidem.");
      setLoading(false);
      return;
    }
    if (novaSenha.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      setLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    const credencial = EmailAuthProvider.credential(currentUser.email, senhaAtual);

    try {
      // 1. Reautentica o usuário com a senha atual para segurança
      await reauthenticateWithCredential(currentUser, credencial);

      // 2. Se a reautenticação for bem-sucedida, atualiza para a nova senha
      await updatePassword(currentUser, novaSenha);

      toast.success("Senha alterada com sucesso!");
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/wrong-password') {
        toast.error("A senha atual está incorreta.");
      } else {
        toast.error("Ocorreu um erro ao alterar a senha.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Meu Perfil</h1>
      </header>
      <div className={styles.container} style={{ padding: '20px' }}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Minhas Informações</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}><strong>Nome</strong><p>{user.nome}</p></div>
            <div className={styles.infoItem}><strong>Email</strong><p>{user.email}</p></div>
            <div className={styles.infoItem}><strong>Função</strong><p style={{ textTransform: 'capitalize' }}>{user.role}</p></div>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Alterar Senha</h2>
          <form onSubmit={handleChangePassword}>
            <div className={styles.formGroup}>
              <label htmlFor="senha-atual">Senha Atual</label>
              <input type="password" id="senha-atual" className={styles.input} value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="nova-senha">Nova Senha</label>
              <input type="password" id="nova-senha" className={styles.input} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="confirmar-senha">Confirmar Nova Senha</label>
              <input type="password" id="confirmar-senha" className={styles.input} value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} required />
            </div>
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default PerfilPage;