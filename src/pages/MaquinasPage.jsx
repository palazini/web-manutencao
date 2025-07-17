// src/pages/MaquinasPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import styles from './MaquinasPage.module.css';

const MaquinasPage = () => {
  const [maquinas, setMaquinas] = useState([]);
  const [chamadosAtivos, setChamadosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Busca a coleção 'maquinas'
    const qMaquinas = query(collection(db, 'maquinas'), orderBy('nome'));
    const unsubMaquinas = onSnapshot(qMaquinas, (snapshot) => {
      const maquinasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMaquinas(maquinasData);
    });

    // Busca todos os chamados ATIVOS (Aberto ou Em Andamento)
    const qChamados = query(collection(db, 'chamados'), where('status', 'in', ['Aberto', 'Em Andamento']));
    const unsubChamados = onSnapshot(qChamados, (snapshot) => {
      const chamadosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChamadosAtivos(chamadosData);
      setLoading(false); // Move o loading para depois da segunda busca
    });
    
    // Limpa os ouvintes quando o componente é desmontado
    return () => {
      unsubMaquinas();
      unsubChamados();
    };
  }, []);

  // Usamos useMemo para processar os dados apenas quando eles mudam
  const maquinasComStatus = useMemo(() => {
    const statusPorMaquina = {};
    const prioridade = { corretiva: 3, preventiva: 2, preditiva: 1 };

    chamadosAtivos.forEach(chamado => {
      const tipo = chamado.tipo || 'corretiva';
      
      if (!statusPorMaquina[chamado.maquina] || prioridade[tipo] > prioridade[statusPorMaquina[chamado.maquina]]) {
        statusPorMaquina[chamado.maquina] = tipo;
      }
    });

    return maquinas.map(maquina => ({
      ...maquina,
      statusDestaque: statusPorMaquina[maquina.nome] || 'normal',
    }));

  }, [maquinas, chamadosAtivos]);

  // Função para pegar a classe CSS correta
  const getStatusClass = (status) => {
    switch(status) {
      case 'corretiva': return styles.statusCorretiva;
      case 'preventiva': return styles.statusPreventiva;
      case 'preditiva': return styles.statusPreditiva;
      default: return styles.statusNormal;
    }
  };

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Painel de Máquinas</h1>
      </header>
      <div style={{ padding: '20px' }}>
        {loading ? (
          <p>Carregando máquinas...</p>
        ) : (
          <>
            {/* NOVA SEÇÃO DE LEGENDA */}
            <div className={styles.legendContainer}>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColorBox} ${styles.statusCorretiva}`}></div>
                <span>Corretiva (Urgente)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColorBox} ${styles.statusPreventiva}`}></div>
                <span>Preventiva (Checklist)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColorBox} ${styles.statusPreditiva}`}></div>
                <span>Preditiva (Agendada)</span>
              </div>
            </div>

            <div className={styles.grid}>
              {maquinasComStatus.map(maquina => (
                <Link 
                  to={`/maquinas/${maquina.id}`} 
                  key={maquina.id} 
                  className={`${styles.card} ${getStatusClass(maquina.statusDestaque)}`}
                >
                  <h2>{maquina.nome}</h2>
                  <p>Status: Operacional</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default MaquinasPage;