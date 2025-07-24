// src/pages/AnaliseFalhasPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import styles from './AnaliseFalhasPage.module.css';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
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
  const [chamadosCorretivos, setChamadosCorretivos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // --- CONSULTA CORRIGIDA E MAIS ROBUSTA ---
    // Agora buscamos todos os chamados que NÃO SÃO nem 'preventiva' nem 'preditiva'.
    const q = query(
        collection(db, 'chamados'),
        where('tipo', '==', 'corretiva')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chamadosData = snapshot.docs.map(doc => doc.data());

      console.log("Dados recebidos do Firestore:", chamadosData);

      setChamadosCorretivos(chamadosData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // O resto do código continua exatamente o mesmo
  const chartData = useMemo(() => {
    const falhasPorMaquina = {};

    chamadosCorretivos.forEach(chamado => {
      falhasPorMaquina[chamado.maquina] = (falhasPorMaquina[chamado.maquina] || 0) + 1;
    });

    const maquinasOrdenadas = Object.entries(falhasPorMaquina)
      .sort(([, a], [, b]) => b - a);
      
    const labels = maquinasOrdenadas.map(item => item[0]);
    const data = maquinasOrdenadas.map(item => item[1]);

    return {
      labels,
      datasets: [{
        label: 'Nº de Falhas Corretivas',
        data,
        backgroundColor: '#4B70E2',
        borderColor: '#3a56b3',
        borderWidth: 1,
      }],
    };
  }, [chamadosCorretivos]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Distribuição de Falhas Corretivas por Máquina',
        font: {
          size: 18
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      },
    },
  };

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Análise de Falhas por Máquina</h1>
      </header>
      <div style={{ padding: '20px' }}>
        <div className={styles.card}>
          {loading ? (
            <p>Analisando dados...</p>
          ) : (
            <div className={styles.chartContainer}>
              <Bar options={chartOptions} data={chartData} />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AnaliseFalhasPage;