// src/components/GestorDashboard.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import styles from './GestorDashboard.module.css';

const GestorDashboard = ({ user }) => {
  const [todosChamados, setTodosChamados] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para os nossos filtros
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroMaquina, setFiltroMaquina] = useState('todas');

  useEffect(() => {
    // A consulta do gestor é mais simples: busca tudo, ordenado pela data
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

  // Usamos useMemo para recalcular a lista filtrada apenas quando os filtros ou a lista principal mudam
  const chamadosFiltrados = useMemo(() => {
    return todosChamados.filter(chamado => {
      const statusMatch = filtroStatus === 'todos' || chamado.status === filtroStatus;
      const maquinaMatch = filtroMaquina === 'todas' || chamado.maquina === filtroMaquina;
      return statusMatch && maquinaMatch;
    });
  }, [todosChamados, filtroStatus, filtroMaquina]);

  // Calculando as estatísticas
  const stats = {
    abertos: todosChamados.filter(c => c.status === 'Aberto').length,
    emAndamento: todosChamados.filter(c => c.status === 'Em Andamento').length,
    concluidos: todosChamados.filter(c => c.status === 'Concluído').length,
  };

  const maquinasDisponiveis = [...new Set(todosChamados.map(c => c.maquina))];

  if (loading) return <p>Carregando dados gerenciais...</p>;

  return (
    <div>
      {/* Cards de Estatísticas */}
      <div className={styles.statsContainer}>
        <div className={styles.statCard}><h3>Abertos</h3><p>{stats.abertos}</p></div>
        <div className={styles.statCard}><h3>Em Andamento</h3><p>{stats.emAndamento}</p></div>
        <div className={styles.statCard}><h3>Concluídos</h3><p>{stats.concluidos}</p></div>
      </div>

      {/* Filtros */}
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

      {/* Lista de Chamados Filtrada */}
      <div className={styles.chamadoList}>
        {chamadosFiltrados.map((chamado) => (
          <Link to={`/chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoLink}>
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