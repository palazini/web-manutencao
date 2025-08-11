import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  query,
  where,
  getFirestore
} from 'firebase/firestore';
import { db } from '../firebase';
import styles from './MeusChamados.module.css';

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  const d = ts instanceof Date ? ts : new Date(ts);
  return isNaN(d) ? null : d;
}
function formatBR(ts) {
  const d = tsToDate(ts);
  return d ? d.toLocaleString('pt-BR') : '—';
}
function byRecent(a, b) {
  // ordena por assignedAt (desc), fallback dataAbertura
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
  const [carregando, setCarregando] = useState(true);
  const [docsAssigned, setDocsAssigned] = useState([]);
  const [docsAtendidos, setDocsAtendidos] = useState([]);
  const [statusFiltro, setStatusFiltro] = useState('ativos'); // ativos = Aberto + Em Andamento
  const [busca, setBusca] = useState('');

  const uid = user?.uid;

  // 1) Chamados ATRIBUÍDOS a mim
  useEffect(() => {
    if (!uid) return;
    const q1 = query(
      collection(db, 'chamados'),
      where('assignedTo', '==', uid)
    );
    const unsub1 = onSnapshot(q1, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDocsAssigned(arr);
      setCarregando(false);
    }, (err) => {
      console.error('Erro assignedTo==uid:', err);
      setCarregando(false);
    });
    return () => unsub1();
  }, [uid]);

  // 2) Chamados que eu ATENDI (mesmo sem atribuição)
  useEffect(() => {
    if (!uid) return;
    const q2 = query(
      collection(db, 'chamados'),
      where('manutentorId', '==', uid)
    );
    const unsub2 = onSnapshot(q2, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDocsAtendidos(arr);
    }, (err) => console.error('Erro manutentorId==uid:', err));
    return () => unsub2();
  }, [uid]);

  // Mescla (sem duplicar)
  const chamados = useMemo(() => {
    const map = new Map();
    [...docsAssigned, ...docsAtendidos].forEach(c => map.set(c.id, c));
    let arr = Array.from(map.values());

    // filtro de status
    if (statusFiltro === 'ativos') {
      arr = arr.filter(c => c.status === 'Aberto' || c.status === 'Em Andamento');
    } else if (statusFiltro === 'concluidos') {
      arr = arr.filter(c => c.status === 'Concluído');
    }

    // filtro de texto (máquina/descrição)
    const q = busca.trim().toLowerCase();
    if (q) {
      arr = arr.filter(c =>
        (c.maquina || '').toLowerCase().includes(q) ||
        (c.descricao || '').toLowerCase().includes(q)
      );
    }

    // ordenação
    arr.sort(byRecent);
    return arr;
  }, [docsAssigned, docsAtendidos, statusFiltro, busca]);

  if (!uid) {
    return <div className={styles.container}><p>Faça login para ver seus chamados.</p></div>;
  }

  return (
    <>
        {/* Faixa branca do título (igual ao Calendário) */}
        <header style={{ padding: '20px', backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Meus Chamados</h1>
        </header>

        {/* Caixa branca do conteúdo */}
        <div className={styles.listContainer}>
        {/* Filtros no topo */}
        <div className={styles.pageHeadActions}>
            <select
            className={styles.select}
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            title="Filtrar por status"
            >
            <option value="ativos">Abertos & Em Andamento</option>
            <option value="todos">Todos</option>
            <option value="concluidos">Concluídos</option>
            </select>

            <input
            className={`${styles.search} ${styles.pageSearch}`}
            placeholder="Buscar por máquina ou descrição..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            />
        </div>

        <footer className={styles.footer}>
            <small>Dica: use o filtro “Concluídos” para histórico pessoal.</small>
        </footer>

        {/* Lista/Tabela */}
        {carregando ? (
            <p className={styles.loading}>Carregando...</p>
        ) : chamados.length === 0 ? (
            <p className={styles.empty}>Nenhum chamado encontrado.</p>
        ) : (
            <div className={styles.tableWrap}>
            <table className={styles.table}>
                <thead>
                <tr>
                    <th>#</th>
                    <th>Máquina</th>
                    <th>Descrição</th>
                    <th>Status</th>
                    <th>Atribuído em</th>
                    <th>Abertura</th>
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
                        {c.status || '—'}
                        </span>
                    </td>
                    <td>{formatBR(c.assignedAt)}</td>
                    <td>{formatBR(c.dataAbertura)}</td>
                    <td>
                        {/* caminho absoluto para o detalhe, como combinamos */}
                        <Link to={`/maquinas/chamado/${c.id}`} className={styles.linkBtn}>
                        Abrir
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
