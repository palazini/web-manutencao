// src/pages/PlanosPreventivosPage.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, onSnapshot, orderBy, doc, deleteDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import styles from './PlanosPreventivosPage.module.css';
import { FiSend, FiTrash2 } from 'react-icons/fi';

const PlanosPreventivosPage = () => {
  const [planos, setPlanos] = useState([]);
  const [checklistTemplates, setChecklistTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [maquina, setMaquina] = useState('');
  const [descricao, setDescricao] = useState('');
  const [frequencia, setFrequencia] = useState(30);
  const [checklistId, setChecklistId] = useState('');

  const maquinasDisponiveis = ['TCN-12', 'TCN-17', 'TCN-18', 'TCN-19', 'TCN-20', 'CT-01', 'Compressor', 'Lapidadora'];

  useEffect(() => {
    const qPlanos = query(collection(db, 'planosPreventivos'), orderBy('maquina'));
    const unsubPlanos = onSnapshot(qPlanos, (snapshot) => {
      setPlanos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const qChecklists = query(collection(db, 'checklistTemplates'), orderBy('nome'));
    const unsubChecklists = onSnapshot(qChecklists, (snapshot) => {
      setChecklistTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubPlanos();
      unsubChecklists();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!maquina || !descricao || !frequencia || !checklistId) {
      toast.error("Preencha todos os campos, incluindo o checklist.");
      return;
    }
    const checklistSelecionado = checklistTemplates.find(c => c.id === checklistId);
    try {
      await addDoc(collection(db, 'planosPreventivos'), {
        maquina,
        descricao,
        frequencia: Number(frequencia),
        checklistId: checklistId,
        checklistNome: checklistSelecionado.nome,
        ativo: true,
        proximaData: null,
        dataUltimaManutencao: null,
      });
      toast.success("Plano de manutenção preventiva criado com sucesso!");
      setMaquina('');
      setDescricao('');
      setFrequencia(30);
      setChecklistId('');
    } catch (error) {
      toast.error("Não foi possível criar o plano.");
      console.error("Erro ao criar plano:", error);
    }
  };

  const handleGerarChamado = async (plano) => {
    if (!window.confirm(`Gerar chamado para a máquina ${plano.maquina}?`)) return;
    try {
      const checklistTemplateRef = doc(db, "checklistTemplates", plano.checklistId);
      const checklistTemplateDoc = await getDoc(checklistTemplateRef);
      if (!checklistTemplateDoc.exists()) {
        toast.error("Modelo de checklist não encontrado!");
        return;
      }
      const itensDoTemplate = checklistTemplateDoc.data().itens;
      const checklistParaSalvar = itensDoTemplate.map(itemTexto => ({ item: itemTexto, concluido: false }));

      await addDoc(collection(db, 'chamados'), {
        maquina: plano.maquina,
        descricao: `Manutenção preventiva: ${plano.descricao}`,
        status: "Aberto",
        tipo: "preventiva",
        planoId: plano.id,
        checklist: checklistParaSalvar,
        operadorNome: "Sistema (Plano Preventivo)",
        dataAbertura: serverTimestamp(),
        dataConclusao: null,
        manutentorId: null,
        manutentorNome: null,
        solucao: null,
        operadorId: 'sistema',
        operadorEmail: '',
      });
      toast.success("Chamado preventivo gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar chamado:", error);
      toast.error("Não foi possível gerar o chamado.");
    }
  };

  const handleExcluirPlano = async (planoId) => {
    if (!window.confirm("Tem certeza que deseja excluir este plano?")) return;
    try {
      await deleteDoc(doc(db, "planosPreventivos", planoId));
      toast.success("Plano excluído com sucesso.");
    } catch (error) {
      toast.error("Não foi possível excluir o plano.");
    }
  };

  const diffEmDias = (data1, data2) => {
    const diffTempo = data2.getTime() - data1.getTime();
    return Math.round(diffTempo / (1000 * 3600 * 24));
  };

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Planos de Manutenção Preventiva</h1>
      </header>
      <div style={{ padding: '20px' }}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Novo Plano Preventivo</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="checklist">Usar o Modelo de Checklist</label>
              <select id="checklist" value={checklistId} onChange={(e) => setChecklistId(e.target.value)} className={styles.select} required>
                <option value="" disabled>Selecione um modelo...</option>
                {checklistTemplates.map(cl => <option key={cl.id} value={cl.id}>{cl.nome}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="maquina">Máquina</label>
              <select id="maquina" value={maquina} onChange={(e) => setMaquina(e.target.value)} className={styles.select} required>
                <option value="" disabled>Selecione...</option>
                {maquinasDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="frequencia">Frequência (em dias)</label>
              <input type="number" id="frequencia" value={frequencia} onChange={(e) => setFrequencia(e.target.value)} className={styles.input} required min="1" />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="descricao">Descrição Curta do Plano</label>
              <input id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} className={styles.input} placeholder="Ex: Inspeção semanal de segurança" required />
            </div>
            <button type="submit" className={styles.button}>Criar Plano Preventivo</button>
          </form>
        </div>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Planos Preventivos Ativos</h2>
          {loading ? <p>Carregando...</p> : (
            <ul className={styles.planList}>
              {planos.map(plano => {
                const hoje = new Date();
                let diasParaProxima = '-';
                let corProxima = '';
                let diasDesdeUltima = '-';

                if (plano.proximaData) {
                  const proximaData = plano.proximaData.toDate();
                  diasParaProxima = diffEmDias(hoje, proximaData);
                  if (diasParaProxima <= 0) corProxima = styles.red;
                  else if (diasParaProxima <= 7) corProxima = styles.orange;
                  else corProxima = styles.green;
                }

                if (plano.dataUltimaManutencao) {
                  const ultimaData = plano.dataUltimaManutencao.toDate();
                  diasDesdeUltima = diffEmDias(ultimaData, hoje);
                }

                return (
                  <li key={plano.id} className={styles.planItem}>
                    <div className={styles.planInfo}>
                      <strong>{plano.maquina}</strong>
                      <span>{plano.descricao}</span>
                      <small>Checklist: {plano.checklistNome}</small>
                    </div>
                    <div className={styles.statusColumn}>
                      <h2 className={styles.statusValue}>{plano.frequencia}</h2>
                      <span className={styles.statusLabel}>F (dias)</span>
                    </div>
                    <div className={styles.statusColumn}>
                      <h2 className={styles.statusValue}>{diasDesdeUltima}</h2>
                      <span className={styles.statusLabel}>U (dias atrás)</span>
                    </div>
                    <div className={styles.statusColumn}>
                      <h2 className={`${styles.statusValue} ${corProxima}`}>
                        {diasParaProxima === '-' ? '-' : (diasParaProxima < 0 ? 'Vencido' : diasParaProxima)}
                      </h2>
                      <span className={styles.statusLabel}>P (dias)</span>
                    </div>
                    <div className={styles.planActions}>
                      <button onClick={() => handleGerarChamado(plano)} className={`${styles.actionButton} ${styles.generateButton}`} title="Gerar Chamado Agora">
                        <FiSend /> Gerar
                      </button>
                      <button onClick={() => handleExcluirPlano(plano.id)} className={`${styles.actionButton} ${styles.deleteButton}`} title="Excluir Plano">
                        <FiTrash2 /> Excluir
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default PlanosPreventivosPage;