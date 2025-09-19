// src/pages/OperatorFlow.jsx
import React, { useEffect, useMemo, useState } from 'react';
import TarefasDiariasPage from './TarefasDiariasPage';
import MainLayout from '../components/MainLayout';
import { listarSubmissoesDiarias } from '../services/apiClient';

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

export default function OperatorFlow({ user, dadosTurno }) {
  const [loading, setLoading] = useState(true);
  const [temPendentes, setTemPendentes] = useState(true);
  const [maquinasPendentes, setMaquinasPendentes] = useState([]);

  // API base para SSE (opcional)
  const API_BASE = useMemo(() => {
    const b = import.meta.env?.VITE_API_BASE_URL || '';
    return b.replace(/\/+$/, '');
  }, []);

  // resolve lista de máquinas do “estado do dia”
  const maquinasSelecionadas = useMemo(() => {
    // 1) props (novo fluxo do InicioTurnoPage)
    const a = Array.isArray(dadosTurno?.maquinas) ? dadosTurno.maquinas : [];
    // 2) fallback: localStorage (caso tenha reaberto o app depois)
    let b = [];
    try {
      const raw = localStorage.getItem('dadosTurno');
      if (raw) {
        const st = JSON.parse(raw);
        if (
          st?.dataISO === hojeISO() &&
          String(st?.operadorEmail || '').toLowerCase() === String(user?.email || '').toLowerCase()
        ) {
          b = Array.isArray(st.maquinasSelecionadas) ? st.maquinasSelecionadas : [];
        }
      }
    } catch {}
    return uniq([...a, ...b]);
  }, [dadosTurno?.maquinas, user?.email]);

  // função que verifica pendências consultando o backend
  async function verificarPendencias() {
    if (!user?.email) {
      setTemPendentes(false);
      setMaquinasPendentes([]);
      setLoading(false);
      return;
    }
    if (!maquinasSelecionadas.length) {
      setTemPendentes(false);
      setMaquinasPendentes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const date = hojeISO();
      const submissoes = await listarSubmissoesDiarias({
        operadorEmail: user.email,
        date
      });

      // normaliza “máquina da submissão” (aceita maquina_id | maquinaId | maquina)
      const feitosSet = new Set(
        (submissoes || []).map((s) => {
          return (
            s.maquina_id ||
            s.maquinaId ||
            s.maquina || // se vier nome/tag (não ideal), não casa com id — mas mantemos por compat
            null
          );
        })
      );

      // se “maquina” da submissão vier como NOME e você só tem IDs, ajuste o backend para devolver o ID.
      const pend = maquinasSelecionadas.filter((id) => !feitosSet.has(id));

      setMaquinasPendentes(pend);
      setTemPendentes(pend.length > 0);

      // Atualiza localStorage. Mantém última máquina se ainda pendente; zera se acabou tudo.
      try {
        const raw = localStorage.getItem('dadosTurno');
        if (raw) {
          const st = JSON.parse(raw);
          if (st?.dataISO === date) {
            const ultimaAindaExiste = pend.includes(st?.ultimaMaquina);
            const novo = {
              ...st,
              maquinasSelecionadas,
              ultimaMaquina: ultimaAindaExiste ? st.ultimaMaquina : null
            };
            localStorage.setItem('dadosTurno', JSON.stringify(novo));
          }
        }
      } catch {}
    } catch (e) {
      console.error('Falha ao verificar pendências:', e);
      // Em caso de erro, não travar usuário: assume que ainda há pendentes.
      setTemPendentes(true);
      setMaquinasPendentes(maquinasSelecionadas);
    } finally {
      setLoading(false);
    }
  }

  // 1) checa pendências ao montar / mudar operador ou lista de máquinas
  useEffect(() => {
    verificarPendencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, maquinasSelecionadas.join('|')]);

  // 2) SSE (opcional): se backend enviar eventos, recarrega pendências em tempo real
  useEffect(() => {
    if (!API_BASE) return; // se não tiver BASE configurada, ignore SSE
    let es;
    try {
      es = new EventSource(`${API_BASE}/events`);
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          // exemplos de tópicos que podemos usar no back:
          // 'checklist_daily_submitted', 'checklist', 'checklist_diario'
          if (
            msg?.topic &&
            String(msg.topic).toLowerCase().includes('checklist') &&
            msg?.email?.toLowerCase() === String(user?.email || '').toLowerCase() &&
            msg?.date === hojeISO()
          ) {
            verificarPendencias();
          }
        } catch {}
      };
    } catch {
      // sem SSE, vida que segue (o fluxo funciona com a checagem inicial)
    }
    return () => {
      try { es && es.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, user?.email]);

  if (loading) {
    return <p style={{ padding: 20 }}>Verificando tarefas diárias...</p>;
  }

  // Se ainda há máquinas pendentes → TarefasDiariasPage
  if (temPendentes) {
    // Passa apenas as pendentes para a página de tarefas
    const dadosParaTarefas = {
      ...dadosTurno,
      maquinas: maquinasPendentes
    };
    return <TarefasDiariasPage user={user} dadosTurno={dadosParaTarefas} />;
  }

  // Caso contrário, vai para o layout principal (painel do operador)
  return <MainLayout user={user} />;
}
