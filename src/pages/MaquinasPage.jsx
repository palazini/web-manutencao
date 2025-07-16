// src/pages/MaquinasPage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import styles from './MaquinasPage.module.css';

const MaquinasPage = () => {
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Busca a coleção 'maquinas' que criamos, ordenando por nome
    const q = query(collection(db, 'maquinas'), orderBy('nome'));
    
    // Ouve as mudanças em tempo real
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const maquinasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMaquinas(maquinasData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar máquinas: ", error);
      setLoading(false);
    });

    // Limpa o ouvinte quando o componente é desmontado
    return () => unsubscribe();
  }, []);

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Painel de Máquinas</h1>
      </header>
      <div style={{ padding: '20px' }}>
        {loading ? (
          <p>Carregando máquinas...</p>
        ) : (
          <div className={styles.grid}>
            {maquinas.map(maquina => (
              // Futuramente, este link levará para a página de detalhes da máquina
              <Link to={`/maquinas/${maquina.id}`} key={maquina.id} className={styles.card}>
                <h2>{maquina.nome}</h2>
                <p>Status: Operacional</p> {/* Placeholder */}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default MaquinasPage;