// src/pages/GerenciarChecklistsPage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, query, onSnapshot, orderBy, doc, deleteDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import styles from './GerenciarChecklistsPage.module.css';
import { FiEdit, FiTrash2 } from 'react-icons/fi';

const GerenciarChecklistsPage = () => {
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nomeChecklist, setNomeChecklist] = useState('');
  const [itensChecklist, setItensChecklist] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'checklistTemplates'), orderBy('nome'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChecklists(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const itensArray = itensChecklist.split('\n').filter(item => item.trim() !== '');
    if (!nomeChecklist || itensArray.length === 0) {
      toast.error("Por favor, preencha o nome e pelo menos um item do checklist.");
      return;
    }

    try {
      await addDoc(collection(db, 'checklistTemplates'), {
        nome: nomeChecklist,
        itens: itensArray,
      });
      toast.success("Modelo de checklist criado com sucesso!");
      setNomeChecklist('');
      setItensChecklist('');
    } catch (error) {
      console.error("Erro ao criar checklist: ", error);
      toast.error("Não foi possível criar o modelo de checklist.");
    }
  };

  const handleExcluirChecklist = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este modelo de checklist?")) {
        try {
            await deleteDoc(doc(db, "checklistTemplates", id));
            toast.success("Modelo de checklist excluído com sucesso.");
        } catch (error) {
            toast.error("Erro ao excluir o modelo.");
        }
    }
  };

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Checklists de Tarefas de Manutenção</h1>
      </header>
      <div style={{ padding: '20px' }}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Criar Novo Modelo</h2>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="nome-checklist">Nome do Checklist</label>
              <input id="nome-checklist" className={styles.input} value={nomeChecklist} onChange={(e) => setNomeChecklist(e.target.value)} placeholder="Ex: Checklist de Segurança da TCN-12" required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="itens-checklist">Itens do Checklist (um por linha)</label>
              <textarea id="itens-checklist" className={styles.textarea} value={itensChecklist} onChange={(e) => setItensChecklist(e.target.value)} placeholder="Verificar nível do óleo&#10;Limpar filtros de ar&#10;Inspecionar correias" required />
            </div>
            <button type="submit" className={styles.button}>Salvar Modelo</button>
          </form>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Modelos Existentes</h2>
          {loading ? <p>Carregando...</p> : (
            <ul className={styles.checklistList}>
              {checklists.map(cl => (
                // O Link envolve o <li> para tornar tudo clicável, mas a aparência é de card
                <Link to={`/editar-checklist/${cl.id}`} key={cl.id} className={styles.checklistItemLink}>
                  <li className={styles.checklistItem}>
                    <span className={styles.templateName}>{cl.nome}</span>
                    <div className={styles.actions}>
                      {/* O botão de editar é o próprio link, mas mantemos o ícone */}
                      <div className={styles.actionButton} title="Editar">
                        <FiEdit />
                      </div>
                      {/* Adicionamos stopPropagation para o botão de excluir não ativar o link */}
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleExcluirChecklist(cl.id); }} className={`${styles.actionButton} ${styles.deleteButton}`} title="Excluir">
                        <FiTrash2 />
                      </button>
                    </div>
                  </li>
                </Link>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default GerenciarChecklistsPage;
