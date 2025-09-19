// src/components/OperatorDashboard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import styles from './OperatorDashboard.module.css';
import { FiPlusCircle, FiTool } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { statusKey } from '../i18n/format';

// API (sem Firebase)
import {
  listarMaquinas,
  listarChamados,
  criarChamado,
  // opcional: só atualiza em tempo real se existir
  subscribeSSE,
} from '../services/apiClient';

const STATUS_BADGE = {
  Aberto: 'aberto',
  'Em Andamento': 'emandamento',
  'Concluído': 'concluido',
};

export default function OperatorDashboard({ user }) {
  const { t, i18n } = useTranslation();

  // formulário
  const [maquinaId, setMaquinaId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // listas
  const [maquinas, setMaquinas] = useState([]); // [{id, nome, ...}]
  const [chamados, setChamados] = useState([]);
  const [listLoading, setListLoading] = useState(true);

  const dtFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }),
    [i18n.language]
  );

  const operadorEmail = useMemo(() => String(user?.email || '').toLowerCase(), [user?.email]);

  const formatTS = (val) => {
    if (!val) return '...';
    // API costuma enviar 'YYYY-MM-DD HH:MM'
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(val)) {
      const d = new Date(val.replace(' ', 'T'));
      return isNaN(d) ? val : dtFmt.format(d);
    }
    const d = new Date(val);
    return isNaN(d) ? '...' : dtFmt.format(d);
  };

  // Carrega máquinas
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const itens = await listarMaquinas().catch(() => []);
        if (!alive) return;
        const ordenadas = (itens || [])
          .filter((m) => m?.id && (m?.nome || m?.tag))
          .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt'));
        setMaquinas(ordenadas);
      } catch (e) {
        console.error('Falha ao carregar máquinas:', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Carrega chamados do operador
  const carregarChamados = async () => {
    try {
      setListLoading(true);
      const lista = await listarChamados({ criadoPorEmail: operadorEmail }).catch(() => []);
      // suporte {items:[]} ou array direto (apiClient já normaliza, mas garantimos)
      const arr = Array.isArray(lista?.items) ? lista.items : Array.isArray(lista) ? lista : [];
      setChamados(arr);
    } catch (e) {
      console.error('Erro ao carregar chamados do operador:', e);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (!operadorEmail) return;
    let stopPolling;
    carregarChamados();

    // Tempo real via SSE (se disponível)
    let unsubscribeSSE = null;
    if (typeof subscribeSSE === 'function') {
      try {
        unsubscribeSSE = subscribeSSE((evt) => {
          // nosso backend emite {topic:'chamados', action:'created'|'picked'|'finished', id?...}
          if (evt?.topic === 'chamados') {
            carregarChamados();
          }
        });
      } catch (e) {
        // fallback polling
        stopPolling = setInterval(carregarChamados, 30000);
      }
    } else {
      // fallback polling
      stopPolling = setInterval(carregarChamados, 30000);
    }

    return () => {
      if (unsubscribeSSE) try { unsubscribeSSE(); } catch {}
      if (stopPolling) clearInterval(stopPolling);
    };
  }, [operadorEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!maquinaId || !descricao.trim()) {
      toast.error(t('operatorDashboard.form.required'));
      return;
    }
    setFormLoading(true);
    try {
      const maquina = maquinas.find((m) => m.id === maquinaId);
      await criarChamado(
        {
          // forçamos corretiva para este formulário do operador
          tipo: 'corretiva',
          maquinaId,
          maquinaNome: maquina?.nome || undefined, // ajuda o backend a montar a resposta
          descricao,
          criadoPorEmail: operadorEmail,
          status: 'Aberto',
        },
        { role: 'operador', email: operadorEmail }
      );
      toast.success(
        t('operatorDashboard.form.opened', { machine: maquina?.nome || t('common.machine') })
      );
      setMaquinaId('');
      setDescricao('');
      carregarChamados(); // refetch rápido
    } catch (error) {
      console.error('Erro ao criar chamado: ', error);
      toast.error(t('operatorDashboard.form.error'));
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className={styles.dashboard}>
      {/* Card: abrir chamado */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <FiPlusCircle className={styles.titleIcon} />
          {t('operatorDashboard.form.title')}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="maquina">{t('operatorDashboard.form.selectMachine')}</label>
            <select
              id="maquina"
              value={maquinaId}
              onChange={(e) => setMaquinaId(e.target.value)}
              className={styles.select}
              required
            >
              <option value="" disabled>
                {t('operatorDashboard.form.choosePlaceholder')}
              </option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome || m.tag || m.id}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="descricao">{t('operatorDashboard.form.problem')}</label>
            <textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={styles.textarea}
              placeholder={t('operatorDashboard.form.problemPlaceholder')}
              rows="4"
              required
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={formLoading}>
            {formLoading ? t('operatorDashboard.form.sending') : t('operatorDashboard.form.open')}
          </button>
        </form>
      </div>

      {/* Card: meus chamados */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <FiTool className={styles.titleIcon} />
          {t('operatorDashboard.list.title')}
        </h2>

        {listLoading ? (
          <p>{t('operatorDashboard.list.loading')}</p>
        ) : chamados.length === 0 ? (
          <p>{t('operatorDashboard.list.empty')}</p>
        ) : (
          <ul className={styles.chamadoList}>
            {chamados.map((chamado) => (
              <Link
                to={`/maquinas/chamado/${chamado.id}`}
                key={chamado.id}
                className={styles.chamadoLink}
              >
                <li className={styles.chamadoItem}>
                  <div className={styles.chamadoInfo}>
                    <strong>
                      {t('operatorDashboard.list.machine', { name: chamado.maquina })}
                    </strong>
                    <small>
                      {t('operatorDashboard.list.openedAt', {
                        date: formatTS(chamado.criado_em || chamado.dataAbertura),
                      })}
                    </small>
                    <p className={styles.descriptionPreview}>{chamado.descricao}</p>
                  </div>
                  <span
                    className={`${styles.statusBadge} ${
                      styles[STATUS_BADGE[chamado.status] || 'badge']
                    }`}
                  >
                    {t(`status.${statusKey(chamado.status)}`)}
                  </span>
                </li>
              </Link>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
