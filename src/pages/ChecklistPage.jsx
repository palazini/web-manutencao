// src/pages/ChecklistPage.jsx

import React, { useState } from 'react';
import styles from './ChecklistPage.module.css';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

// Lista de perguntas hardcoded por enquanto. Poderia vir do Firestore no futuro.
const perguntasChecklist = [
  "1. A área de trabalho está limpa e organizada?",
  "2. Os Equipamentos de Proteção Individual (EPIs) estão em bom estado?",
  "3. As saídas de emergência estão desobstruídas?",
  "4. As ferramentas foram inspecionadas antes do uso?"
];

const ChecklistPage = ({ user, onChecklistSubmit }) => {
  // Guarda as respostas. O objeto inicial já tem todas as perguntas com 'nao'
  const [respostas, setRespostas] = useState(
    perguntasChecklist.reduce((acc, pergunta) => {
      acc[pergunta] = 'nao';
      return acc;
    }, {})
  );

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
      });
      toast.success("Checklist enviado com sucesso. Tenha um ótimo dia!");
      onChecklistSubmit(); // Avisa o App.jsx que o checklist foi concluído
    } catch (error) {
      console.error("Erro ao enviar checklist:", error);
      toast.error("Não foi possível enviar o checklist.");
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Checklist Diário de Segurança</h1>
          <p>Olá, {user.nome}. Por favor, complete o checklist para iniciar seu dia.</p>
        </div>
        <div>
          {perguntasChecklist.map((pergunta, index) => (
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
          ))}
        </div>
        <div className={styles.buttonContainer}>
          <button onClick={handleSubmit} className={styles.submitButton}>
            Enviar Checklist e Iniciar Trabalho
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChecklistPage;