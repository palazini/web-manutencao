// src/pages/PlanosPage.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import styles from './PlanosPage.module.css';

const PlanosPage = () => {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados do formulário
  const [maquina, setMaquina] = useState('');
  const [descricao, setDescricao] = useState('');
  const [frequencia, setFrequencia] = useState(30);

  // Lista de máquinas (poderia vir do banco de dados no futuro)
  const maquinasDisponiveis = ['TCN-12', 'TCN-17', 'TCN-18', 'TCN-19', 'TCN-20', 'CT-01', 'Compressor', 'Fresadora'];

  // Busca os planos existentes
  useEffect(() => {
    const q = query(collection(db, 'planosManutencao'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const planosData = [];
      querySnapshot.forEach((doc) => {
        planosData.push({ id: doc.id, ...doc.data() });
      });
      setPlanos(planosData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!maquina || !descricao || !frequencia) {
      toast.error("Preencha todos os campos do plano.");
      return;
    }

    try {
      // Calcula a primeira data de execução como sendo "hoje"
      const proximaData = new Date();

      await addDoc(collection(db, 'planosManutencao'), {
        maquina,
        descricao,
        frequencia: Number(frequencia),
        proximaData, // Salva como um objeto de data do JS
        ativo: true,
      });

      toast.success("Plano de manutenção criado com sucesso!");
      // Limpa o formulário
      setMaquina('');
      setDescricao('');
      setFrequencia(30);

    } catch (error) {
      console.error("Erro ao criar plano: ", error);
      toast.error("Não foi possível criar o plano.");
    }
  };

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Planos de Manutenção Preventiva</h1>
      </header>
      <div style={{ padding: '20px' }}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Novo Plano</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="maquina">Máquina</label>
                <select id="maquina" value={maquina} onChange={(e) => setMaquina(e.target.value)} className={styles.select} required>
                  <option value="" disabled>Selecione...</option>
                  {maquinasDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="frequencia">Frequência (em dias)</label>
                <input type="number" id="frequencia" value={frequencia} onChange={(e) => setFrequencia(e.target.value)} className={styles.input} required min="1" />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="descricao">Descrição da Tarefa</label>
              <input id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} className={styles.input} placeholder="Ex: Verificar óleo e filtros" required />
            </div>
            <button type="submit" className={styles.button}>Criar Plano</button>
          </form>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Planos Ativos</h2>
          {loading ? <p>Carregando...</p> : (
            <ul className={styles.planList}>
              {planos.map(plano => (
                <li key={plano.id} className={styles.planItem}>
                  <div className={styles.planInfo}>
                    <strong>{plano.maquina}</strong>
                    <span>{plano.descricao}</span>
                  </div>
                  <span>A cada {plano.frequencia} dias</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default PlanosPage;