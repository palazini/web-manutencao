// src/pages/EditarChecklistPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import styles from './EditarChecklistPage.module.css'; // Usando seu próprio CSS

const EditarChecklistPage = () => {
  const { id } = useParams(); // Pega o ID da URL
  const navigate = useNavigate(); // Para redirecionar após salvar

  const [nomeChecklist, setNomeChecklist] = useState('');
  const [itensChecklist, setItensChecklist] = useState('');
  const [loading, setLoading] = useState(true);

  // Busca os dados do checklist ao carregar a página
  useEffect(() => {
    const fetchChecklist = async () => {
      const docRef = doc(db, 'checklistTemplates', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setNomeChecklist(data.nome);
        // Converte o array de itens de volta para um texto com quebra de linha
        setItensChecklist(data.itens.join('\n'));
      } else {
        toast.error("Modelo de checklist não encontrado.");
        navigate('/gerenciar-checklists');
      }
      setLoading(false);
    };
    fetchChecklist();
  }, [id, navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    const itensArray = itensChecklist.split('\n').filter(item => item.trim() !== '');
    if (!nomeChecklist || itensArray.length === 0) {
      toast.error("O nome e os itens não podem ficar vazios.");
      return;
    }

    const docRef = doc(db, 'checklistTemplates', id);
    try {
      await updateDoc(docRef, {
        nome: nomeChecklist,
        itens: itensArray,
      });
      toast.success("Checklist atualizado com sucesso!");
      navigate('/gerenciar-checklists'); // Volta para a lista
    } catch (error) {
      toast.error("Não foi possível atualizar o checklist.");
      console.error("Erro ao atualizar:", error);
    }
  };

  if (loading) return <p>Carregando checklist...</p>;

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Editar Modelo de Checklist</h1>
      </header>
      <div style={{ padding: '20px' }}>
        <div className={styles.card}>
          <form onSubmit={handleUpdate}>
            <div className={styles.formGroup}>
              <label htmlFor="nome-checklist">Nome do Checklist</label>
              <input id="nome-checklist" className={styles.input} value={nomeChecklist} onChange={(e) => setNomeChecklist(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="itens-checklist">Itens do Checklist (um por linha)</label>
              <textarea id="itens-checklist" className={styles.textarea} value={itensChecklist} onChange={(e) => setItensChecklist(e.target.value)} required />
            </div>
            <button type="submit" className={styles.button}>Salvar Alterações</button>
          </form>
        </div>
      </div>
    </>
  );
};

export default EditarChecklistPage;