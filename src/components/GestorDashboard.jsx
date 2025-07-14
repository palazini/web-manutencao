// src/components/GestorDashboard.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import styles from './GestorDashboard.module.css';

// Importar os componentes de gráfico e as dependências do Chart.js
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

// Registrar os componentes do Chart.js que vamos usar
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const GestorDashboard = ({ user }) => {
  const [todosChamados, setTodosChamados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroMaquina, setFiltroMaquina] = useState('todas');

  useEffect(() => {
    const q = query(collection(db, 'chamados'), orderBy('dataAbertura', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const chamadosData = [];
      querySnapshot.forEach((doc) => {
        chamadosData.push({ id: doc.id, ...doc.data() });
      });
      setTodosChamados(chamadosData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const chamadosFiltrados = useMemo(() => {
    return todosChamados.filter(chamado => {
      const statusMatch = filtroStatus === 'todos' || chamado.status === filtroStatus;
      const maquinaMatch = filtroMaquina === 'todas' || chamado.maquina === filtroMaquina;
      return statusMatch && maquinaMatch;
    });
  }, [todosChamados, filtroStatus, filtroMaquina]);

  const stats = useMemo(() => ({
    abertos: todosChamados.filter(c => c.status === 'Aberto').length,
    emAndamento: todosChamados.filter(c => c.status === 'Em Andamento').length,
    concluidos: todosChamados.filter(c => c.status === 'Concluído').length,
  }), [todosChamados]);

  const maquinasDisponiveis = useMemo(() => [...new Set(todosChamados.map(c => c.maquina))], [todosChamados]);

  const chartData = useMemo(() => {
    const statusCounts = { Aberto: 0, 'Em Andamento': 0, Concluído: 0 };
    const maquinaCounts = {};

    todosChamados.forEach(chamado => {
      statusCounts[chamado.status] = (statusCounts[chamado.status] || 0) + 1;
      maquinaCounts[chamado.maquina] = (maquinaCounts[chamado.maquina] || 0) + 1;
    });

    const pieChartData = {
      labels: ['Aberto', 'Em Andamento', 'Concluído'],
      datasets: [{
        data: [statusCounts.Aberto, statusCounts['Em Andamento'], statusCounts.Concluído],
        backgroundColor: ['#007bff', '#ffc107', '#28a745'],
      }],
    };

    const barChartData = {
      labels: Object.keys(maquinaCounts),
      datasets: [{
        label: 'Nº de Chamados',
        data: Object.values(maquinaCounts),
        backgroundColor: '#4B70E2',
      }],
    };

    return { pieChartData, barChartData };
  }, [todosChamados]);

  if (loading) return <p>Carregando dados gerenciais...</p>;

  // AQUI ESTÁ A CONSTANTE QUE FALTAVA
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
  };

  return (
    <div>
      <div className={styles.statsContainer}>
        <div className={styles.statCard}><h3>Abertos</h3><p>{stats.abertos}</p></div>
        <div className={styles.statCard}><h3>Em Andamento</h3><p>{stats.emAndamento}</p></div>
        <div className={styles.statCard}><h3>Concluídos</h3><p>{stats.concluidos}</p></div>
      </div>

      <div className={styles.chartsContainer}>
        <div className={styles.chartCard}>
          <h3>Chamados por Status</h3>
          {/* Adicionamos a div "invólucro" aqui */}
          <div className={styles.chartWrapper}>
            <Pie data={chartData.pieChartData} options={chartOptions} />
          </div>
        </div>
        <div className={styles.chartCard}>
          <h3>Chamados por Máquina</h3>
          {/* E aqui também */}
          <div className={styles.chartWrapper}>
            <Bar data={chartData.barChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      <div className={styles.filtersContainer}>
        <div className={styles.filterGroup}>
          <label htmlFor="filtro-status">Filtrar por Status</label>
          <select id="filtro-status" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="Aberto">Aberto</option>
            <option value="Em Andamento">Em Andamento</option>
            <option value="Concluído">Concluído</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="filtro-maquina">Filtrar por Máquina</label>
          <select id="filtro-maquina" value={filtroMaquina} onChange={(e) => setFiltroMaquina(e.target.value)}>
            <option value="todas">Todas</option>
            {maquinasDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.chamadoList}>
        {chamadosFiltrados.map((chamado) => (
          <Link to={`/historico/chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoLink}>
            <div className={styles.chamadoItem}>
              <div className={styles.chamadoInfo}>
                <strong>Máquina: {chamado.maquina}</strong>
                <small>Status: {chamado.status} | Aberto por: {chamado.operadorNome}</small>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default GestorDashboard;