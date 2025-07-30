// src/pages/ChamadoDetalhe.jsx

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp, getDoc, arrayUnion, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import styles from './ChamadoDetalhe.module.css';

const ChamadoDetalhe = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chamado, setChamado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const [solucao, setSolucao] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [novaObservacao, setNovaObservacao] = useState('');

  const [causas, setCausas] = useState([]);
  const [causa, setCausa]   = useState('');

  // Carrega o chamado e inicializa a causa
  useEffect(() => {
    const docRef = doc(db, 'chamados', id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setChamado(data);
        setCausa(data.causa || '');               // inicializa causa
        if (data.checklist) {
          const checklistComRespostas = data.checklist.map(item => ({
            ...item,
            resposta: item.resposta || 'sim'
          }));
          setChecklist(checklistComRespostas);
        }
      } else {
        setChamado(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  // Carrega as opções de causasRaiz
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'causasRaiz'),
      snapshot => {
        const lista = snapshot.docs.map(doc => doc.data().nome);
        setCausas(lista);
      },
      err => console.error('Erro ao buscar causasRaiz:', err)
    );
    return () => unsub();
  }, []);

  const handleAtenderChamado = async () => {
    setIsUpdating(true);
    const chamadoRef = doc(db, 'chamados', id);
    try {
      await updateDoc(chamadoRef, {
        status: 'Em Andamento',
        manutentorId: user.uid,
        manutentorNome: user.nome
      });
    } catch (error) {
      toast.error("Erro ao atender chamado.");
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    // subscreve a coleção de causasRaiz
    const unsub = onSnapshot(
      collection(db, 'causasRaiz'),
      snapshot => {
        const lista = snapshot.docs.map(doc => doc.data().nome);
        setCausas(lista);
      },
      err => console.error('Erro ao buscar causasRaiz:', err)
    );
    return () => unsub();
  }, []);

  const handleChecklistItemToggle = (index, value) => {
    const novoChecklist = [...checklist];
    novoChecklist[index].resposta = value;
    setChecklist(novoChecklist);
  };

  // --- FUNÇÃO handleConcluirChamado ATUALIZADA ---
  const handleConcluirChamado = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    if (!causa) {
      toast.error('Selecione a causa da falha antes de concluir este chamado.');
      setIsUpdating(false);
      return;
    }
    const chamadoRef = doc(db, 'chamados', id);
    let dadosUpdate = {
      status: 'Concluído',
      dataConclusao: serverTimestamp(),
      causa
    };

    dadosUpdate.causa = causa;

    try {
      if (chamado.tipo === 'preventiva') {
        dadosUpdate.checklist = checklist;
        const itensComFalha = checklist.filter(item => item.resposta === 'nao');

        if (itensComFalha.length > 0) {
          for (const item of itensComFalha) {
            await addDoc(collection(db, 'chamados'), {
              maquina: chamado.maquina,
              descricao: `Item do checklist preventivo reportado como "Não": "${item.item}"`,
              status: "Aberto",
              tipo: "corretiva",
              operadorNome: `Sistema (Gerado pela Preventiva de ${user.nome})`,
              dataAbertura: serverTimestamp(),
            });
          }
          toast.success(`${itensComFalha.length} chamado(s) corretivo(s) aberto(s) automaticamente.`);
        }
      } else {
        if (solucao.trim() === '') {
          toast.error("Por favor, descreva o serviço realizado.");
          setIsUpdating(false);
          return;
        }
        dadosUpdate.solucao = solucao;
      }

      // atualiza o chamado
      await updateDoc(chamadoRef, dadosUpdate);

      // ─────────── ADIÇÃO ───────────
      // se esse chamado veio de um agendamento, marca o agendamento como concluído
      if (chamado.agendamentoId) {
        const agRef = doc(db, 'agendamentosPreventivos', chamado.agendamentoId);
        await updateDoc(agRef, { status: 'concluido' });
      }
      // ───────────────────────────────

      toast.success("Chamado concluído com sucesso!");

      if (chamado.planoId) {
        const collectionName = chamado.tipo === 'preventiva' ? 'planosPreventivos' : 'planosPreditivos';
        const planoRef = doc(db, collectionName, chamado.planoId);
        const planoDoc = await getDoc(planoRef);
        if (planoDoc.exists()) {
          const plano = planoDoc.data();
          const novaProximaData = new Date();
          novaProximaData.setDate(novaProximaData.getDate() + plano.frequencia);
          await updateDoc(planoRef, {
            proximaData: novaProximaData,
            dataUltimaManutencao: serverTimestamp()
          });
          toast.success(`Plano ${chamado.tipo} atualizado.`);
        }
      }

      navigate('/');
    } catch (error) {
      console.error("Erro ao concluir: ", error);
      toast.error("Ocorreu um erro ao processar a conclusão.");
    } finally {
      setIsUpdating(false);
    }
  };


  const handleAdicionarObservacao = async () => {
    if (novaObservacao.trim() === '') {
      toast.error("A observação não pode ser vazia.");
      return;
    }
    setIsUpdating(true);
    const chamadoRef = doc(db, 'chamados', id);
    const observacao = {
      texto: novaObservacao,
      autor: user.nome,
      data: new Date(),
    };
    try {
      await updateDoc(chamadoRef, {
        observacoes: arrayUnion(observacao)
      });
      toast.success("Observação adicionada!");
      setNovaObservacao('');
    } catch (error) {
      toast.error("Erro ao adicionar observação.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <p style={{ padding: '20px' }}>Carregando...</p>;
  if (!chamado)  return <p style={{ padding: '20px' }}>Chamado não encontrado.</p>;

  const podeAtender = user.role === 'manutentor' && chamado.status === 'Aberto';
  const podeConcluir= user.role === 'manutentor' && chamado.status === 'Em Andamento';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Máquina: {chamado.maquina}</h1>
        <small>
          Aberto por {chamado.operadorNome} em{' '}
          {chamado.dataAbertura
            ? new Date(chamado.dataAbertura.toDate()).toLocaleString('pt-BR')
            : '...'}
        </small>
      </header>

      {/* CARD PRINCIPAL */}
      <div className={styles.card}>
        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}>
            <strong>Status</strong>
            <p>
              <span
                className={`${styles.statusBadge} ${
                  styles[chamado.status.toLowerCase().replace(' ', '')]
                }`}
              >
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

          <div className={styles.detailItem}>
            <strong>Problema Reportado</strong>
            <p style={{ wordBreak: 'break-word' }}>{chamado.descricao}</p>
          </div>

          {chamado.status === 'Concluído' && (
            chamado.tipo === 'preventiva' ? (
              <div className={styles.detailItem}>
                <strong>Checklist Concluído</strong>
                <p>
                  {chamado.checklist.filter(i => i.concluido).length} de{' '}
                  {chamado.checklist.length} itens checados.
                </p>
              </div>
            ) : (
              <div className={styles.detailItem}>
                <strong>Serviço Realizado</strong>
                <p style={{ wordBreak: 'break-word' }}>{chamado.solucao}</p>
                <small>
                  Concluído em:{' '}
                  {chamado.dataConclusao
                    ? new Date(chamado.dataConclusao.toDate()).toLocaleString('pt-BR')
                    : '...'}
                </small>
              </div>
            )
          )}

          {/* NOVA CAUSA DA FALHA */}
          {['Em Andamento', 'Concluído'].includes(chamado.status) && (
            <div className={styles.detailItem}>
              <strong>Causa da Falha</strong>
              {chamado.status === 'Em Andamento' ? (
                <select
                  id="causa"
                  value={causa}
                  onChange={e => setCausa(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="" disabled>Selecione a causa...</option>
                  {causas.map(nomeCausa => (
                    <option key={nomeCausa} value={nomeCausa}>
                      {nomeCausa.charAt(0).toUpperCase() + nomeCausa.slice(1)}
                    </option>
                  ))}
                </select>
              ) : (
                <p className={styles.readonlyField}>
                  {chamado.causa || '–'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* HISTÓRICO E OBSERVAÇÕES */}
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
              style={{ marginTop: '10px' }}
              disabled={isUpdating}
            >
              {isUpdating ? 'Salvando...' : 'Salvar Observação'}
            </button>
          </div>
        )}

        <ul className={styles.historyList}>
          {chamado.observacoes?.length > 0 ? (
            [...chamado.observacoes]
              .reverse()
              .map((obs, i) => (
                <li key={i} className={styles.historyItem}>
                  <div className={styles.historyHeader}>
                    <strong>{obs.autor}</strong>
                    <span>
                      {new Date(obs.data.toDate()).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className={styles.historyContent}>{obs.texto}</p>
                </li>
              ))
          ) : (
            <p>Nenhuma observação registrada.</p>
          )}
        </ul>
      </div>

      {/* BOTÕES ATENDER / CONCLUIR */}
      {podeAtender && (
        <div className={styles.card}>
          <button
            onClick={handleAtenderChamado}
            className={styles.button}
            disabled={isUpdating}
          >
            {isUpdating ? 'Processando...' : 'Atender Chamado'}
          </button>
        </div>
      )}
      
      {podeConcluir && (
        chamado.tipo === 'preventiva' ? (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Checklist de Manutenção</h2>
            <form onSubmit={handleConcluirChamado} className={styles.checklistContainer}>
              {checklist.map((item, index) => (
                <div key={index} className={styles.checklistItem}>
                  <span className={styles.itemLabel}>{item.item}</span>
                  <div className={styles.radioGroup}>
                    <input type="radio" id={`sim-${index}`} name={`resposta-${index}`} checked={item.resposta === 'sim'} onChange={() => handleChecklistItemToggle(index, 'sim')} />
                    <label htmlFor={`sim-${index}`}>Sim</label>
                    <input type="radio" id={`nao-${index}`} name={`resposta-${index}`} checked={item.resposta === 'nao'} onChange={() => handleChecklistItemToggle(index, 'nao')} />
                    <label htmlFor={`nao-${index}`}>Não</label>
                  </div>
                </div>
              ))}
              <button
                type="submit"
                className={styles.button}
                disabled={isUpdating || !causa}
              >
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
                <textarea id="solucao" className={styles.textarea} rows="5" value={solucao} onChange={(e) => setSolucao(e.target.value)} required />
              </div>
              <button
                type="submit"
                className={styles.button}
                disabled={isUpdating || !causa}
              >
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