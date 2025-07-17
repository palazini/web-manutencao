// src/pages/TarefasDiariasPage.jsx

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // 1. Importar useNavigate
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getTurnoAtual } from '../utils/dateUtils';
import styles from './TarefasDiariasPage.module.css';
import toast from 'react-hot-toast';

const TarefasDiariasPage = ({ user }) => {
  const [tarefasPendentes, setTarefasPendentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [turno, setTurno] = useState(null);
  const navigate = useNavigate(); // Hook para navegação

  useEffect(() => {
    const carregarTarefas = async () => {
      const turnoAtual = getTurnoAtual();
      if (!turnoAtual) {
        setLoading(false);
        return;
      }
      setTurno(turnoAtual);

      const qMaquinas = query(
        collection(db, 'maquinas'),
        where(`operadoresPorTurno.${turnoAtual}`, 'array-contains', user.uid)
      );
      const maquinasSnapshot = await getDocs(qMaquinas);
      const maquinasDoOperador = maquinasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (maquinasDoOperador.length === 0) {
        toast.error("Você não está atribuído a nenhuma máquina neste turno.");
        setLoading(false);
        return;
      }
      
      const hoje = new Date();
      const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      
      const qSubmissoes = query(
        collection(db, 'checklistSubmissions'),
        where('operadorId', '==', user.uid),
        where('dataSubmissao', '>=', inicioDoDia)
      );
      const submissoesSnapshot = await getDocs(qSubmissoes);
      const maquinasJaFeitas = new Set(submissoesSnapshot.docs.map(doc => doc.data().maquinaId));

      const pendentes = maquinasDoOperador.filter(maq => !maquinasJaFeitas.has(maq.id));
      
      setTarefasPendentes(pendentes);
      setLoading(false);
    };

    carregarTarefas();
  }, [user.uid]);

  // Se todas as tarefas foram concluídas, redireciona para uma tela final
  if (!loading && turno && tarefasPendentes.length === 0) {
    navigate('/tarefas-concluidas'); // Uma nova rota que vamos criar
  }

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <h1>Tarefas Diárias</h1>
        <p>Olá, {user.nome}. Aqui estão os checklists pendentes para o seu turno.</p>
      </header>

      {loading && <p>Verificando tarefas...</p>}
      
      {!loading && !turno && (
        <p>Fora do horário de turno. Nenhum checklist a ser preenchido no momento.</p>
      )}

      {!loading && tarefasPendentes.length > 0 && (
        <ul className={styles.taskList}>
          {tarefasPendentes.map(maquina => (
            // O link agora leva para a página de checklist da máquina
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