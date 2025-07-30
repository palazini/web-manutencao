// src/pages/AnaliseFalhasPage.jsx

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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const AnaliseFalhasPage = () => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate]     = useState(null);
  const [chamadosCorretivos, setChamadosCorretivos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const constraints = [where('tipo', '==', 'corretiva')];
    if (startDate) {
      constraints.push(where('dataConclusao', '>=', startDate));
    }
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
      labels: sorted.map(item => item[0]),
      datasets: [{
        label: 'Nº de Falhas Corretivas',
        data: sorted.map(item => item[1]),
        backgroundColor: '#4B70E2',
        borderColor: '#3a56b3',
        borderWidth: 1
      }]
    };
  }, [chamadosCorretivos]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Distribuição de Falhas Corretivas por Máquina', font: { size: 18 } }
    },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
  };

  return (
    <>
      {/* Apenas o header dentro de seu card */}
      <div className={styles.card}>
        <header className={styles.header}>
          <h1>Análise de Falhas Corretivas</h1>
        </header>
      </div>

      <main className={styles.main}>
        {/* Card contendo filtro e gráfico */}
        <div className={styles.card}>
          <div className={styles.filterContainer}>
            <div>
              <label htmlFor="startDate">Início:</label>
              <input
                type="date"
                id="startDate"
                value={startDate ? startDate.toISOString().split('T')[0] : ''}
                onChange={e => setStartDate(e.target.value ? new Date(e.target.value) : null)}
              />
            </div>
            <div>
              <label htmlFor="endDate">Fim:</label>
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
            Limpar
          </button>
          </div>

          {loading ? (
            <p>Analisando dados...</p>
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
