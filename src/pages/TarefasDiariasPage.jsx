// src/pages/TarefasDiariasPage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import styles from './TarefasDiariasPage.module.css';

// A página agora recebe 'dadosTurno' como prop
const TarefasDiariasPage = ({ user, dadosTurno }) => {
  const [tarefasPendentes, setTarefasPendentes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dadosTurno) return; // Não faz nada se os dados do turno ainda não chegaram

    const carregarTarefas = async () => {
      // 1. Busca os dados completos das máquinas selecionadas
      const qMaquinas = query(collection(db, 'maquinas'), where('__name__', 'in', dadosTurno.maquinas));
      const maquinasSnapshot = await getDocs(qMaquinas);
      const maquinasDoOperador = maquinasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. Ouve em tempo real as submissões de hoje para verificar o que já foi feito
      const hoje = new Date();
      const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      
      const qSubmissoes = query(
        collection(db, 'checklistSubmissions'),
        where('operadorId', '==', user.uid),
        where('dataSubmissao', '>=', inicioDoDia)
      );

      const unsubscribe = onSnapshot(qSubmissoes, (submissoesSnapshot) => {
        const maquinasJaFeitas = new Set(submissoesSnapshot.docs.map(doc => doc.data().maquinaId));
        const pendentes = maquinasDoOperador.filter(maq => !maquinasJaFeitas.has(maq.id));
        setTarefasPendentes(pendentes);
        setLoading(false);
      });

      return () => unsubscribe();
    };

    carregarTarefas();
  }, [user.uid, dadosTurno]);

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <h1>Tarefas Diárias</h1>
        <p>Olá, {user.nome}. Aqui estão os checklists pendentes para o seu turno.</p>
      </header>

      {loading && <p>Verificando tarefas...</p>}
      
      {!loading && tarefasPendentes.length === 0 && (
        <p>Você completou todos os seus checklists para este turno. Bom trabalho!</p>
      )}
      
      {!loading && tarefasPendentes.length > 0 && (
        <ul className={styles.taskList}>
          {tarefasPendentes.map(maquina => (
            <Link to={`/checklist/${maquina.id}`} key={maquina.id} className={styles.taskItem}>
              <div className={styles.taskInfo}>
                <strong>{maquina.nome}</strong>
              </div>
              <span>Preencher Checklist</span>
            </Link>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TarefasDiariasPage;