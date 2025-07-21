// src/pages/OperatorFlow.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getTurnoAtual } from '../utils/dateUtils';
import TarefasDiariasPage from './TarefasDiariasPage';
import MainLayout from '../components/MainLayout'; // O operador agora usará o layout principal

const OperatorFlow = ({ user, dadosTurno }) => {
  const [checklistsPendentes, setChecklistsPendentes] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dadosTurno) {
        setChecklistsPendentes(false);
        setLoading(false);
        return;
    }

    const verificarChecklists = () => {
      // Ouve em tempo real as submissões de hoje para verificar o que já foi feito
      const hoje = new Date();
      const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      
      const qSubmissoes = query(
        collection(db, 'checklistSubmissions'),
        where('operadorId', '==', user.uid),
        where('dataSubmissao', '>=', inicioDoDia)
      );

      const unsubscribe = onSnapshot(qSubmissoes, (submissoesSnapshot) => {
        const maquinasJaFeitas = new Set(submissoesSnapshot.docs.map(doc => doc.data().maquinaId));
        
        // Se o número de checklists feitos for igual ou maior que o de máquinas selecionadas, não há mais pendências
        if (maquinasJaFeitas.size >= dadosTurno.maquinas.length) {
          setChecklistsPendentes(false);
        } else {
          setChecklistsPendentes(true);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    };

    verificarChecklists();
  }, [user.uid, dadosTurno]);

  if (loading) {
    return <p style={{ padding: '20px' }}>Verificando tarefas diárias...</p>;
  }

  // Se o checklist está pendente, mostra a página de tarefas.
  // Senão, mostra o layout principal com o painel do operador.
  return checklistsPendentes ? <TarefasDiariasPage user={user} dadosTurno={dadosTurno} /> : <MainLayout user={user} />;
};

export default OperatorFlow;