import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMaquinas, listarChamados, criarMaquina, deletarMaquina } from '../services/apiClient';
import toast from 'react-hot-toast';
import styles from './MaquinasPage.module.css';
import Modal from '../components/Modal.jsx';
import { FiPlus, FiMoreVertical, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

const MaquinasPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [maquinas, setMaquinas] = useState([]);
  const [chamadosAtivos, setChamadosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal: criar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nomeNovaMaquina, setNomeNovaMaquina] = useState('');

  // menu/ação: editar/excluir
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [alvo, setAlvo] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Descobre usuário atual (opcional, só para esconder UI de gestor)
  function getStoredUser() {
    try {
      const raw = localStorage.getItem('usuario');
      return raw ? JSON.parse(raw) : null;
    } catch {}
    return null;
  }
  function extractRole(u) {
    return String(
      u?.role || u?.user?.role || u?.perfil?.role || ''
    ).trim().toLowerCase();
  }

  const [isGestor, setIsGestor] = React.useState(false);

  React.useEffect(() => {
    const u = getStoredUser();
    const role = extractRole(u);
    setIsGestor(role === 'gestor' || role === 'admin');

    // atualiza se outro tab/loga/sai
    const onStorage = (event) => {
      if (event?.key && event.key !== 'usuario') return;
      const u2 = getStoredUser();
      const r2 = extractRole(u2);
      setIsGestor(r2 === 'gestor' || r2 === 'admin');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    (async () => {
      try {
        // 1) Máquinas
        const lista = await getMaquinas();
        if (!alive) return;
        setMaquinas(lista);

        // 2) Chamados ativos (abertos + em andamento)
        const [abertos, emAndamento] = await Promise.all([
          listarChamados({ status: 'Aberto', page: 1, pageSize: 200 }),
          listarChamados({ status: 'Em Andamento', page: 1, pageSize: 200 }),
        ]);
        const itemsAbertos = abertos.items ?? abertos;
        const itemsAnd = emAndamento.items ?? emAndamento;
        const porId = new Map();
        [...itemsAbertos, ...itemsAnd].forEach((c) => porId.set(c.id, c));
        if (!alive) return;
        setChamadosAtivos([...porId.values()]);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  // Fecha o menu ao clicar fora
  useEffect(() => {
    if (!openMenuId) return;
    const onDocClick = () => setOpenMenuId(null);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [openMenuId]);

  const maquinasComStatus = useMemo(() => {
    const statusPorMaquina = {};
    const prioridade = { corretiva: 3, preventiva: 2, preditiva: 1 };

    chamadosAtivos.forEach((chamado) => {
      const tipo = chamado.tipo || 'corretiva';
      if (!statusPorMaquina[chamado.maquina] || prioridade[tipo] > prioridade[statusPorMaquina[chamado.maquina]]) {
        statusPorMaquina[chamado.maquina] = tipo;
      }
    });

    return maquinas.map((m) => ({ ...m, statusDestaque: statusPorMaquina[m.nome] || 'normal' }));
  }, [maquinas, chamadosAtivos]);

  const getStatusClass = (status) => {
    switch (status) {
      case 'corretiva': return styles.statusCorretiva;
      case 'preventiva': return styles.statusPreventiva;
      case 'preditiva': return styles.statusPreditiva;
      default: return styles.statusNormal;
    }
  };

  const handleCriarMaquina = async (e) => {
    e.preventDefault();
    if (nomeNovaMaquina.trim() === '') {
      toast.error(t('maquinas.toasts.nameRequired'));
      return;
    }
    try {
      const nova = await criarMaquina({ nome: nomeNovaMaquina.trim() });
      setMaquinas((prev) => [nova, ...prev].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')));
      toast.success(t('maquinas.toasts.created', { name: nomeNovaMaquina }));
      setNomeNovaMaquina('');
      setIsModalOpen(false);
    } catch (error) {
      toast.error(t('maquinas.toasts.createError'));
      console.error(error);
    }
  };

  // ======= AÇÕES (menu) =======
  const toggleMenu = (id) => setOpenMenuId((prev) => (prev === id ? null : id));

  const abrirEditar = (maquina, e) => {
    e?.preventDefault(); e?.stopPropagation();
    setOpenMenuId(null);
    navigate(`/maquinas/${maquina.id}/editar`);
  };

  const confirmarExclusao = (maquina, e) => {
    e?.preventDefault(); e?.stopPropagation();
    setAlvo(maquina);
    setIsDeleteOpen(true);
    setOpenMenuId(null);
  };

  const excluir = async () => {
    if (!alvo) return;
    setDeleting(true);
    try {
      // apiClient agora injeta x-user-email automaticamente
      await deletarMaquina(alvo.id);
      setMaquinas(prev => prev.filter(m => m.id !== alvo.id));
      toast.success(t('maquinas.toasts.deleted', { name: alvo.nome }));
    } catch (err) {
      const status = err?.status;
      let msg = t('maquinas.toasts.deleteError');
      if (status === 401) msg = 'Usuário não autenticado. Faça login e tente novamente.';
      else if (status === 403) msg = t('maquinas.toasts.deleteForbidden') || 'Permissão negada (somente gestor).';
      else if (status === 404) msg = t('maquinas.toasts.deleteNotFound') || 'Máquina não encontrada (tente atualizar).';
      else if (status === 409) msg = t('maquinas.toasts.deleteBlocked') || 'Máquina com vínculos.';
      toast.error(msg);
      console.error(err);
    } finally {
      setDeleting(false);
      setIsDeleteOpen(false);
      setAlvo(null);
    }
  };

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>{t('maquinas.title')}</h1>
      </header>

      <div style={{ padding: '20px' }}>
        {loading ? (
          <p>{t('maquinas.loading')}</p>
        ) : (
          <>
            <div className={styles.legendContainer}>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColorBox} ${styles.statusCorretiva}`} />
                <span>{t('maquinas.legend.corretiva')}</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColorBox} ${styles.statusPreventiva}`} />
                <span>{t('maquinas.legend.preventiva')}</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColorBox} ${styles.statusPreditiva}`} />
                <span>{t('maquinas.legend.preditiva')}</span>
              </div>
            </div>

            <div className={styles.grid}>
              {maquinasComStatus.map((maquina) => (
                <div key={maquina.id} className={`${styles.card} ${getStatusClass(maquina.statusDestaque)}`}>
                  {/* botão 3 pontinhos (só para gestor) */}
                  {isGestor && (
                    <button
                      className={styles.menuButton}
                      aria-label={t('maquinas.actions')}
                      aria-haspopup="menu"
                      aria-expanded={openMenuId === maquina.id}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMenu(maquina.id); }}
                      title={t('maquinas.actions')}
                    >
                      <FiMoreVertical />
                    </button>
                  )}

                  {/* dropdown */}
                  {isGestor && openMenuId === maquina.id && (
                    <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
                      <button className={styles.menuItem} onClick={(e) => abrirEditar(maquina, e)}>
                        <FiEdit2 /> {t('common.edit')}
                      </button>
                      <button
                        className={`${styles.menuItem} ${styles.danger}`}
                        onClick={(e) => confirmarExclusao(maquina, e)}
                      >
                        <FiTrash2 /> {t('common.delete')}
                      </button>
                    </div>
                  )}

                  {/* conteúdo clicável do card */}
                  <Link to={`/maquinas/${maquina.id}`} className={styles.cardLink}>
                    <h2>{maquina.nome}</h2>
                    <p>{t('maquinas.cardHint')}</p>
                  </Link>
                </div>
              ))}

              {/* CARD DE ADICIONAR */}
              <div
                className={`${styles.card} ${styles.addCard}`}
                onClick={() => setIsModalOpen(true)}
                role="button"
                aria-label={t('maquinas.modal.title')}
                title={t('maquinas.modal.title')}
              >
                <FiPlus className={styles.addIcon} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* modal: criar máquina */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('maquinas.modal.title')}>
        <form onSubmit={handleCriarMaquina}>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="nome-maquina" style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              {t('maquinas.modal.nameLabel')}
            </label>
            <input
              id="nome-maquina"
              type="text"
              value={nomeNovaMaquina}
              onChange={(e) => setNomeNovaMaquina(e.target.value)}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              required
            />
          </div>
          <button
            type="submit"
            style={{ padding: '10px 15px', border: 'none', borderRadius: '4px', backgroundColor: '#4B70E2', color: 'white', cursor: 'pointer' }}
          >
            {t('maquinas.modal.save')}
          </button>
        </form>
      </Modal>

      {/* modal: confirmar exclusão */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => !deleting && setIsDeleteOpen(false)}
        title={t('maquinas.confirmDelete.title', { name: alvo?.nome ?? '' })}
      >
        <p style={{ marginBottom: 16 }}>{t('maquinas.confirmDelete.text')}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button disabled={deleting} onClick={() => setIsDeleteOpen(false)}>
            {t('common.cancel')}
          </button>
          <button
            onClick={excluir}
            disabled={deleting}
            style={{ background: '#c62828', color: '#fff', border: 0, padding: '8px 12px', borderRadius: 6, opacity: deleting ? 0.7 : 1 }}
          >
            {deleting ? (t('common.deleting') || 'Excluindo...') : t('common.delete')}
          </button>
        </div>
      </Modal>
    </>
  );
};

export default MaquinasPage;
