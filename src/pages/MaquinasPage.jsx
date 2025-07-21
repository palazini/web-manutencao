// src/pages/MaquinasPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, where, addDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import styles from './MaquinasPage.module.css';
import Modal from '../components/Modal.jsx';
import { FiPlus } from 'react-icons/fi';

const MaquinasPage = () => {
  const [maquinas, setMaquinas] = useState([]);
  const [chamadosAtivos, setChamadosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nomeNovaMaquina, setNomeNovaMaquina] = useState('');

  useEffect(() => {
    const qMaquinas = query(collection(db, 'maquinas'), orderBy('nome'));
    const unsubMaquinas = onSnapshot(qMaquinas, (snapshot) => {
      setMaquinas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qChamados = query(collection(db, 'chamados'), where('status', 'in', ['Aberto', 'Em Andamento']));
    const unsubChamados = onSnapshot(qChamados, (snapshot) => {
      setChamadosAtivos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    
    return () => {
      unsubMaquinas();
      unsubChamados();
    };
  }, []);

  const maquinasComStatus = useMemo(() => {
    const statusPorMaquina = {};
    const prioridade = { corretiva: 3, preventiva: 2, preditiva: 1 };
    chamadosAtivos.forEach(chamado => {
      const tipo = chamado.tipo || 'corretiva';
      if (!statusPorMaquina[chamado.maquina] || prioridade[tipo] > prioridade[statusPorMaquina[chamado.maquina]]) {
        statusPorMaquina[chamado.maquina] = tipo;
      }
    });
    return maquinas.map(maquina => ({
      ...maquina,
      statusDestaque: statusPorMaquina[maquina.nome] || 'normal',
    }));
  }, [maquinas, chamadosAtivos]);

  const getStatusClass = (status) => {
    switch(status) {
      case 'corretiva': return styles.statusCorretiva;
      case 'preventiva': return styles.statusPreventiva;
      case 'preditiva': return styles.statusPreditiva;
      default: return styles.statusNormal;
    }
  };

  const handleCriarMaquina = async (e) => {
    e.preventDefault();
    if (nomeNovaMaquina.trim() === '') {
      toast.error("O nome da máquina não pode ser vazio.");
      return;
    }
    try {
      await addDoc(collection(db, 'maquinas'), {
        nome: nomeNovaMaquina,
        checklistDiario: [],
        operadoresPorTurno: {
          turno1: [],
          turno2: [],
        },
      });
      toast.success(`Máquina "${nomeNovaMaquina}" criada com sucesso!`);
      setNomeNovaMaquina('');
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Erro ao criar a máquina.");
      console.error(error);
    }
  };

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Painel de Máquinas</h1>
      </header>
      <div style={{ padding: '20px' }}>
        {loading ? (
          <p>Carregando máquinas...</p>
        ) : (
          <>
            <div className={styles.legendContainer}>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColorBox} ${styles.statusCorretiva}`}></div>
                <span>Corretiva (Urgente)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColorBox} ${styles.statusPreventiva}`}></div>
                <span>Preventiva (Checklist)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColorBox} ${styles.statusPreditiva}`}></div>
                <span>Preditiva (Agendada)</span>
              </div>
            </div>

            <div className={styles.grid}>
              {maquinasComStatus.map(maquina => (
                <Link 
                  to={`/maquinas/${maquina.id}`} 
                  key={maquina.id} 
                  className={`${styles.card} ${getStatusClass(maquina.statusDestaque)}`}
                >
                  <h2>{maquina.nome}</h2>
                  <p>Clique para exibir detalhes</p>
                </Link>
              ))}

              {/* CARD DE ADICIONAR SIMPLIFICADO */}
              <div 
                className={`${styles.card} ${styles.addCard}`}
                onClick={() => setIsModalOpen(true)}
              >
                <FiPlus className={styles.addIcon} />
              </div>
            </div>
          </>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="Criar Nova Máquina"
      >
        <form onSubmit={handleCriarMaquina}>
          <div style={{marginBottom: '15px'}}>
            <label htmlFor="nome-maquina" style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>Nome da Máquina</label>
            <input 
              id="nome-maquina"
              type="text"
              value={nomeNovaMaquina}
              onChange={(e) => setNomeNovaMaquina(e.target.value)}
              style={{width: '100%', padding: '8px', boxSizing: 'border-box'}}
              required
            />
          </div>
          <button type="submit" style={{padding: '10px 15px', border: 'none', borderRadius: '4px', backgroundColor: '#4B70E2', color: 'white', cursor: 'pointer'}}>
            Salvar Máquina
          </button>
        </form>
      </Modal>
    </>
  );
};

export default MaquinasPage;