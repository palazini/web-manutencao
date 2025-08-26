import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import styles from './TarefasDiariasPage.module.css';
import { useTranslation } from 'react-i18next';

// A página recebe 'dadosTurno' como prop
const TarefasDiariasPage = ({ user, dadosTurno }) => {
  const { t } = useTranslation();

  const [tarefasPendentes, setTarefasPendentes] = useState([]);
  const [loading, setLoading] = useState(true);

  // helper: divide um array em pedaços de tamanho n
  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  useEffect(() => {
    if (!dadosTurno || !user?.uid) return;

    let unsubscribe = () => {}; // garante cleanup mesmo com async

    const carregarTarefas = async () => {
      setLoading(true);

      // 1) Busca as máquinas selecionadas (em chunks de até 10 IDs)
      let maquinasDoOperador = [];
      const ids = Array.isArray(dadosTurno.maquinas) ? dadosTurno.maquinas : [];
      if (ids.length === 0) {
        setTarefasPendentes([]);
        setLoading(false);
        return;
      }

      const idChunks = chunk(ids, 10);
      const results = await Promise.all(
        idChunks.map(async (ids10) => {
          const qMaquinas = query(collection(db, 'maquinas'), where('__name__', 'in', ids10));
          const snap = await getDocs(qMaquinas);
          return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        })
      );
      maquinasDoOperador = results.flat();

      // 2) Ouve as submissões de HOJE para esse operador
      const hoje = new Date();
      const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

      const qSubmissoes = query(
        collection(db, 'checklistSubmissions'),
        where('operadorId', '==', user.uid),
        where('dataSubmissao', '>=', inicioDoDia)
      );

      unsubscribe = onSnapshot(qSubmissoes, (submissoesSnapshot) => {
        const maquinasJaFeitas = new Set(
          submissoesSnapshot.docs.map(doc => doc.data().maquinaId)
        );
        const pendentes = maquinasDoOperador.filter(maq => !maquinasJaFeitas.has(maq.id));
        setTarefasPendentes(pendentes);
        setLoading(false);
      }, (err) => {
        console.error('Erro ao ouvir checklistSubmissions:', err);
        setLoading(false);
      });
    };

    carregarTarefas();

    return () => {
      try { unsubscribe(); } catch {}
    };
  }, [user?.uid, dadosTurno]);

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <h1>{t('tarefasDiarias.title')}</h1>
        <p>{t('tarefasDiarias.greeting', { name: user?.nome || '' })}</p>
      </header>

      {loading && <p>{t('tarefasDiarias.checking')}</p>}

      {!loading && tarefasPendentes.length === 0 && (
        <p>{t('tarefasDiarias.allDone')}</p>
      )}

      {!loading && tarefasPendentes.length > 0 && (
        <ul className={styles.taskList}>
          {tarefasPendentes.map(maquina => (
            <Link to={`/checklist/${maquina.id}`} key={maquina.id} className={styles.taskItem}>
              <div className={styles.taskInfo}>
                <strong>{maquina.nome}</strong>
              </div>
              <span>{t('tarefasDiarias.fillChecklist')}</span>
            </Link>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TarefasDiariasPage;
