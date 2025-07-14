// src/pages/RelatorioChecklistPage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import styles from './RelatorioChecklistPage.module.css';
import { FiCheckCircle, FiXCircle, FiEdit, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';

const RelatorioChecklistPage = () => {
  const [relatorioOperadores, setRelatorioOperadores] = useState([]);
  const [checklistTemplates, setChecklistTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para o formulário de criação de checklist
  const [nomeNovoChecklist, setNomeNovoChecklist] = useState('');
  const [itensNovoChecklist, setItensNovoChecklist] = useState('');

  useEffect(() => {
    // Ouve em tempo real as mudanças nos operadores
    const qOperadores = query(collection(db, 'usuarios'), where('role', '==', 'operador'));
    const unsubOperadores = onSnapshot(qOperadores, (operadoresSnapshot) => {
      const listaOperadores = operadoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Ouve em tempo real as mudanças nas submissões de hoje
      const hoje = new Date();
      const inicioDoDia = new Date(hoje.setHours(0, 0, 0, 0));
      const qSubmissoes = query(collection(db, 'checklistSubmissions'), where('dataSubmissao', '>=', inicioDoDia));
      
      const unsubSubmissoes = onSnapshot(qSubmissoes, (submissoesSnapshot) => {
        const idsOperadoresQueEnviaram = new Set(submissoesSnapshot.docs.map(doc => doc.data().operadorId));
        
        const relatorioFinal = listaOperadores.map(operador => ({
          ...operador,
          enviouHoje: idsOperadoresQueEnviaram.has(operador.id)
        }));
        setRelatorioOperadores(relatorioFinal);
        setLoading(false);
      });

      return () => unsubSubmissoes();
    });

    // Ouve em tempo real as mudanças nos templates de checklist
    const qTemplates = query(collection(db, 'dailyChecklistTemplates'));
    const unsubTemplates = onSnapshot(qTemplates, (snapshot) => {
      setChecklistTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubOperadores();
      unsubTemplates();
    };
  }, []);

  const handleCriarChecklist = async (e) => {
    e.preventDefault();
    const itensArray = itensNovoChecklist.split('\n').filter(item => item.trim() !== '');
    if (!nomeNovoChecklist || itensArray.length === 0) {
      toast.error("Preencha o nome e pelo menos um item.");
      return;
    }
    try {
      await addDoc(collection(db, 'dailyChecklistTemplates'), { nome: nomeNovoChecklist, itens: itensArray });
      toast.success("Modelo de checklist criado!");
      setNomeNovoChecklist('');
      setItensNovoChecklist('');
    } catch (error) {
      toast.error("Erro ao criar modelo.");
    }
  };

  const handleAtribuirChecklist = async (operadorId, checklistId) => {
    const userRef = doc(db, 'usuarios', operadorId);
    try {
      await updateDoc(userRef, { checklistTemplateId: checklistId });
      toast.success("Checklist atribuído com sucesso!");
    } catch (error) {
      toast.error("Erro ao atribuir checklist.");
    }
  };

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Checklists de Colaboradores</h1>
      </header>
      <div style={{ padding: '20px' }}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Gerenciar Modelos de Checklist Diário</h2>
          <form onSubmit={handleCriarChecklist}>
            <div className={styles.formGroup}>
              <label htmlFor="nome-checklist">Nome do Novo Modelo</label>
              {/* Adicionado placeholder aqui */}
              <input 
                id="nome-checklist" 
                className={styles.input} 
                value={nomeNovoChecklist} 
                onChange={(e) => setNomeNovoChecklist(e.target.value)} 
                placeholder="Ex: Checklist de Segurança (Abertura de Turno)"
                required 
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="itens-checklist">Itens (um por linha)</label>
              {/* Adicionado placeholder aqui */}
              <textarea 
                id="itens-checklist" 
                className={styles.textarea} 
                value={itensNovoChecklist} 
                onChange={(e) => setItensNovoChecklist(e.target.value)} 
                placeholder="Verificar EPIs&#10;Inspecionar área de trabalho&#10;Checar saídas de emergência"
                required 
              />
            </div>
            <button type="submit" className={styles.button}>Salvar Novo Modelo</button>
          </form>
          <hr style={{margin: '20px 0'}}/>
          <h3>Modelos Existentes</h3>
          <ul className={styles.checklistTemplatesList}>
            {checklistTemplates.map(cl => (
              <Link to={`editar-checklist-diario/${cl.id}`} key={cl.id} className={styles.templateLink}>
                <li className={styles.templateItem}>
                  {cl.nome}
                </li>
              </Link>
            ))}
          </ul>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Relatório e Atribuição Diária</h2>
          {loading ? <p>Gerando relatório...</p> : (
            <ul className={styles.userList}>
              {relatorioOperadores.map(op => (
                <Link to={`historico-operador/${op.id}`} key={op.id} className={styles.userLink}>
                  <li className={styles.userItem}>
                    <span className={styles.userName}>{op.nome}</span>
                    <div className={op.enviouHoje ? `${styles.status} ${styles.completed}` : `${styles.status} ${styles.pending}`}>
                      {op.enviouHoje ? <FiCheckCircle /> : <FiXCircle />}
                      <span>{op.enviouHoje ? 'Entregue' : 'Pendente'}</span>
                    </div>
                    <select 
                      value={op.checklistTemplateId || ''}
                      onChange={(e) => handleAtribuirChecklist(op.id, e.target.value)}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      className={styles.select}
                    >
                      <option value="" disabled>Atribuir um checklist...</option>
                      {checklistTemplates.map(cl => (
                        <option key={cl.id} value={cl.id}>{cl.nome}</option>
                      ))}
                    </select>
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

export default RelatorioChecklistPage;
