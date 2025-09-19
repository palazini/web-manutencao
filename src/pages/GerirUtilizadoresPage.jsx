import React, { useState, useEffect } from 'react';
import styles from './GerirUtilizadoresPage.module.css';
import Modal from '../components/Modal.jsx';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { listarUsuarios, criarUsuario, atualizarUsuario, excluirUsuario } from '../services/apiClient';

const GerirUtilizadoresPage = ({ user }) => {
  const { t } = useTranslation();

  const [utilizadores, setUtilizadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filtro
  const [roleFiltro, setRoleFiltro] = useState('all');

  // Formulário
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState(''); // Dica: sem efeito agora; deixado opcional
  const [role, setRole] = useState('operador');
  const [isSaving, setIsSaving] = useState(false);

  // Edição
  const [modoEdicao, setModoEdicao] = useState(false);
  const [usuarioEditandoId, setUsuarioEditandoId] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const itens = await listarUsuarios({ role: roleFiltro });
        if (!alive) return;
        setUtilizadores(itens);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [roleFiltro]);

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

    // Geração de username/email
    const primeiroNome = partes[0].toLowerCase();
    const stopWords = ['da', 'de', 'do', 'dos', 'das', 'e'];
    const sobrenomes = partes.slice(1).filter(p => !stopWords.includes(p.toLowerCase()));

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

    // Mantém mapeamento de função usado nos relatórios
    let funcao = '';
    switch (role) {
      case 'manutentor': funcao = 'Técnico Eletromecânico'; break;
      case 'operador':   funcao = 'Operador de CNC';         break;
      default:           funcao = 'Gestor';                  break;
    }

    try {
      if (modoEdicao) {
        const saved = await atualizarUsuario(
          usuarioEditandoId,
          { nome: nomeCompleto, usuario: nomeUsuario, email: emailGerado, role, funcao },
          { role: user?.role, email: user?.email }
        );
        setUtilizadores(prev =>
          prev
            .map(u => (u.id === saved.id ? saved : u))
            .filter(u => roleFiltro === 'all' || u.role === roleFiltro)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
        );
        toast.success(t('users.toasts.updated'));
      } else {
        const payload = {
          nome: nomeCompleto,
          usuario: nomeUsuario,
          email: emailGerado,
          role,
          funcao,
          ...(senha?.trim()?.length >= 6 ? { senha: senha.trim() } : {})
        };
        const saved = await criarUsuario(
          payload,
          { role: user?.role, email: user?.email }
        );
        setUtilizadores(prev => {
          const next = roleFiltro === 'all' || saved.role === roleFiltro ? [...prev, saved] : prev;
          return next.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
        });
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

  const abrirModalEdicao = (userRow) => {
    setNome(userRow.nome);
    setRole(userRow.role);
    setModoEdicao(true);
    setUsuarioEditandoId(userRow.id);
    setSenha('');
    setIsModalOpen(true);
  };

  const handleExcluirUtilizador = async (uid, nome) => {
    // correção pequena: usa a variável "nome" no confirm
    if (!window.confirm(t('users.confirm.delete', { name: nome }))) return;
    try {
      await excluirUsuario(uid, { role: user?.role, email: user?.email });
      setUtilizadores(prev => prev.filter(u => u.id !== uid));
      toast.success(t('users.toasts.deleted'));
    } catch (error) {
      console.error('Erro ao excluir utilizador:', error);
      toast.error(error.message || t('users.toasts.deleteError'));
    }
  };

  return (
    <>
      {/* Header sem o filtro */}
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
        {/* Toolbar de filtro deslocada para dentro da caixa dos usuários */}
        <div className={styles.userListToolbar}>
          <div className={styles.filterGroup}>
            <label htmlFor="roleFiltro" className={styles.filterLabel}>
              {t('users.form.role')}
            </label>
            <select
              id="roleFiltro"
              className={`${styles.select} ${styles.filterSelect}`}
              value={roleFiltro}
              onChange={(e) => setRoleFiltro(e.target.value)}
            >
              <option value="all">{t('users.roles.all')}</option>
              <option value="gestor">{t('users.roles.manager')}</option>
              <option value="manutentor">{t('users.roles.maintainer')}</option>
              <option value="operador">{t('users.roles.operator')}</option>
            </select>
          </div>
        </div>

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
              {utilizadores.map(userRow => (
                <li key={userRow.id} className={styles.userItem}>
                  <strong>{userRow.nome}</strong>
                  <span>{userRow.usuario}</span>
                  <span>{userRow.funcao}</span>
                  <div className={styles.actions}>
                    <button
                      className={styles.actionButton}
                      title={t('users.actions.edit')}
                      onClick={() => abrirModalEdicao(userRow)}
                    >
                      <FiEdit />
                    </button>
                    <button
                      className={`${styles.actionButton} ${styles.deleteButton}`}
                      title={t('users.actions.delete')}
                      onClick={() => handleExcluirUtilizador(userRow.id, userRow.nome)}
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
