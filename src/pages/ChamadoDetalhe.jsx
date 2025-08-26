import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  doc, onSnapshot, updateDoc, serverTimestamp, Timestamp, getDoc,
  arrayUnion, collection, addDoc, query, where, orderBy, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import styles from './ChamadoDetalhe.module.css';
import { useTranslation } from 'react-i18next';
import { statusKey } from '../i18n/format';

// (mantém util se precisar em algum ponto específico)
function asDate(v) {
  try {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

const ChamadoDetalhe = ({ user }) => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [chamado, setChamado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // conclusão
  const [solucao, setSolucao] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [causas, setCausas] = useState([]);
  const [causa, setCausa] = useState('');

  // observações
  const [novaObservacao, setNovaObservacao] = useState('');

  // atribuição
  const [manutentores, setManutentores] = useState([]);
  const [selectedManutentor, setSelectedManutentor] = useState('');
  const [assigning, setAssigning] = useState(false);

  const isGestor = user?.role === 'gestor';
  const isManutentor = user?.role === 'manutentor';

  const [isDeleting, setIsDeleting] = useState(false);
  const podeExcluir = isGestor && ['Aberto', 'Em Andamento', 'Concluído'].includes(chamado?.status);

  // formatter de data/hora conforme idioma atual
  const fmtDate = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short' }),
    [i18n.language]
  );
  const fmtDateTime = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }),
    [i18n.language]
  );

  // --------- carregar chamado ---------
  useEffect(() => {
    const ref = doc(db, 'chamados', id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setChamado(null);
          setLoading(false);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setChamado(data);

        if (Array.isArray(data.checklist)) {
          const lista = data.checklist.map((it) => ({ ...it, resposta: it.resposta || 'sim' }));
          setChecklist(lista);
        }

        if (data.assignedTo) setSelectedManutentor(data.assignedTo);
        setCausa(data.causa || '');
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao ouvir chamado:', err);
        toast.error(t('chamadoDetalhe.toasts.loadError'));
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id, t]);

  // --------- causas raiz ---------
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'causasRaiz'),
      (snap) => {
        const lista = snap.docs.map((d) => d.data()?.nome).filter(Boolean);
        setCausas(lista);
      },
      (err) => console.error('Erro ao listar causas:', err)
    );
    return () => unsub();
  }, []);

  // --------- manutentores (somente gestor) ---------
  useEffect(() => {
    if (!isGestor) return;
    const q = query(
      collection(db, 'usuarios'),
      where('role', '==', 'manutentor'),
      orderBy('nome', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs.map((d) => {
          const u = d.data() || {};
          return { uid: d.id, nome: u.nome || u.displayName || u.email || d.id };
        });
        setManutentores(lista);
      },
      () => toast.error(t('chamadoDetalhe.toasts.listMaintDenied'))
    );
    return () => unsub();
  }, [isGestor, t]);

  // --------- ações: atribuir / remover atribuição ---------
  async function handleAtribuir() {
    if (!selectedManutentor) {
      toast.error(t('chamadoDetalhe.toasts.selectMaint'));
      return;
    }
    setAssigning(true);
    try {
      const ref = doc(db, 'chamados', id);
      const alvo = manutentores.find((m) => m.uid === selectedManutentor);
      await updateDoc(ref, {
        assignedTo: selectedManutentor,
        assignedToNome: alvo?.nome || '',
        assignedBy: user?.uid || '',
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        observacoes: arrayUnion({
          texto: t('chamadoDetalhe.history.assigned', {
            assignee: alvo?.nome || selectedManutentor,
            by: user?.nome || user?.displayName || t('common.manager')
          }),
          autor: 'Sistema',
          data: Timestamp.now()
        })
      });
      toast.success(t('chamadoDetalhe.toasts.assigned'));
    } catch (e) {
      console.error(e);
      toast.error(t('chamadoDetalhe.toasts.assignError'));
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemoverAtribuicao() {
    setAssigning(true);
    try {
      const ref = doc(db, 'chamados', id);
      await updateDoc(ref, {
        assignedTo: null,
        assignedToNome: null,
        assignedBy: user?.uid || '',
        assignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        observacoes: arrayUnion({
          texto: t('chamadoDetalhe.history.unassigned', {
            by: user?.nome || user?.displayName || t('common.manager')
          }),
          autor: 'Sistema',
          data: Timestamp.now()
        })
      });
      setSelectedManutentor('');
      toast.success(t('chamadoDetalhe.toasts.unassigned'));
    } catch (e) {
      console.error(e);
      toast.error(t('chamadoDetalhe.toasts.unassignError'));
    } finally {
      setAssigning(false);
    }
  }

  // --------- ações: atender / concluir / observação ---------
  const podeAtender =
    isManutentor &&
    chamado?.status === 'Aberto' &&
    (!chamado?.assignedTo || chamado?.assignedTo === user?.uid);

  const podeConcluir =
    isManutentor &&
    chamado?.status === 'Em Andamento' &&
    chamado?.manutentorId === user?.uid;

  async function handleAtenderChamado() {
    if (chamado?.assignedTo && chamado.assignedTo !== user?.uid) {
      toast.error(t('chamadoDetalhe.toasts.assignedToOther'));
      return;
    }
    setIsUpdating(true);
    try {
      const ref = doc(db, 'chamados', id);
      await updateDoc(ref, {
        status: 'Em Andamento',
        manutentorId: user?.uid,
        manutentorNome: user?.nome || user?.displayName || user?.email || '—',
        updatedAt: serverTimestamp(),
        observacoes: arrayUnion({
          texto: t('chamadoDetalhe.history.taken', {
            by: user?.nome || user?.displayName || t('common.maintainer')
          }),
          autor: 'Sistema',
          data: Timestamp.now()
        })
      });
      toast.success(t('chamadoDetalhe.toasts.taken'));
    } catch (e) {
      console.error(e);
      toast.error(t('chamadoDetalhe.toasts.takeError'));
    } finally {
      setIsUpdating(false);
    }
  }

  function handleChecklistItemToggle(index, value) {
    const novo = [...checklist];
    novo[index].resposta = value;
    setChecklist(novo);
  }

  async function handleAdicionarObservacao() {
    const texto = (novaObservacao || '').trim();
    if (!texto) return;
    setIsUpdating(true);
    try {
      const ref = doc(db, 'chamados', id);
      await updateDoc(ref, {
        updatedAt: serverTimestamp(),
        observacoes: arrayUnion({
          texto,
          autor: user?.nome || user?.displayName || user?.email || '—',
          data: Timestamp.now()
        })
      });
      setNovaObservacao('');
      toast.success(t('chamadoDetalhe.toasts.noteAdded'));
    } catch (e) {
      console.error(e);
      toast.error(t('chamadoDetalhe.toasts.noteError'));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleConcluirChamado(e) {
    e.preventDefault();

    if (chamado?.manutentorId && chamado.manutentorId !== user?.uid) {
      toast.error(t('chamadoDetalhe.toasts.finishOnlyOwner'));
      return;
    }

    setIsUpdating(true);
    const ref = doc(db, 'chamados', id);
    const updatesBase = {
      status: 'Concluído',
      dataConclusao: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      if (chamado?.tipo === 'preventiva') {
        const itensComFalha = (checklist || []).filter((i) => i.resposta === 'nao');
        await updateDoc(ref, { ...updatesBase, checklist });

        if (itensComFalha.length > 0) {
          for (const item of itensComFalha) {
            await addDoc(collection(db, 'chamados'), {
              maquina: chamado.maquina,
              descricao: t('chamadoDetalhe.autoCorrective', { item: item.item }),
              status: 'Aberto',
              tipo: 'corretiva',
              operadorNome: t('chamadoDetalhe.autoBy', { name: user?.nome || user?.displayName || '—' }),
              dataAbertura: serverTimestamp()
            });
          }
          toast.success(t('chamadoDetalhe.toasts.autoOpened', { count: itensComFalha.length }));
        }
      } else {
        if (!causa) {
          toast.error(t('chamadoDetalhe.toasts.selectCause'));
          setIsUpdating(false);
          return;
        }
        if (!solucao.trim()) {
          toast.error(t('chamadoDetalhe.toasts.describeService'));
          setIsUpdating(false);
          return;
        }
        await updateDoc(ref, { ...updatesBase, causa, solucao });
      }

      // atualizar agendamento (se houver)
      if (chamado?.agendamentoId) {
        const agRef = doc(db, 'agendamentosPreventivos', chamado.agendamentoId);
        const agSnap = await getDoc(agRef);
        let original = null;
        if (agSnap.exists()) {
          const raw = agSnap.data().originalStart;
          original = asDate(raw);
        }
        const now = new Date();
        let atrasado = false;
        if (original) {
          const origDay = new Date(original.getFullYear(), original.getMonth(), original.getDate());
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          atrasado = today > origDay;
        }
        await updateDoc(agRef, { status: 'concluido', concluidoEm: serverTimestamp(), atrasado });
      }

      // atualizar plano (preventivo/preditivo) se houver
      if (chamado?.planoId) {
        const collectionName = chamado.tipo === 'preventiva' ? 'planosPreventivos' : 'planosPreditivos';
        const planoRef = doc(db, collectionName, chamado.planoId);
        const planoSnap = await getDoc(planoRef);
        if (planoSnap.exists()) {
          const plano = planoSnap.data();
          const novaProximaData = new Date();
          if (plano?.frequencia) {
            novaProximaData.setDate(novaProximaData.getDate() + Number(plano.frequencia || 0));
          }
          await updateDoc(planoRef, { proximaData: novaProximaData, dataUltimaManutencao: serverTimestamp() });
        }
      }

      toast.success(t('chamadoDetalhe.toasts.finished'));
      navigate('/');
    } catch (e) {
      console.error('Erro ao concluir:', e);
      toast.error(t('chamadoDetalhe.toasts.finishError'));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleExcluirChamado() {
    if (!isGestor) {
      toast.error(t('chamadoDetalhe.toasts.onlyManagerDelete'));
      return;
    }
    if (!window.confirm(t('chamadoDetalhe.delete.confirm'))) return;

    setIsDeleting(true);
    try {
      if (chamado?.origin === 'checklist' && chamado?.refLockId) {
        try {
          const lockRef = doc(db, 'checklistLocks', chamado.refLockId);
          await updateDoc(lockRef, { status: 'Concluído', unlockedAt: serverTimestamp() });
        } catch (e) {
          console.warn('Não foi possível atualizar lock antes de excluir:', e);
        }
      }

      await deleteDoc(doc(db, 'chamados', id));

      toast.success(t('chamadoDetalhe.toasts.deleted'));
      navigate(-1);
    } catch (e) {
      console.error('Erro ao excluir chamado:', e);
      toast.error(t('chamadoDetalhe.toasts.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  }

  // --------- render ---------
  if (loading) return <p style={{ padding: 20 }}>{t('common.loading')}</p>;
  if (!chamado) return <p style={{ padding: 20 }}>{t('chamadoDetalhe.notFound')}</p>;

  const openedAt = chamado?.dataAbertura ? fmtDateTime.format(asDate(chamado.dataAbertura)) : '—';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>{t('chamadoDetalhe.header.machine', { name: chamado.maquina })}</h1>
        <small>
          {t('chamadoDetalhe.header.openedBy', {
            name: chamado.operadorNome,
            date: openedAt
          })}
        </small>
      </header>

      <div className={styles.card}>
        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}>
            <strong>{t('chamadoDetalhe.fields.status')}</strong>
            <p>
              <span className={`${styles.statusBadge} ${styles[chamado.status?.toLowerCase()?.replace(' ', '')]}`}>
                {t(`status.${statusKey(chamado.status)}`)}
              </span>
            </p>
          </div>

          {chamado.manutentorNome && (
            <div className={styles.detailItem}>
              <strong>{t('chamadoDetalhe.fields.takenBy')}</strong>
              <p>{chamado.manutentorNome}</p>
            </div>
          )}

          {chamado.assignedToNome && (
            <div className={styles.detailItem}>
              <strong>{t('chamadoDetalhe.fields.assignedTo')}</strong>
              <p>{chamado.assignedToNome}</p>
            </div>
          )}

          <div className={styles.detailItem}>
            <strong>{t('chamadoDetalhe.fields.reportedProblem')}</strong>
            <p style={{ wordBreak: 'break-word' }}>{chamado.descricao}</p>
          </div>

          {chamado.status === 'Concluído' && (
            chamado.tipo === 'preventiva' ? (
              <div className={styles.detailItem}>
                <strong>{t('chamadoDetalhe.fields.checklistDone')}</strong>
                <p>
                  {((chamado.checklist || []).filter(i => i.resposta === 'sim').length)} {t('chamadoDetalhe.of')} {(chamado.checklist || []).length}
                </p>
              </div>
            ) : (
              <div className={styles.detailItem}>
                <strong>{t('chamadoDetalhe.fields.performedService')}</strong>
                <p style={{ wordBreak: 'break-word' }}>{chamado.solucao}</p>
                <small>{t('chamadoDetalhe.fields.finishedAt', {
                  date: chamado.dataConclusao ? fmtDateTime.format(asDate(chamado.dataConclusao)) : '—'
                })}</small>
              </div>
            )
          )}

          {chamado.tipo !== 'preventiva' && ['Em Andamento', 'Concluído'].includes(chamado.status) && (
            <div className={styles.detailItem}>
              <strong>{t('chamadoDetalhe.fields.cause')}</strong>
              {chamado.status === 'Em Andamento' ? (
                <select
                  id="causa"
                  value={causa}
                  onChange={(e) => setCausa(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="" disabled>{t('chamadoDetalhe.selects.causePlaceholder')}</option>
                  {causas.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome.charAt(0).toUpperCase() + nome.slice(1)}
                    </option>
                  ))}
                </select>
              ) : (
                <p className={styles.readonlyField}>{chamado.causa || '–'}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Atribuição (gestor) */}
      {isGestor && chamado.status !== 'Concluído' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{t('chamadoDetalhe.assign.title')}</h2>
          <div className={styles.formGroup}>
            <label htmlFor="manutentor">{t('chamadoDetalhe.assign.label')}</label>
            <select
              id="manutentor"
              className={styles.select}
              value={selectedManutentor}
              onChange={(e) => setSelectedManutentor(e.target.value)}
            >
              <option value="">{t('chamadoDetalhe.assign.placeholder')}</option>
              {manutentores.map((m) => (
                <option key={m.uid} value={m.uid}>{m.nome}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={handleAtribuir} className={styles.button} disabled={assigning || !selectedManutentor}>
              {assigning ? t('common.processing') : (chamado.assignedTo ? t('chamadoDetalhe.assign.reassign') : t('chamadoDetalhe.assign.assign'))}
            </button>
            {chamado.assignedTo && (
              <button
                onClick={handleRemoverAtribuicao}
                className={styles.button}
                disabled={assigning}
                style={{ backgroundColor: '#6c757d' }}
              >
                {assigning ? t('common.processing') : t('chamadoDetalhe.assign.remove')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Observações */}
      <div className={`${styles.card} ${styles.historySection}`}>
        <h2 className={styles.cardTitle}>{t('chamadoDetalhe.history.title')}</h2>

        {podeConcluir && (
          <div className={styles.formGroup}>
            <label htmlFor="observacao">{t('chamadoDetalhe.history.add')}</label>
            <textarea
              id="observacao"
              className={styles.textarea}
              rows="3"
              value={novaObservacao}
              onChange={(e) => setNovaObservacao(e.target.value)}
            />
            <button
              onClick={handleAdicionarObservacao}
              className={styles.button}
              disabled={isUpdating}
              style={{ marginTop: 10 }}
            >
              {isUpdating ? t('common.saving') : t('chamadoDetalhe.history.saveNote')}
            </button>
          </div>
        )}

        <ul className={styles.historyList}>
          {(chamado.observacoes || []).slice().reverse().map((obs, i) => (
            <li key={i} className={styles.historyItem}>
              <div className={styles.historyHeader}>
                <strong>{obs.autor || '—'}</strong>
                <span>{obs.data ? fmtDateTime.format(asDate(obs.data)) : '—'}</span>
              </div>
              <p className={styles.historyContent}>{obs.texto}</p>
            </li>
          ))}
          {(!chamado.observacoes || chamado.observacoes.length === 0) && <p>{t('chamadoDetalhe.history.empty')}</p>}
        </ul>
      </div>

      {/* Ações */}
      {podeAtender && (
        <div className={styles.card}>
          <button onClick={handleAtenderChamado} className={styles.button} disabled={isUpdating}>
            {isUpdating ? t('common.processing') : t('chamadoDetalhe.actions.take')}
          </button>
        </div>
      )}

      {podeConcluir && (
        chamado.tipo === 'preventiva' ? (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t('chamadoDetalhe.preventive.title')}</h2>
            <form onSubmit={handleConcluirChamado} className={styles.checklistContainer}>
              {checklist.map((item, idx) => (
                <div key={idx} className={styles.checklistItem}>
                  <span className={styles.itemLabel}>{item.item}</span>
                  <div className={styles.radioGroup}>
                    <input
                      type="radio"
                      id={`sim-${idx}`}
                      name={`resposta-${idx}`}
                      checked={item.resposta === 'sim'}
                      onChange={() => handleChecklistItemToggle(idx, 'sim')}
                    />
                    <label htmlFor={`sim-${idx}`}>{t('common.yes')}</label>

                    <input
                      type="radio"
                      id={`nao-${idx}`}
                      name={`resposta-${idx}`}
                      checked={item.resposta === 'nao'}
                      onChange={() => handleChecklistItemToggle(idx, 'nao')}
                    />
                    <label htmlFor={`nao-${idx}`}>{t('common.no')}</label>
                  </div>
                </div>
              ))}
              <button type="submit" className={styles.button} disabled={isUpdating}>
                {isUpdating ? t('chamadoDetalhe.actions.finishing') : t('chamadoDetalhe.actions.finish')}
              </button>
            </form>
          </div>
        ) : (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t('chamadoDetalhe.corrective.title')}</h2>
            <form onSubmit={handleConcluirChamado}>
              <div className={styles.formGroup}>
                <label htmlFor="solucao">{t('chamadoDetalhe.corrective.solutionLabel')}</label>
                <textarea
                  id="solucao"
                  className={styles.textarea}
                  rows="5"
                  value={solucao}
                  onChange={(e) => setSolucao(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className={styles.button} disabled={isUpdating || !causa}>
                {isUpdating ? t('common.saving') : t('chamadoDetalhe.actions.finish')}
              </button>
            </form>
          </div>
        )
      )}

      {podeExcluir && (
        <div className={styles.card} style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleExcluirChamado}
            className={`${styles.button} ${styles.buttonDanger}`}
            disabled={isDeleting}
            title={t('chamadoDetalhe.delete.title')}
          >
            {isDeleting ? t('common.deleting') : t('chamadoDetalhe.delete.button')}
          </button>
        </div>
      )}
    </div>
  );
};

export default ChamadoDetalhe;
