// src/pages/OperatorFlow.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getTurnoAtual } from '../utils/dateUtils';
import TarefasDiariasPage from './TarefasDiariasPage';
import MainLayout from '../components/MainLayout'; // O operador agora usará o layout principal

const OperatorFlow = ({ user }) => {
  const [checklistPendente, setChecklistPendente] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verificarChecklists = async () => {
      const turnoAtual = getTurnoAtual();
      // Se não está em horário de turno, ou se não é operador, não há checklist pendente.
      if (!turnoAtual || user.role !== 'operador') {
        setChecklistPendente(false);
        setLoading(false);
        return;
      }

      // Busca as máquinas do operador no turno atual
      const qMaquinas = query(
        collection(db, 'maquinas'),
        where(`operadoresPorTurno.${turnoAtual}`, 'array-contains', user.uid)
      );
      const maquinasSnapshot = await getDocs(qMaquinas);
      const maquinasDoOperador = maquinasSnapshot.docs.map(doc => doc.id);

      // Se o operador não tem máquinas, não há checklist pendente.
      if (maquinasDoOperador.length === 0) {
        setChecklistPendente(false);
        setLoading(false);
        return;
      }
      
      // Busca as submissões de hoje para as máquinas do operador
      const hoje = new Date();
      const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      
      const qSubmissoes = query(
        collection(db, 'checklistSubmissions'),
        where('operadorId', '==', user.uid),
        where('dataSubmissao', '>=', inicioDoDia),
        where('maquinaId', 'in', maquinasDoOperador)
      );
      const submissoesSnapshot = await getDocs(qSubmissoes);

      // Se o número de submissões for igual ao número de máquinas, todos foram feitos.
      if (submissoesSnapshot.size >= maquinasDoOperador.length) {
        setChecklistPendente(false);
      } else {
        setChecklistPendente(true);
      }
      setLoading(false);
    };

    verificarChecklists();
  }, [user]);

  if (loading) {
    return <p style={{ padding: '20px' }}>Verificando tarefas diárias...</p>;
  }

  // Se o checklist está pendente, mostra a página de tarefas.
  // Senão, mostra o layout principal com o painel do operador.
  return checklistPendente ? <TarefasDiariasPage user={user} /> : <MainLayout user={user} />;
};

export default OperatorFlow;