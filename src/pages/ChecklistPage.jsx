// src/pages/ChecklistPage.jsx

import React, { useState, useEffect } from 'react';
import styles from './ChecklistPage.module.css';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const ChecklistPage = ({ user, onChecklistSubmit }) => {
  // O estado das perguntas agora começa vazio
  const [perguntas, setPerguntas] = useState([]);
  const [checklistNome, setChecklistNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [respostas, setRespostas] = useState({});

  // Este useEffect agora busca as perguntas do Firestore
  useEffect(() => {
    const fetchPerguntas = async () => {
      if (!user || !user.checklistTemplateId) {
        console.error("Operador sem checklist atribuído!");
        toast.error("Nenhum checklist foi atribuído a você. Contate o gestor.");
        setLoading(false);
        return;
      }

      const templateRef = doc(db, "dailyChecklistTemplates", user.checklistTemplateId);
      const templateSnap = await getDoc(templateRef);

      if (templateSnap.exists()) {
        const templateData = templateSnap.data();
        setPerguntas(templateData.itens || []);
        setChecklistNome(templateData.nome || 'Checklist Diário');

        // Inicializa o estado de respostas com 'nao' para cada pergunta carregada
        const respostasIniciais = {};
        if (templateData.itens) {
          templateData.itens.forEach(p => {
            respostasIniciais[p] = 'nao';
          });
        }
        setRespostas(respostasIniciais);
      } else {
        toast.error("Não foi possível carregar o seu checklist.");
        console.error("Modelo de checklist não encontrado com o ID:", user.checklistTemplateId);
      }
      setLoading(false);
    };

    fetchPerguntas();
  }, [user]);

  const handleRespostaChange = (pergunta, resposta) => {
    setRespostas(prev => ({ ...prev, [pergunta]: resposta }));
  };

  const handleSubmit = async () => {
    try {
      await addDoc(collection(db, 'checklistSubmissions'), {
        operadorId: user.uid,
        operadorNome: user.nome,
        dataSubmissao: serverTimestamp(),
        respostas: respostas,
        checklistNome: checklistNome, // Salva o nome do checklist preenchido
      });
      toast.success("Checklist enviado com sucesso. Tenha um ótimo dia!");
      onChecklistSubmit();
    } catch (error) {
      console.error("Erro ao enviar checklist:", error);
      toast.error("Não foi possível enviar o checklist.");
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Carregando seu checklist...</div>;
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>{checklistNome}</h1>
          <p>Olá, {user.nome}. Por favor, complete o checklist para iniciar seu dia.</p>
        </div>
        <div>
          {perguntas.length > 0 ? (
            perguntas.map((pergunta, index) => (
              <div key={index} className={styles.checklistItem}>
                <span>{pergunta}</span>
                <div>
                  <input 
                    type="radio" 
                    id={`sim-${index}`} 
                    name={`pergunta-${index}`} 
                    onChange={() => handleRespostaChange(pergunta, 'sim')}
                    checked={respostas[pergunta] === 'sim'}
                  />
                  <label htmlFor={`sim-${index}`} style={{margin: '0 10px 0 5px'}}>Sim</label>
                  <input 
                    type="radio" 
                    id={`nao-${index}`} 
                    name={`pergunta-${index}`} 
                    onChange={() => handleRespostaChange(pergunta, 'nao')}
                    checked={respostas[pergunta] === 'nao'}
                  />
                  <label htmlFor={`nao-${index}`} style={{marginLeft: '5px'}}>Não</label>
                </div>
              </div>
            ))
          ) : (
            <p>Não há itens neste checklist. Contate o gestor.</p>
          )}
        </div>
        <div className={styles.buttonContainer}>
          <button onClick={handleSubmit} className={styles.submitButton} disabled={perguntas.length === 0}>
            Enviar Checklist e Iniciar Trabalho
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChecklistPage;