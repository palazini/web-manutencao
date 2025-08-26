import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import styles from './AnaliseFalhasPage.module.css';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

import { useTranslation } from 'react-i18next';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const AnaliseFalhasPage = () => {
  const { t } = useTranslation();

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate]     = useState(null);
  const [chamadosCorretivos, setChamadosCorretivos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const constraints = [where('tipo', '==', 'corretiva')];
    if (startDate) constraints.push(where('dataConclusao', '>=', startDate));
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      constraints.push(where('dataConclusao', '<=', endOfDay));
    }
    constraints.push(orderBy('dataConclusao', 'desc'));

    const q = query(collection(db, 'chamados'), ...constraints);
    const unsubscribe = onSnapshot(q, snapshot => {
      setChamadosCorretivos(snapshot.docs.map(doc => doc.data()));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [startDate, endDate]);

  const chartData = useMemo(() => {
    const falhasPorMaquina = {};
    chamadosCorretivos.forEach(chamado => {
      falhasPorMaquina[chamado.maquina] = (falhasPorMaquina[chamado.maquina] || 0) + 1;
    });
    const sorted = Object.entries(falhasPorMaquina).sort(([, a], [, b]) => b - a);
    return {
      labels: sorted.map(([nome]) => nome),
      datasets: [{
        label: t('analiseFalhas.chart.dataset'),
        data: sorted.map(([, count]) => count),
        backgroundColor: '#4B70E2',
        borderColor: '#3a56b3',
        borderWidth: 1
      }]
    };
  }, [chamadosCorretivos, t]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: t('analiseFalhas.chart.title'), font: { size: 18 } }
    },
    scales: {
      x: { title: { display: true, text: t('analiseFalhas.chart.xLabel') } },
      y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: t('analiseFalhas.chart.yLabel') } }
    }
  }), [t]);

  return (
    <>
      {/* Cabeçalho no card, como no seu layout */}
      <div className={styles.card}>
        <header className={styles.header}>
          <h1>{t('analiseFalhas.title')}</h1>
        </header>
      </div>

      <main className={styles.main}>
        {/* Filtros + gráfico dentro do card */}
        <div className={styles.card}>
          <div className={styles.filterContainer}>
            <div>
              <label htmlFor="startDate">{t('analiseFalhas.filters.start')}</label>
              <input
                type="date"
                id="startDate"
                value={startDate ? startDate.toISOString().split('T')[0] : ''}
                onChange={e => setStartDate(e.target.value ? new Date(e.target.value) : null)}
              />
            </div>
            <div>
              <label htmlFor="endDate">{t('analiseFalhas.filters.end')}</label>
              <input
                type="date"
                id="endDate"
                value={endDate ? endDate.toISOString().split('T')[0] : ''}
                onChange={e => setEndDate(e.target.value ? new Date(e.target.value) : null)}
              />
            </div>
            <button
              className={styles.clearButton}
              onClick={() => { setStartDate(null); setEndDate(null); }}
            >
              {t('analiseFalhas.filters.clear')}
            </button>
          </div>

          {loading ? (
            <p>{t('analiseFalhas.loading')}</p>
          ) : (
            <div className={styles.chartContainer}>
              <Bar options={chartOptions} data={chartData} />
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default AnaliseFalhasPage;
