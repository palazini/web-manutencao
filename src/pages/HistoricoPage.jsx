import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { exportToExcel } from '../utils/exportExcel';
import { exportToPdf }   from '../utils/exportPdf';
import styles from './HistoricoPage.module.css';
import { useTranslation } from 'react-i18next';

const HistoricoPage = () => {
  const { t, i18n } = useTranslation();

  const [chamadosConcluidos, setChamadosConcluidos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de filtro
  const [filtroTipoChamado, setFiltroTipoChamado] = useState('todos');
  const [filtroTipoMaquina, setFiltroTipoMaquina] = useState('todos');

  const dtFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }),
    [i18n.language]
  );

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
  const historicoFiltrado = chamadosConcluidos.filter((chamado) => {
    const matchTipo = filtroTipoChamado === 'todos' || chamado.tipo === filtroTipoChamado;
    const matchMaquina = filtroTipoMaquina === 'todos' || chamado.maquina === filtroTipoMaquina;
    return matchTipo && matchMaquina;
  });

  // Lista de máquinas únicas para o dropdown
  const maquinasUnicas = Array.from(new Set(chamadosConcluidos.map((c) => c.maquina))).filter(Boolean);

  // Tradução para o tipo (apenas para mostrar/exports; mantém os valores internos)
  const tipoLabel = (tipo) => {
    if (tipo === 'corretiva') return t('historico.filters.typeOptions.corrective');
    if (tipo === 'preventiva') return t('historico.filters.typeOptions.preventive');
    if (tipo === 'preditiva') return t('historico.filters.typeOptions.predictive');
    return tipo || '';
  };

  // Normaliza o array de observações para texto
  const observacoesToText = (obs) => {
    if (!Array.isArray(obs) || obs.length === 0) return '';
    const parts = obs
      .map((o) => {
        if (o == null) return '';
        if (typeof o === 'string') return o.trim();
        if (typeof o === 'object') {
          // tenta alguns campos comuns
          const keys = ['texto', 'descricao', 'descrição', 'observacao', 'observação', 'obs', 'note', 'text', 'message'];
          for (const k of keys) {
            if (typeof o[k] === 'string' && o[k].trim()) return o[k].trim();
          }
          try {
            return JSON.stringify(o);
          } catch {
            return '';
          }
        }
        return String(o);
      })
      .filter(Boolean);

    return parts.join(' • ');
  };

  // Label traduzida com fallback para quando a chave ainda não existir no i18n
  const obsLabel = t('historico.export.columns.observations', { defaultValue: 'Observações' });

  // Dados para Excel (as chaves do objeto viram os cabeçalhos)
  const excelData = historicoFiltrado.map((c) => ({
    [t('historico.export.columns.machine')]: c.maquina,
    [t('historico.export.columns.callType')]: tipoLabel(c.tipo),
    [t('historico.export.columns.openedAt')]: c.dataAbertura ? dtFmt.format(c.dataAbertura.toDate()) : '',
    [t('historico.export.columns.attendedBy')]: c.manutentorNome || '',
    [t('historico.export.columns.performedService')]: c.solucao || '',
    [t('historico.export.columns.cause')]: c.causa || '',
    [t('historico.export.columns.concludedAt')]: c.dataConclusao ? dtFmt.format(c.dataConclusao.toDate()) : '',
    [t('historico.export.columns.problem')]: c.descricao || '',
    // NOVO: Observações
    [obsLabel]: observacoesToText(c.observacoes),
  }));

  // Dados para PDF (mantém as keys originais; labels traduzidos no array de colunas)
  const pdfColumns = [
    { key: 'maquina',        label: t('historico.export.columns.machine') },
    { key: 'tipo',           label: t('historico.export.columns.callType') },
    { key: 'dataAbertura',   label: t('historico.export.columns.openedAt') },
    { key: 'manutentorNome', label: t('historico.export.columns.attendedBy') },
    { key: 'solucao',        label: t('historico.export.columns.performedService') },
    { key: 'causa',          label: t('historico.export.columns.cause') },
    { key: 'dataConclusao',  label: t('historico.export.columns.concludedAt') },
    { key: 'descricao',      label: t('historico.export.columns.problem') },
    // NOVO: Observações
    { key: 'observacoes',    label: obsLabel },
  ];

  const pdfData = historicoFiltrado.map((c) => ({
    ...c,
    dataAbertura: c.dataAbertura ? dtFmt.format(c.dataAbertura.toDate()) : '',
    dataConclusao: c.dataConclusao ? dtFmt.format(c.dataConclusao.toDate()) : '',
    tipo: tipoLabel(c.tipo),
    // NOVO: Observações já normalizadas como string
    observacoes: observacoesToText(c.observacoes),
  }));

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>{t('historico.title')}</h1>
      </header>

      <div style={{ padding: '20px' }}>
        <div className={styles.card}>
          {loading ? (
            <p>{t('historico.loading')}</p>
          ) : (
            <>
              {/* Área de exportação */}
              <div className={styles.exportButtons}>
                <button
                  onClick={() =>
                    exportToExcel(excelData, t('historico.export.sheetName'), 'historico-chamados')
                  }
                >
                  {t('historico.export.downloadExcel')}
                </button>
                <button onClick={() => exportToPdf(pdfData, pdfColumns, 'historico-chamados')}>
                  {t('historico.export.downloadPdf')}
                </button>
              </div>

              {/* Filtros */}
              <div className={styles.filterContainer}>
                <div>
                  <label htmlFor="filtroTipoChamado">{t('historico.filters.byType')}</label>
                  <select
                    id="filtroTipoChamado"
                    className={styles.select}
                    value={filtroTipoChamado}
                    onChange={(e) => setFiltroTipoChamado(e.target.value)}
                  >
                    <option value="todos">{t('historico.filters.typeOptions.all')}</option>
                    <option value="corretiva">{t('historico.filters.typeOptions.corrective')}</option>
                    <option value="preventiva">{t('historico.filters.typeOptions.preventive')}</option>
                    <option value="preditiva">{t('historico.filters.typeOptions.predictive')}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="filtroTipoMaquina">{t('historico.filters.byMachine')}</label>
                  <select
                    id="filtroTipoMaquina"
                    className={styles.select}
                    value={filtroTipoMaquina}
                    onChange={(e) => setFiltroTipoMaquina(e.target.value)}
                  >
                    <option value="todos">{t('historico.filters.machineOptions.all')}</option>
                    {maquinasUnicas.map((maquina) => (
                      <option key={maquina} value={maquina}>
                        {maquina}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {historicoFiltrado.length === 0 ? (
                <p>{t('historico.empty')}</p>
              ) : (
                <ul className={styles.chamadoList}>
                  {historicoFiltrado.map((chamado) => (
                    <Link to={`chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoLink}>
                      <li className={styles.chamadoItem}>
                        <div className={styles.chamadoInfo}>
                          <strong>
                            {t('historico.item.machine', { name: chamado.maquina })}
                          </strong>
                          <small>
                            {t('historico.item.attendedBy', {
                              name: chamado.manutentorNome || t('historico.item.unknown'),
                            })}
                          </small>
                          <small>
                            {t('historico.item.concludedAt', {
                              date: chamado.dataConclusao
                                ? dtFmt.format(chamado.dataConclusao.toDate())
                                : '...',
                            })}
                          </small>
                          <p className={styles.problemaPreview}>
                            <strong>{t('historico.item.problem')}</strong>{' '}
                            {chamado.descricao || t('historico.item.notSpecified')}
                          </p>
                          {/* (Opcional) Prévia das observações na lista — pode remover se não quiser mostrar aqui */}
                          {/* <p className={styles.problemaPreview}>
                            <strong>{obsLabel}:</strong> {observacoesToText(chamado.observacoes) || '—'}
                          </p> */}
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
