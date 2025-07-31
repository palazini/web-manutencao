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
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import styles from './GerirUtilizadoresPage.module.css';
import Modal from '../components/Modal.jsx';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';

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
      toast.error('Informe nome e sobrenome.');
      setIsSaving(false);
      return;
    }

    const primeiroNome = partes[0].toLowerCase();
    const ultimoNome = partes[partes.length - 1].toLowerCase();
    const nomeUsuario = `${primeiroNome}.${ultimoNome}`;
    const emailGerado = `${nomeUsuario}@m.continua.tpm`;

    let funcao = '';
    switch (role) {
      case 'manutentor': funcao = 'Técnico Eletromecânico'; break;
      case 'operador':   funcao = 'Operador de CNC';         break;
      default:           funcao = 'Gestor';                  break;
    }

    try {
      if (modoEdicao) {
        await setDoc(doc(db, 'usuarios', usuarioEditandoId), {
          nome: nomeCompleto,
          usuario: nomeUsuario,
          email: emailGerado,
          role,
          funcao
        }, { merge: true });

        try {
          await setAdminClaim(usuarioEditandoId, role === 'gestor');
        } catch (err) {
          console.warn('Erro na claim:', err);
          toast.error('Permissão Auth não foi atualizada.');
        }

        toast.success('Utilizador atualizado com sucesso!');
      } else {
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          emailGerado,
          senha
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
          toast.error('Permissão Auth não foi atribuída.');
        }

        toast.success(`Utilizador ${nomeCompleto} criado com sucesso!`);
      }

      setIsSaving(false);
      setNome('');
      setSenha('');
      setRole('operador');
      setModoEdicao(false);
      setUsuarioEditandoId(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Falha ao salvar usuário:', error);
      toast.error('Erro ao salvar utilizador.');
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
    if (!window.confirm(`Excluir utilizador ${nome}?`)) return;
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
        throw new Error(err.error || 'Falha ao excluir utilizador.');
      }
      setUtilizadores(prev => prev.filter(u => u.id !== uid));
      toast.success('Utilizador removido com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir utilizador:', error);
      toast.error(error.message || 'Erro ao excluir utilizador.');
    }
  };

  return (
    <>
      <header className={styles.header}>
        <h1>Gestão de Utilizadores</h1>
        <button className={styles.button} onClick={() => {
          setIsModalOpen(true);
          setModoEdicao(false);
          setUsuarioEditandoId(null);
          setNome('');
          setSenha('');
          setRole('operador');
        }}>
          <FiPlus /> Criar Novo Utilizador
        </button>
      </header>
      <div className={styles.userListContainer}>
        {loading ? (
          <p>A carregar utilizadores...</p>
        ) : (
          <>
            <div className={styles.userListHeader}>
              <span>Nome Completo</span>
              <span>Usuário</span>
              <span>Função</span>
              <span style={{ textAlign: 'right' }}>Ações</span>
            </div>
            <ul className={styles.userList}>
              {utilizadores.map(user => (
                <li key={user.id} className={styles.userItem}>
                  <strong>{user.nome}</strong>
                  <span>{user.usuario}</span>
                  <span>{user.funcao}</span>
                  <div className={styles.actions}>
                    <button className={styles.actionButton} title="Editar" onClick={() => abrirModalEdicao(user)}>
                      <FiEdit />
                    </button>
                    <button
                      className={`${styles.actionButton} ${styles.deleteButton}`}
                      title="Apagar"
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
        title={modoEdicao ? 'Editar Utilizador' : 'Criar Novo Utilizador'}
      >
        <form onSubmit={handleSalvarUtilizador}>
          <div className={styles.formGroup}>
            <label htmlFor="nome">Nome Completo</label>
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
              <label htmlFor="senha">Senha Provisória</label>
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
            <label htmlFor="role">Função (Papel)</label>
            <select
              id="role"
              className={styles.select}
              value={role}
              onChange={e => setRole(e.target.value)}
            >
              <option value="operador">Operador</option>
              <option value="manutentor">Manutentor</option>
              <option value="gestor">Gestor</option>
            </select>
          </div>
          <button
            type="submit"
            className={styles.button}
            disabled={isSaving}
          >
            {isSaving ? 'Salvando...' : (modoEdicao ? 'Salvar Alterações' : 'Criar Utilizador')}
          </button>
        </form>
      </Modal>
    </>
  );
};

export default GerirUtilizadoresPage;
