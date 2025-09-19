// src/pages/TarefasDiariasPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './TarefasDiariasPage.module.css';
import { useTranslation } from 'react-i18next';
import { listarMaquinas, listarSubmissoesDiarias } from '../services/apiClient';

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TarefasDiariasPage({ user, dadosTurno }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tarefasPendentes, setTarefasPendentes] = useState([]);

  const operadorEmail = useMemo(() => String(user?.email || '').toLowerCase(), [user?.email]);
  const maquinasSelecionadas = useMemo(
    () => (Array.isArray(dadosTurno?.maquinas) ? dadosTurno.maquinas : []),
    [dadosTurno?.maquinas]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);

        // 1) Carrega todas as máquinas e cria mapa id->obj (para nome etc.)
        const todas = await listarMaquinas().catch(() => []);
        const mapById = new Map((todas || []).map((m) => [m.id, m]));

        // 2) Submissões do dia para este operador
        const submissoes = await listarSubmissoesDiarias({
          operadorEmail,
          date: hojeISO(),
        }).catch(() => []);

        // normaliza campo de máquina nas submissões (ideal: maquina_id vindo do backend)
        const feitosSet = new Set(
          (submissoes || []).map((s) => s.maquina_id || s.maquinaId || s.maquina || null)
        );

        // 3) Filtra as selecionadas que ainda não foram submetidas
        const pendentesIds = maquinasSelecionadas.filter((id) => !feitosSet.has(id));

        const pendentesObjs = pendentesIds
          .map((id) => mapById.get(id))
          .filter(Boolean)
          .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt'));

        if (!alive) return;
        setTarefasPendentes(pendentesObjs);

        // Sincroniza localStorage (mantém ultimaMaquina se ainda pendente)
        try {
          const raw = localStorage.getItem('dadosTurno');
          if (raw) {
            const st = JSON.parse(raw);
            if (st?.dataISO === hojeISO() && st?.operadorEmail?.toLowerCase() === operadorEmail) {
              const ultimaAindaPendente = pendentesIds.includes(st?.ultimaMaquina);
              const novo = {
                ...st,
                maquinasSelecionadas: Array.from(new Set([...(st.maquinasSelecionadas || []), ...maquinasSelecionadas])),
                ultimaMaquina: ultimaAindaPendente ? st.ultimaMaquina : null,
              };
              localStorage.setItem('dadosTurno', JSON.stringify(novo));
            }
          }
        } catch {}
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [operadorEmail, maquinasSelecionadas.join('|')]);

  const irParaChecklist = (maquina) => {
    // grava ultimaMaquina no estado do dia
    try {
      const raw = localStorage.getItem('dadosTurno');
      const st = raw ? JSON.parse(raw) : {};
      const novo = {
        ...st,
        dataISO: hojeISO(),
        operadorEmail,
        ultimaMaquina: maquina.id,
        // garante que a máquina clicada está na lista (união)
        maquinasSelecionadas: Array.from(
          new Set([...(st?.maquinasSelecionadas || []), ...maquinasSelecionadas, maquina.id])
        ),
      };
      localStorage.setItem('dadosTurno', JSON.stringify(novo));
    } catch {}

    navigate(`/checklist/${maquina.id}`);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('authUser');
      localStorage.removeItem('dadosTurno');
    } catch {}
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <h1>{t('tarefasDiarias.title')}</h1>
        <p>{t('tarefasDiarias.greeting', { name: user?.nome || '' })}</p>
        <button
          type="button"
          className={styles.logoutBtn}
          onClick={handleLogout}
          title={t('common.logout', 'Sair')}
        >
          {t('common.logout', 'Sair')}
        </button>
      </header>

      {loading && <p>{t('tarefasDiarias.checking')}</p>}

      {!loading && tarefasPendentes.length === 0 && (
        <p>{t('tarefasDiarias.allDone')}</p>
      )}

      {!loading && tarefasPendentes.length > 0 && (
        <ul className={styles.taskList}>
          {tarefasPendentes.map((maquina) => (
            <li
              key={maquina.id}
              className={styles.taskItem}
              onClick={() => irParaChecklist(maquina)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' ? irParaChecklist(maquina) : null)}
            >
              <div className={styles.taskInfo}>
                <strong>{maquina.nome}</strong>
              </div>
              <span>{t('tarefasDiarias.fillChecklist')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
