// src/pages/InicioTurnoPage.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import styles from './InicioTurnoPage.module.css';

const InicioTurnoPage = ({ user, onTurnoConfirmado }) => {
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
    // Lógica para adicionar ou remover uma máquina da lista de selecionadas
    setMaquinasSelecionadas(prev => {
      if (prev.includes(maquinaId)) {
        return prev.filter(id => id !== maquinaId);
      } else {
        return [...prev, maquinaId];
      }
    });
  };

  const handleConfirmarTurno = () => {
    if (maquinasSelecionadas.length === 0) {
      alert("Por favor, selecione pelo menos uma máquina.");
      return;
    }
    // Envia os dados da seleção para o componente App
    onTurnoConfirmado({
      turno: turnoSelecionado,
      maquinas: maquinasSelecionadas,
    });
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Início de Turno</h1>
          <p>Olá, {user.nome}. Por favor, informe seu turno e as máquinas em que irá trabalhar hoje.</p>
        </div>

        {loading ? <p>Carregando...</p> : (
          <div>
            <div className={styles.formGroup}>
              <label htmlFor="turno">Seu Turno</label>
              <select 
                id="turno" 
                className={styles.select}
                value={turnoSelecionado}
                onChange={(e) => setTurnoSelecionado(e.target.value)}
              >
                <option value="turno1">1º Turno (05:30 - 15:18)</option>
                <option value="turno2">2º Turno (15:18 - 00:48)</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Máquinas sob sua responsabilidade hoje (selecione uma ou mais)</label>
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
              Confirmar e Iniciar Checklists
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InicioTurnoPage;