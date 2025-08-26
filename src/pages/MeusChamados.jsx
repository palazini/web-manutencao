// src/pages/MeusChamados.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import styles from './MeusChamados.module.css';
import { useTranslation } from 'react-i18next';
import { statusKey } from '../i18n/format';

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  const d = ts instanceof Date ? ts : new Date(ts);
  return isNaN(d) ? null : d;
}
function byRecent(a, b) {
  const aKey = tsToDate(a.assignedAt) || tsToDate(a.dataAbertura) || 0;
  const bKey = tsToDate(b.assignedAt) || tsToDate(b.dataAbertura) || 0;
  return bKey - aKey;
}
const STATUS_BADGE = {
  'Aberto': 'aberto',
  'Em Andamento': 'emandamento',
  'Concluído': 'concluido'
};

export default function MeusChamados({ user }) {
  const { t, i18n } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [docsAssigned, setDocsAssigned] = useState([]);
  const [docsAtendidos, setDocsAtendidos] = useState([]);
  const [statusFiltro, setStatusFiltro] = useState('ativos'); // 'ativos' | 'todos' | 'concluidos'
  const [busca, setBusca] = useState('');

  const uid = user?.uid;

  const dtFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }),
    [i18n.language]
  );
  const formatDate = (v) => {
    const d = tsToDate(v);
    return d ? dtFmt.format(d) : '—';
  };

  // 1) ATRIBUÍDOS a mim
  useEffect(() => {
    if (!uid) return;
    const q1 = query(collection(db, 'chamados'), where('assignedTo', '==', uid));
    const unsub1 = onSnapshot(q1, (snap) => {
      setDocsAssigned(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error('Erro assignedTo==uid:', err);
      setLoading(false);
    });
    return () => unsub1();
  }, [uid]);

  // 2) ATENDIDOS por mim
  useEffect(() => {
    if (!uid) return;
    const q2 = query(collection(db, 'chamados'), where('manutentorId', '==', uid));
    const unsub2 = onSnapshot(q2, (snap) => {
      setDocsAtendidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Erro manutentorId==uid:', err));
    return () => unsub2();
  }, [uid]);

  // Mescla + filtros + ordenação
  const chamados = useMemo(() => {
    const map = new Map();
    [...docsAssigned, ...docsAtendidos].forEach(c => map.set(c.id, c));
    let arr = Array.from(map.values());

    if (statusFiltro === 'ativos') {
      arr = arr.filter(c => c.status === 'Aberto' || c.status === 'Em Andamento');
    } else if (statusFiltro === 'concluidos') {
      arr = arr.filter(c => c.status === 'Concluído');
    }

    const q = busca.trim().toLowerCase();
    if (q) {
      arr = arr.filter(c =>
        (c.maquina || '').toLowerCase().includes(q) ||
        (c.descricao || '').toLowerCase().includes(q)
      );
    }

    arr.sort(byRecent);
    return arr;
  }, [docsAssigned, docsAtendidos, statusFiltro, busca]);

  if (!uid) {
    return (
      <div className={styles.container}>
        <p>{t('meusChamados.loginFirst')}</p>
      </div>
    );
  }

  return (
    <>
      {/* Faixa branca do título */}
      <header style={{ padding: '20px', backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>{t('meusChamados.title')}</h1>
      </header>

      {/* Caixa branca do conteúdo */}
      <div className={styles.listContainer}>
        {/* Filtros */}
        <div className={styles.pageHeadActions}>
          <select
            className={styles.select}
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            title={t('meusChamados.filters.statusTitle')}
          >
            <option value="ativos">{t('meusChamados.filters.active')}</option>
            <option value="todos">{t('meusChamados.filters.all')}</option>
            <option value="concluidos">{t('meusChamados.filters.closed')}</option>
          </select>

          <input
            className={`${styles.search} ${styles.pageSearch}`}
            placeholder={t('meusChamados.filters.searchPlaceholder')}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <footer className={styles.footer}>
          <small>{t('meusChamados.footerTip')}</small>
        </footer>

        {/* Lista/Tabela */}
        {loading ? (
          <p className={styles.loading}>{t('meusChamados.loading')}</p>
        ) : chamados.length === 0 ? (
          <p className={styles.empty}>{t('meusChamados.empty')}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('meusChamados.table.hash')}</th>
                  <th>{t('meusChamados.table.machine')}</th>
                  <th>{t('meusChamados.table.description')}</th>
                  <th>{t('meusChamados.table.status')}</th>
                  <th>{t('meusChamados.table.assignedAt')}</th>
                  <th>{t('meusChamados.table.openedAt')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {chamados.map((c, idx) => (
                  <tr key={c.id}>
                    <td>{String(idx + 1).padStart(2, '0')}</td>
                    <td>{c.maquina || '—'}</td>
                    <td className={styles.descCell} title={c.descricao || ''}>
                      {(c.descricao || '').slice(0, 80) + ((c.descricao || '').length > 80 ? '…' : '')}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[STATUS_BADGE[c.status] || 'badge']}`}>
                        {/* mostra traduzido, mas mantém status original no dado */}
                        {t(`status.${statusKey(c.status)}`)}
                      </span>
                    </td>
                    <td>{formatDate(c.assignedAt)}</td>
                    <td>{formatDate(c.dataAbertura)}</td>
                    <td>
                      <Link to={`/maquinas/chamado/${c.id}`} className={styles.linkBtn}>
                        {t('meusChamados.table.open')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
