import React, { useState, useEffect } from 'react';
import { db, secondaryAuth } from '../firebase';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  setDoc
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  getAuth
} from 'firebase/auth';
import styles from './GerirUtilizadoresPage.module.css';
import Modal from '../components/Modal.jsx';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Helper para atribuir/remover a claim de gestor via função serverless
async function setAdminClaim(uid, makeAdmin) {
  const auth = getAuth();
  const token = await auth.currentUser.getIdToken(true);
  const res = await fetch('/api/setAdminClaim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ uid, makeAdmin })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao atualizar permissão');
  }
}

const GerirUtilizadoresPage = () => {
  const { t } = useTranslation();

  const [utilizadores, setUtilizadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulário
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState('operador');
  const [isSaving, setIsSaving] = useState(false);

  // Edição
  const [modoEdicao, setModoEdicao] = useState(false);
  const [usuarioEditandoId, setUsuarioEditandoId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'usuarios'), orderBy('nome'));
    const unsubscribe = onSnapshot(q, snapshot => {
      setUtilizadores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSalvarUtilizador = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const nomeCompleto = nome.trim();
    const partes = nomeCompleto.split(' ').filter(p => p);
    if (partes.length < 2) {
      toast.error(t('users.validation.fullName'));
      setIsSaving(false);
      return;
    }

    // Lógica para gerar username único
    const primeiroNome = partes[0].toLowerCase();
    const stopWords = ['da', 'de', 'do', 'dos', 'das', 'e'];
    const sobrenomes = partes.slice(1).filter(p => !stopWords.includes(p.toLowerCase()));

    // Define sobrenome base
    let ultimoSobrenome = sobrenomes.length > 0
      ? sobrenomes[sobrenomes.length - 1].toLowerCase()
      : partes[partes.length - 1].toLowerCase();

    let nomeUsuario = `${primeiroNome}.${ultimoSobrenome}`;
    const existingUsernames = utilizadores.map(u => u.usuario);

    // Tenta outros sobrenomes em caso de conflito
    for (let i = sobrenomes.length - 2; i >= 0; i--) {
      const candidato = sobrenomes[i].toLowerCase();
      const candidatoUsuario = `${primeiroNome}.${candidato}`;
      if (!existingUsernames.includes(candidatoUsuario)) {
        nomeUsuario = candidatoUsuario;
        break;
      }
    }

    // Ainda em conflito? adiciona sufixo numérico
    if (existingUsernames.includes(nomeUsuario)) {
      const base = nomeUsuario;
      let suffix = 2;
      while (existingUsernames.includes(`${base}${suffix}`)) {
        suffix++;
      }
      nomeUsuario = `${base}${suffix}`;
    }

    const emailGerado = `${nomeUsuario}@m.continua.tpm`;

    // Define função (mantém como no original para não quebrar relatórios existentes)
    let funcao = '';
    switch (role) {
      case 'manutentor': funcao = 'Técnico Eletromecânico'; break;
      case 'operador':   funcao = 'Operador de CNC';         break;
      default:           funcao = 'Gestor';                  break;
    }

    try {
      if (modoEdicao) {
        // Atualiza usuário existente
        await setDoc(
          doc(db, 'usuarios', usuarioEditandoId),
          { nome: nomeCompleto, usuario: nomeUsuario, email: emailGerado, role, funcao },
          { merge: true }
        );
        try {
          await setAdminClaim(usuarioEditandoId, role === 'gestor');
        } catch (err) {
          console.warn('Erro na claim:', err);
          toast.error(t('users.toasts.authClaimNotUpdated'));
        }
        toast.success(t('users.toasts.updated'));
      } else {
        // Cria novo usuário Auth e Firestore
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth, emailGerado, senha
        );
        const uid = cred.user.uid;
        await setDoc(doc(db, 'usuarios', uid), {
          nome: nomeCompleto,
          usuario: nomeUsuario,
          email: emailGerado,
          role,
          funcao
        });
        try {
          await setAdminClaim(uid, role === 'gestor');
        } catch (err) {
          console.warn('Erro na claim:', err);
          toast.error(t('users.toasts.authClaimNotSet'));
        }
        toast.success(t('users.toasts.created', { name: nomeCompleto }));
      }

      // Reset form
      setIsSaving(false);
      setNome('');
      setSenha('');
      setRole('operador');
      setModoEdicao(false);
      setUsuarioEditandoId(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Falha ao salvar usuário:', error);
      toast.error(t('users.toasts.saveError'));
      setIsSaving(false);
    }
  };

  const abrirModalEdicao = (user) => {
    setNome(user.nome);
    setRole(user.role);
    setModoEdicao(true);
    setUsuarioEditandoId(user.id);
    setSenha('');
    setIsModalOpen(true);
  };

  const handleExcluirUtilizador = async (uid, nome) => {
    if (!window.confirm(t('users.confirm.delete', { name }))) return;
    try {
      const auth = getAuth();
      const token = await auth.currentUser.getIdToken(true);
      const res = await fetch('/api/deleteUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ uid })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('users.toasts.deleteError'));
      }
      setUtilizadores(prev => prev.filter(u => u.id !== uid));
      toast.success(t('users.toasts.deleted'));
    } catch (error) {
      console.error('Erro ao excluir utilizador:', error);
      toast.error(error.message || t('users.toasts.deleteError'));
    }
  };

  return (
    <>
      <header
        className={styles.header}
        style={{
          backgroundColor: '#fff',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}
      >
        <h1>{t('users.title')}</h1>
        <button
          className={styles.button}
          onClick={() => {
            setIsModalOpen(true);
            setModoEdicao(false);
            setUsuarioEditandoId(null);
            setNome(''); setSenha(''); setRole('operador');
          }}
        >
          <FiPlus /> {t('users.actions.create')}
        </button>
      </header>

      <div className={styles.userListContainer}>
        {loading ? (
          <p>{t('users.loading')}</p>
        ) : (
          <>
            <div className={styles.userListHeader}>
              <span>{t('users.table.fullName')}</span>
              <span>{t('users.table.username')}</span>
              <span>{t('users.table.function')}</span>
              <span style={{ textAlign: 'right' }}>{t('users.table.actions')}</span>
            </div>
            <ul className={styles.userList}>
              {utilizadores.map(user => (
                <li key={user.id} className={styles.userItem}>
                  <strong>{user.nome}</strong>
                  <span>{user.usuario}</span>
                  <span>{user.funcao}</span>
                  <div className={styles.actions}>
                    <button
                      className={styles.actionButton}
                      title={t('users.actions.edit')}
                      onClick={() => abrirModalEdicao(user)}
                    >
                      <FiEdit />
                    </button>
                    <button
                      className={`${styles.actionButton} ${styles.deleteButton}`}
                      title={t('users.actions.delete')}
                      onClick={() => handleExcluirUtilizador(user.id, user.nome)}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modoEdicao ? t('users.modal.editTitle') : t('users.modal.createTitle')}
      >
        <form onSubmit={handleSalvarUtilizador}>
          <div className={styles.formGroup}>
            <label htmlFor="nome">{t('users.form.fullName')}</label>
            <input
              id="nome"
              type="text"
              className={styles.input}
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
            />
          </div>

          {!modoEdicao && (
            <div className={styles.formGroup}>
              <label htmlFor="senha">{t('users.form.tempPassword')}</label>
              <input
                id="senha"
                type="password"
                className={styles.input}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                minLength="6"
              />
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="role">{t('users.form.role')}</label>
            <select
              id="role"
              className={styles.select}
              value={role}
              onChange={e => setRole(e.target.value)}
            >
              <option value="operador">{t('users.roles.operator')}</option>
              <option value="manutentor">{t('users.roles.maintainer')}</option>
              <option value="gestor">{t('users.roles.manager')}</option>
            </select>
          </div>

          <button type="submit" className={styles.button} disabled={isSaving}>
            {isSaving
              ? t('users.form.saving')
              : modoEdicao
                ? t('users.form.saveChanges')
                : t('users.form.createUser')}
          </button>
        </form>
      </Modal>
    </>
  );
};

export default GerirUtilizadoresPage;
