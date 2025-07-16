// src/pages/EditarPlanoPreventivoPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import styles from './EditarPlanoPreventivoPage.module.css';

const EditarPlanoPreventivoPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Estados para os campos do formulário
  const [descricao, setDescricao] = useState('');
  const [frequencia, setFrequencia] = useState(30);
  const [checklistId, setChecklistId] = useState('');
  const [checklistTemplates, setChecklistTemplates] = useState([]); // Para o seletor
  const [maquinaNome, setMaquinaNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Busca os dados do plano e a lista de checklists
  useEffect(() => {
    const fetchPlano = async () => {
      const docRef = doc(db, 'planosPreventivos', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setDescricao(data.descricao);
        setFrequencia(data.frequencia);
        setChecklistId(data.checklistId);
        setMaquinaNome(data.maquina);
      } else {
        toast.error("Plano Preventivo não encontrado.");
        navigate(-1);
      }
      setLoading(false);
    };

    // Ouve em tempo real as mudanças nos templates de checklist
    const qChecklists = query(collection(db, 'checklistTemplates'));
    const unsubscribe = onSnapshot(qChecklists, (snapshot) => {
      setChecklistTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    fetchPlano();

    return () => unsubscribe(); // Limpa o ouvinte dos checklists
  }, [id, navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    const docRef = doc(db, 'planosPreventivos', id);
    const checklistSelecionado = checklistTemplates.find(c => c.id === checklistId);

    try {
      await updateDoc(docRef, {
        descricao: descricao,
        frequencia: Number(frequencia),
        checklistId: checklistId,
        checklistNome: checklistSelecionado.nome,
      });
      toast.success("Plano Preventivo atualizado com sucesso!");
      navigate(-1); // Volta para a página anterior
    } catch (error) {
      toast.error("Não foi possível atualizar o plano.");
      console.error("Erro ao atualizar o plano: ", error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return <p style={{ padding: '20px' }}>Carregando plano...</p>;
  }

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Editar Plano Preventivo</h1>
        <p style={{ margin: 0, color: '#555' }}>Máquina: {maquinaNome}</p>
      </header>
      <div style={{ padding: '20px' }}>
        <div className={styles.card}>
          <form onSubmit={handleUpdate}>
            <div className={styles.formGroup}>
              <label htmlFor="descricao">Descrição da Tarefa</label>
              <input
                id="descricao"
                className={styles.input}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="frequencia">Frequência (em dias)</label>
              <input
                type="number"
                id="frequencia"
                className={styles.input}
                value={frequencia}
                onChange={(e) => setFrequencia(e.target.value)}
                required
                min="1"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="checklist">Checklist a ser usado</label>
              <select
                id="checklist"
                className={styles.select}
                value={checklistId}
                onChange={(e) => setChecklistId(e.target.value)}
                required
              >
                <option value="" disabled>Selecione...</option>
                {checklistTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>
            <button type="submit" className={styles.button} disabled={isUpdating}>
              {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default EditarPlanoPreventivoPage;