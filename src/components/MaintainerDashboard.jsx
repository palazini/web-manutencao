// src/components/MaintainerDashboard.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import styles from './MaintainerDashboard.module.css';
import { FiTool, FiClock } from 'react-icons/fi';

// A declaração da função que estava faltando
const MaintainerDashboard = ({ user }) => {
  const [chamados, setChamados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'chamados'), where('status', 'in', ['Aberto', 'Em Andamento']));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const chamadosData = [];
      querySnapshot.forEach((doc) => {
        chamadosData.push({ id: doc.id, ...doc.data() });
      });
      setChamados(chamadosData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const chamadosAbertos = chamados.filter(c => c.status === 'Aberto');
  const chamadosEmAndamento = chamados.filter(c => c.status === 'Em Andamento');

  // O seu return, agora dentro da função, está perfeito.
  return (
    <div className={styles.card}>
      {loading ? (
        <p>Carregando fila de trabalho...</p>
      ) : (
        <>
          <div className={styles.section}>
            <h2 className={styles.cardTitle}>
              <FiTool className={styles.titleIcon} />
              Abertos (Fila)
            </h2>
            {chamadosAbertos.length === 0 ? (
              <p>Nenhum chamado na fila. Bom trabalho!</p>
            ) : (
              <ul className={styles.chamadoList}>
                {chamadosAbertos.map((chamado) => (
                  <Link to={`/chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoLink}>
                    <li className={styles.chamadoItem}>
                      <div className={styles.chamadoInfo}>
                        <strong>Máquina: {chamado.maquina}</strong>
                        <small>Aberto por: {chamado.operadorNome}</small>
                        <p className={styles.descriptionPreview}>{chamado.descricao}</p>
                      </div>
                    </li>
                  </Link>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.section}>
            <h2 className={styles.cardTitle}>
              <FiClock className={styles.titleIcon} />
              Em Andamento
            </h2>
            {chamadosEmAndamento.length === 0 ? (
              <p>Nenhum chamado em andamento.</p>
            ) : (
              <ul className={styles.chamadoList}>
                {chamadosEmAndamento.map((chamado) => (
                  <Link to={`/chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoLink}>
                    <li className={styles.chamadoItem}>
                      <div className={styles.chamadoInfo}>
                        <strong>Máquina: {chamado.maquina}</strong>
                        <small>Aberto por: {chamado.operadorNome}</small>
                        <p>{chamado.descricao}</p>
                      </div>
                    </li>
                  </Link>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MaintainerDashboard;