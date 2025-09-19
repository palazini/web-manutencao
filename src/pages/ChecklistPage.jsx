// src/pages/ChecklistPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './ChecklistPage.module.css';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Nossa API (sem Firebase)
import {
  BASE,
  listarChamados,
  criarChamado,
  enviarChecklistDiaria, // garanta que existe no apiClient (nota no final)
} from '../services/apiClient';

function normalizeChecklist(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  // se vier algo como { items: [...] }
  if (v && typeof v === 'object' && Array.isArray(v.items)) return v.items;
  return [];
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export default function ChecklistPage({ user }) {
  const { maquinaId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const operadorEmail = useMemo(() => String(user?.email || '').toLowerCase(), [user?.email]);

  const [maquina, setMaquina] = useState(null);
  const [perguntas, setPerguntas] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [blockedItems, setBlockedItems] = useState({}); // { key: chamadoId }
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // 1) Busca a máquina e o checklist diário
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);

        const r = await fetch(`${BASE}/maquinas/${maquinaId}`);
        const m = await r.json().catch(() => null);

        if (!r.ok || !m) {
          toast.error(t('checklist.notFound'));
          if (alive) setLoading(false);
          return;
        }

        setMaquina(m);

        // aceita snake_case/camelCase e string JSON
        const raw = m.checklist_diario ?? m.checklistDiario ?? [];
        const lista = normalizeChecklist(raw);

        // inicia tudo como "sim"
        const iniciais = {};
        lista.forEach((item) => { iniciais[item] = 'sim'; });

        setPerguntas(lista);
        setRespostas(iniciais);
      } catch (e) {
        console.error(e);
        toast.error(t('checklist.toastFail'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [maquinaId, t]);

  // 2) Carrega/atualiza bloqueios: chamados preditivos abertos/andamento para esta máquina
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!maquinaId) return;
      try {
        // Ideal: backend suportar filtro por maquinaId e tipo
        // Tentamos direto:
        let abertos = [];
        try {
          abertos = await listarChamados({ status: 'Aberto', tipo: 'preditiva', maquinaId });
        } catch {
          // fallback: pega abertos preditivos e filtra por nome da máquina em memória
          const tmp = await listarChamados({ status: 'Aberto', tipo: 'preditiva' });
          abertos = (tmp || []).filter((c) => {
            // quando o back não manda maquinaId no GET, comparamos por nome
            if (!maquina?.nome) return false;
            return String(c.maquina || '').trim() === String(maquina.nome || '').trim();
          });
        }

        // também considera "Em Andamento"
        let andamento = [];
        try {
          andamento = await listarChamados({ status: 'Em Andamento', tipo: 'preditiva', maquinaId });
        } catch {
          const tmp = await listarChamados({ status: 'Em Andamento', tipo: 'preditiva' });
          andamento = (tmp || []).filter((c) => {
            if (!maquina?.nome) return false;
            return String(c.maquina || '').trim() === String(maquina.nome || '').trim();
          });
        }

        const todos = [...(abertos || []), ...(andamento || [])];

        const map = {};
        for (const c of todos) {
          const key = String(c.checklistItemKey || slugify(c.item || '') || '').trim();
          if (key) map[key] = c.id;
        }

        if (alive) setBlockedItems(map);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [maquinaId, maquina?.nome]);

  const handleRespostaChange = (pergunta, valor) => {
    const key = slugify(pergunta);
    if (valor === 'nao' && blockedItems[key]) {
      toast(t('checklist.toastAlreadyReported', { id: blockedItems[key] }));
      return;
    }
    setRespostas((prev) => ({ ...prev, [pergunta]: valor }));
  };

  const handleSubmit = async () => {
    if (enviando || !maquina) return;
    setEnviando(true);

    try {
      let gerados = 0;

      // 1) cria chamados preditivos para itens "nao" que não estão bloqueados
      for (const pergunta of perguntas) {
        if (respostas[pergunta] !== 'nao') continue;

        const key = slugify(pergunta);
        if (blockedItems[key]) continue; // já existe aberto/andamento

        // tentativa extra de evitar duplicidade (caso back ainda não filtre por maquinaId)
        try {
          const dup = await listarChamados({ status: 'Aberto', tipo: 'preditiva', maquinaId }).catch(() => []);
          const ha = (dup || []).some((c) => String(c.checklistItemKey || '').trim() === key);
          if (ha) continue;
        } catch {}

        await criarChamado(
          {
            tipo: 'preditiva',
            maquinaId: maquina.id,
            maquinaNome: maquina.nome,
            item: pergunta,
            checklistItemKey: key,
            descricao: t('checklist.generatedDescription', { item: pergunta }),
            origin: 'daily_checklist',
            criadoPorEmail: operadorEmail,   // <— ADICIONE ESTA LINHA
          },
          { role: user?.role || 'operador', email: operadorEmail }
        );
        gerados++;
      }
      
      const st = JSON.parse(localStorage.getItem('dadosTurno') || '{}');
      const turno = st?.turno || ''; // 'turno1' | 'turno2' | ''

      // 2) registra submissão diária
      await enviarChecklistDiaria({
        operadorEmail,
        operadorNome: user?.nome || '',
        maquinaId: maquina.id,
        maquinaNome: maquina?.nome || '',
        date: hojeISO(),
        respostas,
        turno,
      });

      toast.success(t('checklist.toastSent', { count: gerados }));

      // 3) atualiza localStorage (ultimaMaquina) e volta ao painel
      try {
        const raw = localStorage.getItem('dadosTurno');
        const st = raw ? JSON.parse(raw) : {};
        const novo = {
          ...st,
          dataISO: hojeISO(),
          operadorEmail,
          ultimaMaquina: null, // concluiu esta
          // garante união de máquinas
          maquinasSelecionadas: Array.from(
            new Set([...(st?.maquinasSelecionadas || []), maquina.id])
          ),
        };
        localStorage.setItem('dadosTurno', JSON.stringify(novo));
      } catch {}

      if (window.history?.state?.idx > 0) {
        navigate(-1); // volta para a lista de tarefas (TarefasDiarias)
      } else {
        // fallback: se não houver histórico, ajuste para a rota da sua lista (ex.: '/tarefas-diarias')
        // navigate('/tarefas-diarias', { replace: true });
        navigate('/', { replace: true }); // mantenho '/' como placeholder se você preferir
      }
    } catch (err) {
      console.error(err);
      toast.error(t('checklist.toastFail'));
    } finally {
      setEnviando(false);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('authUser');
      localStorage.removeItem('dadosTurno');
    } catch {}
    navigate('/login', { replace: true });
  };

  if (loading) return <p>{t('checklist.loading')}</p>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>{t('checklist.title', { machine: maquina?.nome || '' })}</h1>
          <p>{t('checklist.greeting', { name: user?.nome || '' })}</p>

          {/* Botão Sair / escape */}
          <button
            type="button"
            className={styles.escapeButton}
            onClick={handleLogout}
            title={t('common.logout', 'Sair')}
          >
            {t('common.logout', 'Sair')}
          </button>
        </div>

        {perguntas.length === 0 && <p>{t('checklist.empty')}</p>}

        {perguntas.map((pergunta, i) => {
          const key = slugify(pergunta);
          const isBlocked = Boolean(blockedItems[key]);
          return (
            <div key={i} className={styles.checklistItem}>
              <span>{pergunta}</span>
              <div>
                <input
                  type="radio"
                  id={`sim-${i}`}
                  name={`item-${i}`}
                  checked={respostas[pergunta] === 'sim'}
                  onChange={() => handleRespostaChange(pergunta, 'sim')}
                />
                <label htmlFor={`sim-${i}`}>{t('checklist.yes')}</label>

                <input
                  type="radio"
                  id={`nao-${i}`}
                  name={`item-${i}`}
                  checked={respostas[pergunta] === 'nao'}
                  disabled={isBlocked || enviando}
                  onChange={() => handleRespostaChange(pergunta, 'nao')}
                  style={{ marginLeft: '1rem' }}
                />
                <label htmlFor={`nao-${i}`}>{t('checklist.no')}</label>

                {isBlocked && (
                  <small>{t('checklist.alreadyReported', { id: blockedItems[key] })}</small>
                )}
              </div>
            </div>
          );
        })}

        <div className={styles.buttonContainer}>
          <button
            onClick={handleSubmit}
            className={styles.submitButton}
            disabled={enviando}
          >
            {enviando ? t('checklist.sending') : t('checklist.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
