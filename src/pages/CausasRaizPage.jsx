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
import { useTranslation } from 'react-i18next';

function CausasCrud() {
  const { t } = useTranslation();
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
    if (!window.confirm(t('causas.confirm.delete'))) return;
    await deleteDoc(doc(db, 'causasRaiz', id));
  };

  return (
    <div>
      <form onSubmit={handleAdd} className={styles.formGroup}>
        <input
          type="text"
          className={styles.input}
          placeholder={t('causas.form.placeholder')}
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          required
        />
        <button type="submit" className={styles.button}>
          {t('causas.form.add')}
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
              {t('causas.list.delete')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ParetoChart() {
  const { t } = useTranslation();
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
      let arr = Object.entries(freq).map(([causa, count]) => ({ causa, count }));
      arr.sort((a, b) => b.count - a.count);

      // 4) total, % e % acumulado
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
        <XAxis
          dataKey="causa"
          label={{ value: t('causas.chart.xLabel'), position: 'insideBottom', offset: -5 }}
        />
        <YAxis
          yAxisId="left"
          label={{ value: t('causas.chart.yLeft'), angle: -90, position: 'insideLeft' }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          label={{ value: t('causas.chart.yRight'), angle: 90, position: 'insideRight' }}
        />
        <Tooltip />
        <Legend />
        <Bar
          yAxisId="left"
          dataKey="count"
          name={t('causas.chart.seriesCalls')}
          fill="#8884d8"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="acumPercent"
          name={t('causas.chart.seriesAccumPct')}
          stroke="#ff7300"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default function CausasRaizPage() {
  const { t } = useTranslation();
  return (
    <div className={styles.pageContainer}>
      <section className={styles.crudSection}>
        <h2>{t('causas.titleCrud')}</h2>
        <CausasCrud />
      </section>
      <section className={styles.chartSection}>
        <h2>{t('causas.titlePareto')}</h2>
        <ParetoChart />
      </section>
    </div>
  );
}
