// src/pages/ChamadoDetalhe.jsx

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import styles from './ChamadoDetalhe.module.css';

const ChamadoDetalhe = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chamado, setChamado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Estados para os dois tipos de conclusão
  const [solucao, setSolucao] = useState('');
  const [checklist, setChecklist] = useState([]);

  useEffect(() => {
    const docRef = doc(db, 'chamados', id);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = { id: doc.id, ...doc.data() };
        setChamado(data);
        // Se o chamado tiver um checklist, inicializa o estado do checklist
        if (data.checklist) {
          setChecklist(data.checklist);
        }
      } else {
        setChamado(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

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
  
  // Função para marcar/desmarcar um item do checklist
  const handleChecklistItemToggle = (index) => {
    const novoChecklist = [...checklist];
    novoChecklist[index].concluido = !novoChecklist[index].concluido;
    setChecklist(novoChecklist);
  };

  // Verifica se todos os itens do checklist estão marcados
  const isChecklistCompleto = checklist.every(item => item.concluido);

  const handleConcluirChamado = async (e) => {
  e.preventDefault();
  setIsUpdating(true);
  const chamadoRef = doc(db, 'chamados', id);

  // Prepara os dados de atualização para o chamado
  let dadosUpdate = {
    status: 'Concluído',
    dataConclusao: serverTimestamp()
  };
  if (chamado.tipo !== 'preventiva') {
    if (solucao.trim() === '') {
      toast.error("Por favor, descreva o serviço realizado.");
      setIsUpdating(false);
      return;
    }
    dadosUpdate.solucao = solucao;
  } else {
    if (!isChecklistCompleto) {
        toast.error("Por favor, marque todos os itens do checklist antes de concluir.");
        setIsUpdating(false);
        return;
    }
    dadosUpdate.checklist = checklist;
  }

  try {
    // 1. Conclui o chamado
    await updateDoc(chamadoRef, dadosUpdate);
    toast.success("Chamado concluído com sucesso!");

    // 2. Verifica se o chamado veio de um plano (preventivo OU preditivo)
    if (chamado.planoId) {
      let nomeColecaoPlano = '';
      if (chamado.tipo === 'preventiva') {
        nomeColecaoPlano = 'planosPreventivos';
      } else if (chamado.tipo === 'preditiva') {
        nomeColecaoPlano = 'planosPreditivos'; // Usando o nome correto da coleção
      }

      if (nomeColecaoPlano) {
        const planoRef = doc(db, nomeColecaoPlano, chamado.planoId);
        const planoDoc = await getDoc(planoRef);

        if (planoDoc.exists()) {
          const plano = planoDoc.data();
          const novaProximaData = new Date();
          novaProximaData.setDate(novaProximaData.getDate() + plano.frequencia);

          await updateDoc(planoRef, {
            proximaData: novaProximaData,
            dataUltimaManutencao: serverTimestamp()
          });
          toast.success(`Plano ${chamado.tipo} atualizado para o próximo ciclo.`);
        }
      }
    }

    navigate('/'); // Redireciona de volta ao painel
  } catch (error) {
    console.error("Erro ao concluir chamado e atualizar plano: ", error);
    toast.error("Ocorreu um erro ao processar a conclusão.");
  } finally {
    setIsUpdating(false);
  }
};

  if (loading) return <div style={{ padding: '20px' }}>Carregando...</div>;
  if (!chamado) return <div style={{ padding: '20px' }}>Chamado não encontrado.</div>;

  const podeAtender = user.role === 'manutentor' && chamado.status === 'Aberto';
  const podeConcluir = user.role === 'manutentor' && chamado.status === 'Em Andamento';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Máquina: {chamado.maquina}</h1>
        <small>Aberto por {chamado.operadorNome} em {chamado.dataAbertura ? new Date(chamado.dataAbertura.toDate()).toLocaleString() : '...'}</small>
      </header>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Detalhes do Chamado</h2>
        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}><strong>Status</strong><p><span className={`${styles.statusBadge} ${styles[chamado.status.toLowerCase().replace(' ', '')]}`}>{chamado.status}</span></p></div>
          {chamado.manutentorNome && (<div className={styles.detailItem}><strong>Atendido por</strong><p>{chamado.manutentorNome}</p></div>)}
          <div className={styles.detailItem}><strong>Problema Reportado</strong><p>{chamado.descricao}</p></div>
          {chamado.status === 'Concluído' && (
            chamado.tipo === 'preventiva' ? (
              <div className={styles.detailItem}><strong>Checklist Concluído</strong><p>{chamado.checklist.filter(i => i.concluido).length} de {chamado.checklist.length} itens foram checados.</p></div>
            ) : (
              <div className={styles.detailItem}><strong>Serviço Realizado</strong><p>{chamado.solucao}</p><small>Concluído em: {chamado.dataConclusao ? new Date(chamado.dataConclusao.toDate()).toLocaleString() : '...'}</small></div>
            )
          )}
        </div>
      </div>

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
            <form onSubmit={handleConcluirChamado}>
              <div className={styles.checklistContainer}>
                {checklist.map((item, index) => (
                  <div key={index} className={styles.checklistItem}>
                    <input type="checkbox" id={`item-${index}`} checked={item.concluido} onChange={() => handleChecklistItemToggle(index)} />
                    <label htmlFor={`item-${index}`} className={item.concluido ? styles.itemConcluido : ''}>{item.item}</label>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '20px' }}>
                <button type="submit" className={styles.button} disabled={isUpdating || !isChecklistCompleto}>
                  {isUpdating ? 'Salvando...' : 'Concluir Chamado'}
                </button>
              </div>
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
              <button type="submit" className={styles.button} disabled={isUpdating}>
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