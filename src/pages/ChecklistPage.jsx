// src/pages/ChecklistPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './ChecklistPage.module.css';
import { 
  collection, addDoc, serverTimestamp,
  doc, getDoc,
  query, where, onSnapshot, getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

const ChecklistPage = ({ user }) => {
  const { maquinaId } = useParams();
  const navigate = useNavigate();

  const [maquina, setMaquina] = useState(null);
  const [perguntas, setPerguntas] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [blockedItems, setBlockedItems] = useState({}); 
  const [loading, setLoading] = useState(true);

  // 1) Busca checklist da máquina
  useEffect(() => {
    if (!maquinaId) return;
    (async () => {
      const maquinaRef = doc(db, 'maquinas', maquinaId);
      const snap = await getDoc(maquinaRef);
      if (!snap.exists()) {
        toast.error("Máquina não encontrada.");
        setLoading(false);
        return;
      }
      const data = snap.data();
      setMaquina(data);
      const lista = data.checklistDiario || [];
      setPerguntas(lista);

      // inicializa todas as respostas em "sim"
      const iniciais = {};
      lista.forEach(item => { iniciais[item] = 'sim'; });
      setRespostas(iniciais);

      setLoading(false);
    })();
  }, [maquinaId]);

  // 2) Monitora em tempo real chamados abertos para esta máquina e constrói blockedItems
  useEffect(() => {
    if (!maquinaId) return;
    const q = query(
      collection(db, 'chamados'),
      where('maquinaId', '==', maquinaId),
      where('tipo', '==', 'preditiva'),
      where('status', 'in', ['Aberto','Em Andamento'])
    );
    const unsub = onSnapshot(q, snap => {
      const bloqueios = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        // data.item deve ser o texto exato da pergunta
        bloqueios[data.item] = doc.id;
      });
      setBlockedItems(bloqueios);
    });
    return () => unsub();
  }, [maquinaId]);

  const handleRespostaChange = (pergunta, valor) => {
    // se já existe bloqueio, não deixa mudar para "nao"
    if (valor === 'nao' && blockedItems[pergunta]) {
      toast(`⚠️ Este item já está reportado no chamado ${blockedItems[pergunta]}.`);
      return;
    }
    setRespostas(prev => ({ ...prev, [pergunta]: valor }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    let gerados = 0;
    try {
      for (const pergunta of perguntas) {
        if (respostas[pergunta] === 'nao') {
          // só cria se não houver bloqueio
          if (!blockedItems[pergunta]) {
            await addDoc(collection(db, 'chamados'), {
              maquina: maquina.nome,
              maquinaId,
              item: pergunta,
              descricao: `Item do checklist diário reportado como "Não": "${pergunta}"`,
              status: "Aberto",
              tipo: "preditiva",
              operadorId: user.uid,
              operadorNome: user.nome,
              dataAbertura: serverTimestamp(),
            });
            gerados++;
          }
        }
      }

      await addDoc(collection(db, 'checklistSubmissions'), {
        operadorId: user.uid,
        operadorNome: user.nome,
        maquinaId,
        maquinaNome: maquina.nome,
        dataSubmissao: serverTimestamp(),
        respostas
      });

      toast.success(`Checklist enviado! ${gerados} chamado(s) gerado(s).`);
      navigate('/');
    } catch (err) {
      console.error(err);
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
          <h1>Checklist Diário: {maquina.nome}</h1>
          <p>Olá, {user.nome}. Complete o checklist abaixo:</p>
        </div>

        {perguntas.length === 0 && <p>Nenhum checklist configurado.</p>}
        {perguntas.map((pergunta, i) => {
          const isBlocked = Boolean(blockedItems[pergunta]);
          return (
            <div key={i} className={styles.checklistItem}>
              <span>{pergunta}</span>
              <div>
                <input
                  type="radio"
                  id={`sim-${i}`}
                  name={`item-${i}`}
                  checked={respostas[pergunta] === 'sim'}
                  onChange={() => handleRespostaChange(pergunta, 'sim')}
                />
                <label htmlFor={`sim-${i}`}>Sim</label>

                <input
                  type="radio"
                  id={`nao-${i}`}
                  name={`item-${i}`}
                  checked={respostas[pergunta] === 'nao'}
                  disabled={isBlocked}
                  onChange={() => handleRespostaChange(pergunta, 'nao')}
                  style={{ marginLeft: '1rem' }}
                />
                <label htmlFor={`nao-${i}`}>Não</label>

                {isBlocked && (
                  <small style={{ marginLeft: '0.5rem', color: '#c00' }}>
                    Já reportado no chamado {blockedItems[pergunta]}
                  </small>
                )}
              </div>
            </div>
          );
        })}

        <div className={styles.buttonContainer}>
          <button
            onClick={handleSubmit}
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Enviando...' : 'Enviar Checklist'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChecklistPage;
