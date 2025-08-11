import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp, Timestamp, getDoc, arrayUnion, collection, addDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import styles from './ChamadoDetalhe.module.css';

function formatTS(tsOrDate) {
  try {
    if (!tsOrDate) return '—';
    if (typeof tsOrDate.toDate === 'function') {
      return tsOrDate.toDate().toLocaleString('pt-BR');
    }
    const d = tsOrDate instanceof Date ? tsOrDate : new Date(tsOrDate);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
  } catch {
    return '—';
  }
}

const ChamadoDetalhe = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [chamado, setChamado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // campos de conclusão
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

        // preparar checklist (se houver)
        if (Array.isArray(data.checklist)) {
          const lista = data.checklist.map((it) => ({
            ...it,
            resposta: it.resposta || 'sim'
          }));
          setChecklist(lista);
        }

        // pré-selecionar manutentor se já houver atribuição
        if (data.assignedTo) setSelectedManutentor(data.assignedTo);

        // causa (não-preventiva)
        setCausa(data.causa || '');

        setLoading(false);
      },
      (err) => {
        console.error('Erro ao ouvir chamado:', err);
        toast.error('Erro ao carregar chamado.');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id]);

  // --------- carregar causas raiz ---------
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

  // --------- carregar lista de manutentores (somente gestor) ---------
  useEffect(() => {
    if (!isGestor) return;
    const q = query(
      collection(db, 'usuarios'),
      where('role', '==', 'manutentor'),
      orderBy('nome', 'asc') // se não tiver "nome", trocamos depois
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs.map((d) => {
          const u = d.data() || {};
          return {
            uid: d.id,
            nome: u.nome || u.displayName || u.email || d.id
          };
        });
        setManutentores(lista);
      },
      (err) => {
        console.error('Erro ao listar manutentores:', err);
        toast.error('Sem permissão para listar manutentores.');
      }
    );
    return () => unsub();
  }, [isGestor]);

  // --------- ações: atribuir / remover atribuição ---------
  async function handleAtribuir() {
    if (!selectedManutentor) {
      toast.error('Selecione um manutentor.');
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
          texto: `Atribuído para ${alvo?.nome || selectedManutentor} por ${user?.nome || user?.displayName || 'Gestor'}`,
          autor: 'Sistema',
          data: Timestamp.now()
        })
      });
      toast.success('Chamado atribuído.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao atribuir chamado.');
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
          texto: `Atribuição removida por ${user?.nome || user?.displayName || 'Gestor'}`,
          autor: 'Sistema',
          data: Timestamp.now()
        })
      });
      setSelectedManutentor('');
      toast.success('Atribuição removida.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao remover atribuição.');
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
      toast.error('Este chamado foi atribuído a outro manutentor.');
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
          texto: `Chamado atendido por ${user?.nome || user?.displayName || 'Manutentor'}`,
          autor: 'Sistema',
          data: Timestamp.now()
        })
      });
      toast.success('Chamado atendido.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao atender chamado.');
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
      toast.success('Observação adicionada.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao adicionar observação.');
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleConcluirChamado(e) {
    e.preventDefault();

    if (chamado?.manutentorId && chamado.manutentorId !== user?.uid) {
      toast.error('Apenas o manutentor que atendeu pode concluir este chamado.');
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
        // salva checklist e cria corretivos se houver "não"
        const itensComFalha = (checklist || []).filter((i) => i.resposta === 'nao');
        await updateDoc(ref, { ...updatesBase, checklist });

        if (itensComFalha.length > 0) {
          for (const item of itensComFalha) {
            await addDoc(collection(db, 'chamados'), {
              maquina: chamado.maquina,
              descricao: `Item do checklist preventivo "NÃO": "${item.item}"`,
              status: 'Aberto',
              tipo: 'corretiva',
              operadorNome: `Sistema (Gerado pela Preventiva de ${user?.nome || user?.displayName || '—'})`,
              dataAbertura: serverTimestamp()
            });
          }
          toast.success(`${itensComFalha.length} chamado(s) corretivo(s) aberto(s) automaticamente.`);
        }
      } else {
        // não-preventiva: exige causa + solução
        if (!causa) {
          toast.error('Selecione a causa da falha antes de concluir.');
          setIsUpdating(false);
          return;
        }
        if (!solucao.trim()) {
          toast.error('Descreva o serviço realizado.');
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
          original = typeof raw?.toDate === 'function' ? raw.toDate() : raw ? new Date(raw) : null;
        }
        const now = new Date();
        let atrasado = false;
        if (original) {
          const origDay = new Date(original.getFullYear(), original.getMonth(), original.getDate());
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          atrasado = today > origDay;
        }
        await updateDoc(agRef, {
          status: 'concluido',
          concluidoEm: serverTimestamp(),
          atrasado
        });
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
          await updateDoc(planoRef, {
            proximaData: novaProximaData,
            dataUltimaManutencao: serverTimestamp()
          });
        }
      }

      toast.success('Chamado concluído com sucesso!');
      navigate('/');
    } catch (e) {
      console.error('Erro ao concluir:', e);
      toast.error('Ocorreu um erro ao concluir.');
    } finally {
      setIsUpdating(false);
    }
  }

  // --------- render ---------
  if (loading) return <p style={{ padding: 20 }}>Carregando...</p>;
  if (!chamado) return <p style={{ padding: 20 }}>Chamado não encontrado.</p>;

  const openedAt = chamado?.dataAbertura ? formatTS(chamado.dataAbertura) : '—';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Máquina: {chamado.maquina}</h1>
        <small>Aberto por {chamado.operadorNome} em {openedAt}</small>
      </header>

      <div className={styles.card}>
        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}>
            <strong>Status</strong>
            <p>
              <span className={`${styles.statusBadge} ${styles[chamado.status?.toLowerCase()?.replace(' ', '')]}`}>
                {chamado.status}
              </span>
            </p>
          </div>

          {chamado.manutentorNome && (
            <div className={styles.detailItem}>
              <strong>Atendido por</strong>
              <p>{chamado.manutentorNome}</p>
            </div>
          )}

          {chamado.assignedToNome && (
            <div className={styles.detailItem}>
              <strong>Atribuído a</strong>
              <p>{chamado.assignedToNome}</p>
            </div>
          )}

          <div className={styles.detailItem}>
            <strong>Problema Reportado</strong>
            <p style={{ wordBreak: 'break-word' }}>{chamado.descricao}</p>
          </div>

          {/* Se já concluído, mostra resumo da conclusão */}
          {chamado.status === 'Concluído' && (
            chamado.tipo === 'preventiva' ? (
              <div className={styles.detailItem}>
                <strong>Checklist Concluído</strong>
                <p>{(chamado.checklist || []).filter(i => i.resposta === 'sim').length} de {(chamado.checklist || []).length} itens checados.</p>
              </div>
            ) : (
              <div className={styles.detailItem}>
                <strong>Serviço Realizado</strong>
                <p style={{ wordBreak: 'break-word' }}>{chamado.solucao}</p>
                <small>Concluído em: {formatTS(chamado.dataConclusao)}</small>
              </div>
            )
          )}

          {/* Causa (não preventiva) durante execução */}
          {chamado.tipo !== 'preventiva' && ['Em Andamento', 'Concluído'].includes(chamado.status) && (
            <div className={styles.detailItem}>
              <strong>Causa da Falha</strong>
              {chamado.status === 'Em Andamento' ? (
                <select
                  id="causa"
                  value={causa}
                  onChange={(e) => setCausa(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="" disabled>Selecione a causa...</option>
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

      {/* Card de Atribuição (somente gestor, enquanto não concluído) */}
      {isGestor && chamado.status !== 'Concluído' && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Atribuir manutentor</h2>
          <div className={styles.formGroup}>
            <label htmlFor="manutentor">Selecionar manutentor</label>
            <select
              id="manutentor"
              className={styles.select}
              value={selectedManutentor}
              onChange={(e) => setSelectedManutentor(e.target.value)}
            >
              <option value="">— Selecione —</option>
              {manutentores.map((m) => (
                <option key={m.uid} value={m.uid}>{m.nome}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={handleAtribuir}
              className={styles.button}
              disabled={assigning || !selectedManutentor}
            >
              {assigning ? 'Processando...' : (chamado.assignedTo ? 'Reatribuir' : 'Atribuir')}
            </button>
            {chamado.assignedTo && (
              <button
                onClick={handleRemoverAtribuicao}
                className={styles.button}
                disabled={assigning}
                style={{ backgroundColor: '#6c757d' }}
              >
                {assigning ? 'Processando...' : 'Remover atribuição'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Observações e histórico */}
      <div className={`${styles.card} ${styles.historySection}`}>
        <h2 className={styles.cardTitle}>Histórico de Observações</h2>

        {podeConcluir && (
          <div className={styles.formGroup}>
            <label htmlFor="observacao">Adicionar Nova Observação</label>
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
              {isUpdating ? 'Salvando...' : 'Salvar Observação'}
            </button>
          </div>
        )}

        <ul className={styles.historyList}>
          {(chamado.observacoes || []).slice().reverse().map((obs, i) => (
            <li key={i} className={styles.historyItem}>
              <div className={styles.historyHeader}>
                <strong>{obs.autor || '—'}</strong>
                <span>{formatTS(obs.data)}</span>
              </div>
              <p className={styles.historyContent}>{obs.texto}</p>
            </li>
          ))}
          {(!chamado.observacoes || chamado.observacoes.length === 0) && <p>Nenhuma observação registrada.</p>}
        </ul>
      </div>

      {/* Ações */}
      {podeAtender && (
        <div className={styles.card}>
          <button onClick={handleAtenderChamado} className={styles.button} disabled={isUpdating}>
            {isUpdating ? 'Processando...' : 'Atender Chamado'}
          </button>
        </div>
      )}

      {podeConcluir && (
        chamado.tipo === 'preventiva' ? (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Checklist de Manutenção</h2>
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
                    <label htmlFor={`sim-${idx}`}>Sim</label>

                    <input
                      type="radio"
                      id={`nao-${idx}`}
                      name={`resposta-${idx}`}
                      checked={item.resposta === 'nao'}
                      onChange={() => handleChecklistItemToggle(idx, 'nao')}
                    />
                    <label htmlFor={`nao-${idx}`}>Não</label>
                  </div>
                </div>
              ))}
              <button type="submit" className={styles.button} disabled={isUpdating}>
                {isUpdating ? 'Concluindo...' : 'Concluir Chamado'}
              </button>
            </form>
          </div>
        ) : (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Registrar Solução e Concluir</h2>
            <form onSubmit={handleConcluirChamado}>
              <div className={styles.formGroup}>
                <label htmlFor="solucao">Serviço Realizado / Solução Aplicada</label>
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
                {isUpdating ? 'Salvando...' : 'Concluir Chamado'}
              </button>
            </form>
          </div>
        )
      )}
    </div>
  );
};

export default ChamadoDetalhe;
