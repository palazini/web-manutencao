import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import styles from './InicioTurnoPage.module.css';
import { useTranslation } from 'react-i18next';

const InicioTurnoPage = ({ user, onTurnoConfirmado }) => {
  const { t } = useTranslation();

  const [todasMaquinas, setTodasMaquinas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para a seleção do operador
  const [turnoSelecionado, setTurnoSelecionado] = useState('turno1');
  const [maquinasSelecionadas, setMaquinasSelecionadas] = useState([]);

  useEffect(() => {
    // Busca todas as máquinas cadastradas
    const q = query(collection(db, 'maquinas'), orderBy('nome'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTodasMaquinas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSelecaoMaquina = (maquinaId) => {
    setMaquinasSelecionadas(prev =>
      prev.includes(maquinaId) ? prev.filter(id => id !== maquinaId) : [...prev, maquinaId]
    );
  };

  const handleConfirmarTurno = () => {
    if (maquinasSelecionadas.length === 0) {
      alert(t('inicioTurno.alert.selectOne'));
      return;
    }
    onTurnoConfirmado({
      turno: turnoSelecionado,
      maquinas: maquinasSelecionadas,
    });
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>{t('inicioTurno.title')}</h1>
          <p>{t('inicioTurno.greeting', { name: user?.nome || '' })}</p>
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
