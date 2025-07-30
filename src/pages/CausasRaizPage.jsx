// src/pages/CausasRaizPage.jsx
import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  where
} from 'firebase/firestore';
import { db } from '../firebase.js';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';
import styles from './CausasRaizPage.module.css';

function CausasCrud() {
  const [causas, setCausas] = useState([]);
  const [novoNome, setNovoNome] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'causasRaiz'));
    const unsub = onSnapshot(q, snap => {
      setCausas(snap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
    });
    return () => unsub();
  }, []);

  const handleAdd = async e => {
    e.preventDefault();
    const nome = novoNome.trim();
    if (!nome) return;
    await addDoc(collection(db, 'causasRaiz'), { nome });
    setNovoNome('');
  };

  const handleDelete = async id => {
    if (!window.confirm('Excluir esta causa?')) return;
    await deleteDoc(doc(db, 'causasRaiz', id));
  };

  return (
    <div>
      <form onSubmit={handleAdd} className={styles.formGroup}>
        <input
          type="text"
          className={styles.input}
          placeholder="Nova causa"
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          required
        />
        <button type="submit" className={styles.button}>
          Adicionar
        </button>
      </form>
      <ul className={styles.list}>
        {causas.map(c => (
          <li key={c.id} className={styles.listItem}>
            {c.nome}
            <button
              className={styles.deleteButton}
              onClick={() => handleDelete(c.id)}
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ParetoChart() {
  const [dados, setDados] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'chamados'),
      where('status', '==', 'Concluído')
    );
    const unsub = onSnapshot(q, snap => {
      // 1) extrai todas as causas
      const raw = snap.docs
        .map(d => d.data().causa)
        .filter(c => !!c);

      // 2) conta frequências
      const freq = raw.reduce((acc, causa) => {
        acc[causa] = (acc[causa] || 0) + 1;
        return acc;
      }, {});

      // 3) monta array e ordena desc
      let arr = Object.entries(freq).map(([causa, count]) => ({
        causa,
        count
      }));
      arr.sort((a, b) => b.count - a.count);

      // 4) calcula total, % e % acumulado
      const total = arr.reduce((sum, x) => sum + x.count, 0);
      let acumulado = 0;
      arr = arr.map(item => {
        acumulado += item.count;
        return {
          ...item,
          percent: Number(((item.count / total) * 100).toFixed(1)),
          acumPercent: Number(((acumulado / total) * 100).toFixed(1))
        };
      });

      setDados(arr);
    });
    return () => unsub();
  }, []);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={dados}>
        <CartesianGrid stroke="#f5f5f5" />
        <XAxis dataKey="causa" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
        <Tooltip />
        <Legend />
        <Bar
          yAxisId="left"
          dataKey="count"
          name="Chamados"
          fill="#8884d8"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="acumPercent"
          name="% Acumulado"
          stroke="#ff7300"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default function CausasRaizPage() {
  return (
    <div className={styles.pageContainer}>
      <section className={styles.crudSection}>
        <h2>Gerenciar Causas Raiz</h2>
        <CausasCrud />
      </section>
      <section className={styles.chartSection}>
        <h2>Pareto de Falhas</h2>
        <ParetoChart />
      </section>
    </div>
  );
}
