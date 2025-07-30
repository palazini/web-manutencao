// src/pages/HistoricoPage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { exportToExcel } from '../utils/exportExcel';
import { exportToPdf }   from '../utils/exportPdf';
import styles from './HistoricoPage.module.css';

const HistoricoPage = () => {
  const [chamadosConcluidos, setChamadosConcluidos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de filtro
  const [filtroTipoChamado, setFiltroTipoChamado] = useState('todos');
  const [filtroTipoMaquina, setFiltroTipoMaquina] = useState('todos');

  useEffect(() => {
    const q = query(
      collection(db, 'chamados'),
      where('status', '==', 'Concluído'),
      orderBy('dataConclusao', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const chamadosData = [];
      querySnapshot.forEach((doc) => {
        chamadosData.push({ id: doc.id, ...doc.data() });
      });
      setChamadosConcluidos(chamadosData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Derivação de histórico filtrado
  const historicoFiltrado = chamadosConcluidos.filter(chamado => {
    const matchTipo = filtroTipoChamado === 'todos' || chamado.tipo === filtroTipoChamado;
    const matchMaquina = filtroTipoMaquina === 'todos' || chamado.maquina === filtroTipoMaquina;
    return matchTipo && matchMaquina;
  });

  // Lista de máquinas únicas para o dropdown
  const maquinasUnicas = Array.from(new Set(chamadosConcluidos.map(c => c.maquina)));

  // Preparar dados para exportação
 const excelData = historicoFiltrado.map(c => ({
    Máquina: c.maquina,
    'Tipo de Chamado': c.tipo,
    'Aberto em': c.dataAbertura 
      ? new Date(c.dataAbertura.toDate()).toLocaleString('pt-BR')
      : '',
    'Atendido Por': c.manutentorNome || '',
    'Serviço Realizado': c.solucao || '',
    'Causa da Falha': c.causa || '',
    'Data Conclusão': c.dataConclusao
      ? new Date(c.dataConclusao.toDate()).toLocaleString('pt-BR')
      : '',
    Problema: c.descricao || ''
  }));

  const pdfColumns = [
    { key: 'maquina',        label: 'Máquina' },
    { key: 'tipo',           label: 'Tipo de Chamado' },
    { key: 'dataAbertura',   label: 'Aberto em' },
    { key: 'manutentorNome', label: 'Atendido Por' },
    { key: 'solucao',        label: 'Serviço Realizado' },
    { key: 'causa',          label: 'Causa da Falha' },
    { key: 'dataConclusao',  label: 'Data Conclusão' },
    { key: 'descricao',      label: 'Problema' }
  ];

  const pdfData = historicoFiltrado.map(c => ({
    ...c,
    dataAbertura: c.dataAbertura
      ? new Date(c.dataAbertura.toDate()).toLocaleString('pt-BR')
      : '',
    dataConclusao: c.dataConclusao
      ? new Date(c.dataConclusao.toDate()).toLocaleString('pt-BR')
      : ''
  }));

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Histórico de Manutenções</h1>
      </header>
      <div style={{ padding: '20px' }}>
        <div className={styles.card}>
          {loading ? (
            <p>Carregando histórico...</p>
          ) : (
            <>
              {/* Área de exportação */}
              <div className={styles.exportButtons}>
                <button onClick={() => exportToExcel(excelData, 'Chamados', 'historico-chamados')}>
                  Baixar Excel
                </button>
                <button onClick={() => exportToPdf(pdfData, pdfColumns, 'historico-chamados')}>
                  Baixar PDF
                </button>
              </div>

              {/* Filtros */}
              <div className={styles.filterContainer}>
                <div>
                  <label htmlFor="filtroTipoChamado">Filtrar por tipo de chamado:</label>
                  <select
                    id="filtroTipoChamado"
                    className={styles.select}
                    value={filtroTipoChamado}
                    onChange={e => setFiltroTipoChamado(e.target.value)}
                  >
                    <option value="todos">Todos</option>
                    <option value="corretiva">Corretiva</option>
                    <option value="preventiva">Preventiva</option>
                    <option value="preditiva">Preditiva</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="filtroTipoMaquina">Filtrar por máquina:</label>
                  <select
                    id="filtroTipoMaquina"
                    className={styles.select}
                    value={filtroTipoMaquina}
                    onChange={e => setFiltroTipoMaquina(e.target.value)}
                  >
                    <option value="todos">Todos</option>
                    {maquinasUnicas.map(maquina => (
                      <option key={maquina} value={maquina}>{maquina}</option>
                    ))}
                  </select>
                </div>
              </div>

              {historicoFiltrado.length === 0 ? (
                <p>Nenhum chamado concluído para os filtros selecionados.</p>
              ) : (
                <ul className={styles.chamadoList}>
                  {historicoFiltrado.map((chamado) => (
                    <Link to={`chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoLink}>
                      <li className={styles.chamadoItem}>
                        <div className={styles.chamadoInfo}>
                          <strong>Máquina: {chamado.maquina}</strong>
                          <small>Atendido por: {chamado.manutentorNome || 'Não identificado'}</small>
                          <small>
                            Concluído em: {' '}
                            {chamado.dataConclusao
                              ? new Date(chamado.dataConclusao.toDate()).toLocaleString('pt-BR')
                              : '...'}
                          </small>
                          <p className={styles.problemaPreview}>
                            <strong>Problema:</strong> {chamado.descricao || 'Não especificado'}
                          </p>
                        </div>
                      </li>
                    </Link>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default HistoricoPage;
