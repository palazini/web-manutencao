// src/pages/InicioTurnoPage.jsx
import React, { useEffect, useState } from 'react';
import styles from './InicioTurnoPage.module.css';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

// API sem Firebase
import { listarMaquinas } from '../services/apiClient';

function hojeISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

const InicioTurnoPage = ({ user, onTurnoConfirmado }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [todasMaquinas, setTodasMaquinas] = useState([]);
  const [loading, setLoading] = useState(true);

  // seleção do operador
  const [turnoSelecionado, setTurnoSelecionado] = useState('turno1');
  const [maquinasSelecionadas, setMaquinasSelecionadas] = useState([]);

  // carrega máquinas pela nossa API e pré-carrega seleção do dia
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);

        const lista = await listarMaquinas(); // retorna [{id, nome, ...}]
        if (!alive) return;

        // ordena por nome (caso a API não ordene)
        const ordenada = [...lista].sort((a, b) =>
          String(a.nome || '').localeCompare(String(b.nome || ''), 'pt')
        );
        setTodasMaquinas(ordenada);

        // pré-carrega seleção do localStorage se for o mesmo dia e mesmo operador
        const raw = localStorage.getItem('dadosTurno');
        if (raw) {
          try {
            const st = JSON.parse(raw);
            if (
              st?.dataISO === hojeISO() &&
              st?.operadorEmail?.toLowerCase() === String(user?.email || '').toLowerCase()
            ) {
              setTurnoSelecionado(st.turno || 'turno1');
              // filtra IDs que ainda existem na lista atual de máquinas
              const validIds = new Set(ordenada.map(m => m.id));
              const selecionadas = (st.maquinasSelecionadas || []).filter(id => validIds.has(id));
              setMaquinasSelecionadas(selecionadas);
            }
          } catch {}
        }
      } catch (e) {
        console.error('Falha ao carregar máquinas:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.email]);

  const handleSelecaoMaquina = (maquinaId) => {
    setMaquinasSelecionadas(prev =>
      prev.includes(maquinaId)
        ? prev.filter(id => id !== maquinaId)
        : [...prev, maquinaId]
    );
  };

  const handleConfirmarTurno = () => {
    if (!maquinasSelecionadas.length) {
      alert(t('inicioTurno.alert.selectOne'));
      return;
    }

    const dataISO = hojeISO();
    const operadorEmail = String(user?.email || '').toLowerCase();

    // Lê estado anterior e mescla (evita “pular” checklist quando o operador adiciona máquinas depois)
    let anteriores = [];
    const raw = localStorage.getItem('dadosTurno');
    if (raw) {
      try {
        const st = JSON.parse(raw);
        if (st?.dataISO === dataISO && st?.operadorEmail?.toLowerCase() === operadorEmail) {
          anteriores = Array.isArray(st.maquinasSelecionadas) ? st.maquinasSelecionadas : [];
        }
      } catch {}
    }

    // União (sem duplicar)
    const merged = Array.from(new Set([...anteriores, ...maquinasSelecionadas]));

    const novoEstado = {
      dataISO,
      operadorEmail,
      turno: turnoSelecionado,
      maquinasSelecionadas: merged,
      ultimaMaquina: null, // será preenchida ao iniciar a primeira checklist
    };
    localStorage.setItem('dadosTurno', JSON.stringify(novoEstado));

    // devolve ao fluxo (OperatorFlow) a lista unida
    onTurnoConfirmado?.({
      turno: turnoSelecionado,
      maquinas: merged,
    });
  };

  // Botão de escape (logout)
  const handleLogout = () => {
    try {
      localStorage.removeItem('usuario');
      localStorage.removeItem('dadosTurno');
    } catch {}
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>{t('inicioTurno.title')}</h1>
          <p>{t('inicioTurno.greeting', { name: user?.nome || '' })}</p>

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

        {loading ? (
          <p>{t('inicioTurno.loading')}</p>
        ) : (
          <div>
            <div className={styles.formGroup}>
              <label htmlFor="turno">{t('inicioTurno.fields.shift')}</label>
              <select
                id="turno"
                className={styles.select}
                value={turnoSelecionado}
                onChange={(e) => setTurnoSelecionado(e.target.value)}
              >
                <option value="turno1">{t('inicioTurno.shifts.shift1')}</option>
                <option value="turno2">{t('inicioTurno.shifts.shift2')}</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>{t('inicioTurno.fields.machinesLabel')}</label>
              <div className={styles.machineList}>
                {todasMaquinas.map(maquina => (
                  <div key={maquina.id} className={styles.machineCheckbox}>
                    <input
                      type="checkbox"
                      id={maquina.id}
                      checked={maquinasSelecionadas.includes(maquina.id)}
                      onChange={() => handleSelecaoMaquina(maquina.id)}
                    />
                    <label htmlFor={maquina.id}>{maquina.nome}</label>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleConfirmarTurno} className={styles.button}>
              {t('inicioTurno.confirmBtn')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InicioTurnoPage;
