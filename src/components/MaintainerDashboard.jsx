import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import styles from './MaintainerDashboard.module.css';
// 1. Adicionamos todos os ícones que vamos usar
import { FiTool, FiClock, FiCheckSquare } from 'react-icons/fi';

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
    }, (error) => {
      console.error("Erro ao buscar chamados: ", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const chamadosAbertos = chamados.filter(c => c.status === 'Aberto');
  const chamadosEmAndamento = chamados.filter(c => c.status === 'Em Andamento');

  // 2. Função auxiliar para escolher o ícone e o estilo corretos
  const getChamadoStyle = (tipo) => {
    switch (tipo) {
      case 'preditiva':
        return {
          icon: <FiClock className={styles.preditivaIcon} title="Manutenção Preditiva" />,
          className: styles.preditivaItem,
        };
      case 'preventiva':
        return {
          icon: <FiCheckSquare className={styles.preventivaIcon} title="Manutenção Preventiva" />,
          className: styles.preventivaItem,
        };
      default: // Chamado normal/corretivo
        return { icon: null, className: '' };
    }
  };

  return (
    <div className={styles.card}>
      {loading ? <p>Carregando fila de trabalho...</p> : (
        <>
          <div className={styles.section}>
            <h2 className={styles.cardTitle}><FiTool className={styles.titleIcon} />Abertos (Fila)</h2>
            {chamadosAbertos.length === 0 ? <p>Nenhum chamado na fila. Bom trabalho!</p> : (
              <ul className={styles.chamadoList}>
                {chamadosAbertos.map((chamado) => {
                  const { icon, className } = getChamadoStyle(chamado.tipo);
                  return (
                    <Link to={`/chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoLink}>
                      <li className={`${styles.chamadoItem} ${className}`}>
                        <div className={styles.chamadoInfo}>
                          <strong>{icon}Máquina: {chamado.maquina}</strong>
                          <small>Aberto por: {chamado.operadorNome || chamado.operadorEmail}</small>
                          <p className={styles.descriptionPreview}>{chamado.descricao}</p>
                        </div>
                      </li>
                    </Link>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={styles.section}>
            <h2 className={styles.cardTitle}><FiClock className={styles.titleIcon} />Em Andamento</h2>
            {chamadosEmAndamento.length === 0 ? <p>Nenhum chamado em andamento.</p> : (
              <ul className={styles.chamadoList}>
                {chamadosEmAndamento.map((chamado) => {
                  const { icon, className } = getChamadoStyle(chamado.tipo);
                  return (
                    <Link to={`/chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoLink}>
                      <li className={`${styles.chamadoItem} ${className}`}>
                        <div className={styles.chamadoInfo}>
                          <strong>{icon}Máquina: {chamado.maquina}</strong>
                          <small>Aberto por: {chamado.operadorNome || chamado.operadorEmail}</small>
                          <p className={styles.descriptionPreview}>{chamado.descricao}</p>
                        </div>
                      </li>
                    </Link>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MaintainerDashboard;