import React, { useState, useEffect } from 'react';
import { db, secondaryAuth } from '../firebase';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import styles from './GerirUtilizadoresPage.module.css';
import Modal from './components/Modal.jsx';
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
  const [isCreating, setIsCreating] = useState(false);

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
    setIsCreating(true);

    // Validação de nome completo
    const nomeCompleto = nome.trim();
    const partesNome = nomeCompleto.split(' ').filter(p => p);
    if (partesNome.length < 2) {
      toast.error('Por favor, insira o nome e o sobrenome.');
      setIsCreating(false);
      return;
    }

    // Geração de usuário e email
    const primeiroNome = partesNome[0].toLowerCase();
    const ultimoNome = partesNome[partesNome.length - 1].toLowerCase();
    const nomeUsuario = `${primeiroNome}.${ultimoNome}`;
    const emailGerado = `${nomeUsuario}@m.continua.tpm`;

    // Definição de função base em role
    let funcao = '';
    switch (role) {
      case 'manutentor':
        funcao = 'Técnico Eletromecânico';
        break;
      case 'operador':
        funcao = 'Operador de CNC';
        break;
      default:
        funcao = 'Gestor';
    }

    try {
      if (modoEdicao) {
        // Atualização de usuário existente
        await setDoc(doc(db, 'usuarios', usuarioEditandoId), {
          nome: nomeCompleto,
          usuario: nomeUsuario,
          email: emailGerado,
          role,
          funcao
        }, { merge: true });

        // Atualiza claim no Auth
        try {
          await setAdminClaim(usuarioEditandoId, role === 'gestor');
        } catch (err) {
          console.warn('Erro ao atualizar claim:', err);
          toast.error('Permissão no Auth não foi atualizada.');
        }

        toast.success('Utilizador atualizado com sucesso!');
      } else {
        // Cria usuário no Auth
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          emailGerado,
          senha
        );
        const uid = cred.user.uid;

        // Grava no Firestore
        await setDoc(doc(db, 'usuarios', uid), {
          nome: nomeCompleto,
          usuario: nomeUsuario,
          email: emailGerado,
          role,
          funcao
        });

        // Atribui claim de gestor, se aplicável
        try {
          await setAdminClaim(uid, role === 'gestor');
        } catch (err) {
          console.warn('Erro ao atribuir claim:', err);
          toast.error('Permissão no Auth não foi atribuída.');
        }

        toast.success(`Utilizador ${nomeCompleto} criado com sucesso!`);
      }

      // Reset do formulário
      setIsCreating(false);
      setNome('');
      setSenha('');
      setRole('operador');
      setModoEdicao(false);
      setUsuarioEditandoId(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Falha ao salvar usuário:', error);
      toast.error('Erro ao salvar utilizador.');
      setIsCreating(false);
    }
  };

  const abrirModalEdicao = (usuario) => {
    setNome(usuario.nome);
    setRole(usuario.role);
    setSenha(''); // senha não pode ser alterada aqui
    setUsuarioEditandoId(usuario.id);
    setModoEdicao(true);
    setIsModalOpen(true);
  };

  const handleExcluirUtilizador = async (uid, nome) => {
    if (!window.confirm(`Tem certeza que deseja excluir o utilizador ${nome}?`)) return;
    try {
      await deleteDoc(doc(db, 'usuarios', uid));
      toast.success('Utilizador excluído com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir utilizador:', error);
      toast.error('Erro ao excluir utilizador.');
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
                    <button className={`${styles.actionButton} ${styles.deleteButton}`} title="Apagar" onClick={() => handleExcluirUtilizador(user.id, user.nome)}>
                      <FiTrash2 />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modoEdicao ? 'Editar Utilizador' : 'Criar Novo Utilizador'}>
        <form onSubmit={handleSalvarUtilizador}>
          <div className={styles.formGroup}>
            <label htmlFor="nome">Nome Completo</label>
            <input id="nome" type="text" className={styles.input} value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          {!modoEdicao && (
            <div className={styles.formGroup}>
              <label htmlFor="senha">Senha Provisória</label>
              <input id="senha" type="password" className={styles.input} value={senha} onChange={(e) => setSenha(e.target.value)} required minLength="6" />
            </div>
          )}
          <div className={styles.formGroup}>
            <label htmlFor="role">Função (Papel)</label>
            <select id="role" className={styles.select} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="operador">Operador</option>
              <option value="manutentor">Manutentor</option>
              <option value="gestor">Gestor</option>
            </select>
          </div>
          <button type="submit" className={styles.button} disabled={isCreating}>
            {isCreating ? 'Salvando...' : (modoEdicao ? 'Salvar Alterações' : 'Criar Utilizador')}
          </button>
        </form>
      </Modal>
    </>
  );
};

export default GerirUtilizadoresPage;
