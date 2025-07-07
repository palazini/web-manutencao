// src/pages/HistoricoPage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import styles from './HistoricoPage.module.css';

const HistoricoPage = () => {
  const [chamadosConcluidos, setChamadosConcluidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Consulta específica para buscar chamados ONDE o status é 'Concluído'
    // Ordena pela data de conclusão, dos mais recentes para os mais antigos
    const q = query(
      collection(db, 'chamados'), 
      where('status', '==', 'Concluído'),
      orderBy('dataConclusao', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const chamadosData = [];
      querySnapshot.forEach((doc) => {
        chamadosData.push({ id: doc.id, ...doc.data() });
      });
      setChamadosConcluidos(chamadosData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Histórico de Manutenções</h1>
      </header>
      <div style={{ padding: '20px' }}>
        <div className={styles.card}>
          {loading ? (
            <p>Carregando histórico...</p>
          ) : chamadosConcluidos.length === 0 ? (
            <p>Nenhum chamado foi concluído ainda.</p>
          ) : (
            <ul className={styles.chamadoList}>
              {chamadosConcluidos.map((chamado) => (
                <Link to={`/chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoLink}>
                  <li className={styles.chamadoItem}>
                    <div className={styles.chamadoInfo}>
                      <strong>Máquina: {chamado.maquina}</strong>
                      {/* Adicione a linha abaixo */}
                      <small>Atendido por: {chamado.manutentorNome || 'Não identificado'}</small>
                      <small>Concluído em: {chamado.dataConclusao ? new Date(chamado.dataConclusao.toDate()).toLocaleString() : '...'}</small>
                      <p className={styles.problemaPreview}><strong>Problema:</strong> {chamado.descricao || 'Não especificado'}</p>
                    </div>
                </li>
                </Link>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default HistoricoPage;