// src/pages/ChamadoDetalhe.jsx

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import styles from './ChamadoDetalhe.module.css';

const ChamadoDetalhe = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chamado, setChamado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [solucao, setSolucao] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const docRef = doc(db, 'chamados', id);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        setChamado({ id: doc.id, ...doc.data() });
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
    toast.error("Erro ao atender chamado: ", error);
  } finally {
    setIsUpdating(false);
  }
};

  const handleConcluirChamado = async (e) => {
    e.preventDefault();
    if (solucao.trim() === '') {
      toast.error("Por favor, descreva o serviço realizado.");
      return;
    }
    setIsUpdating(true);
    const chamadoRef = doc(db, 'chamados', id);
    try {
      await updateDoc(chamadoRef, { status: 'Concluído', solucao: solucao, dataConclusao: serverTimestamp() });
      toast.success("Chamado concluído com sucesso!");
      navigate('/');
    } catch (error) {
      toast.error("Erro ao concluir chamado: ", error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Carregando detalhes do chamado...</div>;
  if (!chamado) return <div style={{ padding: '20px' }}>Chamado não encontrado.</div>;

  // Condições de exibição mais robustas
  const podeAtender = user && user.role && chamado && chamado.status && user.role.trim().toLowerCase() === 'manutentor' && chamado.status.trim().toLowerCase() === 'aberto';
  const podeConcluir = user && user.role && chamado && chamado.status && user.role.trim().toLowerCase() === 'manutentor' && chamado.status.trim().toLowerCase() === 'em andamento';

  return (
    <div className={styles.container}>
      {/* ==================================================================== */}
      {/* SEÇÃO QUE EXIBE OS DETALHES (ESTAVA FALTANDO) */}
      {/* ==================================================================== */}
      <header className={styles.header}>
        <h1>Máquina: {chamado.maquina}</h1>
        <small>Aberto por {chamado.operadorNome} em {chamado.dataAbertura ? new Date(chamado.dataAbertura.toDate()).toLocaleString() : '...'}</small>
      </header>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Detalhes do Chamado</h2>
        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}>
            <strong>Status</strong>
            <p><span className={`${styles.statusBadge} ${styles[chamado.status.toLowerCase().replace(' ', '')]}`}>{chamado.status}</span></p>
          </div>
          {chamado.manutentorNome && (
            <div className={styles.detailItem}>
              <strong>Atendido por</strong>
              <p>{chamado.manutentorNome}</p>
            </div>
          )}
          <div className={styles.detailItem}>
            <strong>Problema Reportado</strong>
            <p>{chamado.descricao}</p>
          </div>
          {chamado.status === 'Concluído' && (
            <div className={styles.detailItem}>
              <strong>Serviço Realizado</strong>
              <p>{chamado.solucao}</p>
              <small>Concluído em: {chamado.dataConclusao ? new Date(chamado.dataConclusao.toDate()).toLocaleString() : '...'}</small>
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SEÇÃO DE AÇÕES PARA O MANUTENTOR */}
      {/* ==================================================================== */}
      {podeAtender && (
        <div className={styles.card}>
          <button onClick={handleAtenderChamado} className={styles.button} disabled={isUpdating}>
            {isUpdating ? 'Processando...' : 'Atender Chamado'}
          </button>
        </div>
      )}

      {podeConcluir && (
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
                placeholder="Descreva o que foi feito para resolver o problema..."
                required
              ></textarea>
            </div>
            <button type="submit" className={styles.button} disabled={isUpdating}>
              {isUpdating ? 'Salvando...' : 'Concluir Chamado'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChamadoDetalhe;