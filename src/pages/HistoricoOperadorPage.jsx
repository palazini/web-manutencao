// src/pages/HistoricoOperadorPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import styles from './HistoricoOperadorPage.module.css';
import { FiCheckCircle, FiXCircle } from 'react-icons/fi';
import Modal from '../components/Modal.jsx'; // 1. Importar o nosso novo modal

const HistoricoOperadorPage = () => {
  const { operadorId } = useParams();
  const [operador, setOperador] = useState(null);
  const [dailyStatuses, setDailyStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  // 2. Novo estado para controlar o modal
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  useEffect(() => {
    // Busca os dados do operador (nome, etc.)
    const fetchOperador = async () => {
      const docRef = doc(db, 'usuarios', operadorId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setOperador(docSnap.data());
      }
    };

    // Define o período do relatório (últimos 30 dias)
    const hoje = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(hoje.getDate() - 30);

    // Ouve em tempo real as submissões deste operador no período
    const q = query(
      collection(db, 'checklistSubmissions'),
      where('operadorId', '==', operadorId),
      where('dataSubmissao', '>=', dataInicio),
      orderBy('dataSubmissao', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const submissionsMap = new Map();
      snapshot.docs.forEach(doc => {
        const data = doc.data().dataSubmissao.toDate();
        const dataString = data.toLocaleDateString('pt-BR');
        submissionsMap.set(dataString, { id: doc.id, ...doc.data() });
      });

      const statusList = [];
      for (let i = 0; i < 30; i++) {
        const dia = new Date();
        dia.setDate(hoje.getDate() - i);
        const diaString = dia.toLocaleDateString('pt-BR');

        statusList.push({
          data: diaString,
          status: submissionsMap.has(diaString) ? 'Entregue' : 'Pendente',
          submission: submissionsMap.get(diaString) || null,
        });
      }
      
      setDailyStatuses(statusList);
      setLoading(false);
    });

    fetchOperador();
    return () => unsubscribe();
  }, [operadorId]);

  const handleShowDetails = (submission) => {
    if (submission) {
      setSelectedSubmission(submission);
    }
  };

  if (loading) return <p>Carregando histórico...</p>;

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Histórico de Conformidade: {operador ? operador.nome : '...'}</h1>
      </header>
      <div style={{ padding: '20px' }}>
        <div className={styles.card}>
          <ul className={styles.submissionList}>
            {dailyStatuses.map((dia, index) => (
              <li 
                key={index} 
                className={`${styles.submissionItem} ${dia.submission ? styles.clickable : ''}`} 
                onClick={() => handleShowDetails(dia.submission)}
              >
                <span className={styles.date}>{dia.data}</span>
                <div className={dia.status === 'Entregue' ? `${styles.status} ${styles.completed}` : `${styles.status} ${styles.pending}`}>
                  {dia.status === 'Entregue' ? <FiCheckCircle /> : <FiXCircle />}
                  <span>{dia.status}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Modal 
        isOpen={!!selectedSubmission} 
        onClose={() => setSelectedSubmission(null)}
        title={`Checklist de ${selectedSubmission?.dataSubmissao ? new Date(selectedSubmission.dataSubmissao.toDate()).toLocaleDateString('pt-BR') : ''}`}
      >
        {selectedSubmission && (
          <div>
            <h4>{selectedSubmission.checklistNome}</h4>
            <ul className={styles.detailsList}>
              {Object.entries(selectedSubmission.respostas).map(([pergunta, resposta]) => (
                <li key={pergunta} className={styles.detailItem}>
                  <span>{pergunta}</span>
                  <strong className={resposta === 'sim' ? styles.completed : styles.pending}>
                    {resposta.toUpperCase()}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
};

export default HistoricoOperadorPage;
