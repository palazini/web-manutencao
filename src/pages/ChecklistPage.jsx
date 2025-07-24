// src/pages/ChecklistPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Importar useParams e useNavigate
import styles from './ChecklistPage.module.css';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const ChecklistPage = ({ user }) => {
  const { maquinaId } = useParams(); // Pega o ID da máquina da URL
  const navigate = useNavigate();

  const [maquina, setMaquina] = useState(null);
  const [perguntas, setPerguntas] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChecklistDaMaquina = async () => {
      if (!maquinaId) return;
      const maquinaRef = doc(db, 'maquinas', maquinaId);
      const maquinaSnap = await getDoc(maquinaRef);

      if (maquinaSnap.exists()) {
        const maquinaData = maquinaSnap.data();
        setMaquina(maquinaData);
        setPerguntas(maquinaData.checklistDiario || []);

        // Inicializa as respostas
        const respostasIniciais = {};
        if (maquinaData.checklistDiario) {
          maquinaData.checklistDiario.forEach(p => {
            respostasIniciais[p] = 'sim';
          });
        }
        setRespostas(respostasIniciais);
      } else {
        toast.error("Máquina não encontrada.");
      }
      setLoading(false);
    };

    fetchChecklistDaMaquina();
  }, [maquinaId]);

  const handleRespostaChange = (pergunta, resposta) => {
    setRespostas(prev => ({ ...prev, [pergunta]: resposta }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    let chamadosGerados = 0;
    try {
      for (const pergunta in respostas) {
        if (respostas[pergunta] === 'nao') {
          chamadosGerados++;
          await addDoc(collection(db, 'chamados'), {
            maquina: maquina.nome,
            descricao: `Item do checklist diário reportado como "Não": "${pergunta}"`,
            status: "Aberto",
            tipo: "preditiva",
            operadorId: user.uid,
            operadorNome: user.nome,
            dataAbertura: serverTimestamp(),
          });
        }
      }
      await addDoc(collection(db, 'checklistSubmissions'), {
        operadorId: user.uid,
        operadorNome: user.nome,
        maquinaId: maquinaId,
        maquinaNome: maquina.nome,
        dataSubmissao: serverTimestamp(),
        respostas: respostas,
      });
      toast.success("Checklist enviado com sucesso!");
      navigate('/'); // Volta para a lista de tarefas
    } catch (error) {
      toast.error("Não foi possível enviar o checklist.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p>Carregando checklist...</p>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Checklist Diário: {maquina?.nome}</h1>
          <p>Olá, {user.nome}. Por favor, complete o checklist para iniciar seu dia.</p>
        </div>
        <div>
          {perguntas.length > 0 ? (
            perguntas.map((pergunta, index) => (
              <div key={index} className={styles.checklistItem}>
                <span>{pergunta}</span>
                <div>
                  <input type="radio" id={`sim-${index}`} name={`pergunta-${index}`} onChange={() => handleRespostaChange(pergunta, 'sim')} checked={respostas[pergunta] === 'sim'} />
                  <label htmlFor={`sim-${index}`} style={{margin: '0 10px 0 5px'}}>Sim</label>
                  <input type="radio" id={`nao-${index}`} name={`pergunta-${index}`} onChange={() => handleRespostaChange(pergunta, 'nao')} checked={respostas[pergunta] === 'nao'} />
                  <label htmlFor={`nao-${index}`} style={{marginLeft: '5px'}}>Não</label>
                </div>
              </div>
            ))
          ) : (
            <p>Nenhum checklist diário configurado para esta máquina.</p>
          )}
        </div>
        <div className={styles.buttonContainer}>
          <button onClick={handleSubmit} className={styles.submitButton} disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar Checklist'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChecklistPage;