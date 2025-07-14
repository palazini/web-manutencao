import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, onSnapshot, doc, deleteDoc, serverTimestamp, orderBy, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import styles from './PlanosPreditivosPage.module.css';
import { FiSend, FiTrash2 } from 'react-icons/fi';

const PlanosPreditivosPage = () => {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados do formulário
  const [maquina, setMaquina] = useState('');
  const [descricao, setDescricao] = useState('');
  const [frequencia, setFrequencia] = useState(30);

  const maquinasDisponiveis = ['TCN-12', 'TCN-17', 'TCN-18', 'TCN-19', 'TCN-20', 'CT-01', 'Compressor', 'Fresadora'];

  // Busca os planos existentes em tempo real
  useEffect(() => {
    const q = query(collection(db, 'planosPreditivos'), orderBy('maquina'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const planosData = [];
      querySnapshot.forEach((doc) => {
        planosData.push({ id: doc.id, ...doc.data() });
      });
      setPlanos(planosData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Função para criar um NOVO plano (do formulário)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!maquina || !descricao || !frequencia) {
      toast.error("Preencha todos os campos do plano.");
      return;
    }

    try {
      await addDoc(collection(db, 'planosPreditivos'), {
        maquina,
        descricao,
        frequencia: Number(frequencia),
        proximaData: null,
        dataUltimaManutencao: null,
        ativo: true,
      });

      toast.success("Plano de manutenção criado com sucesso!");
      setMaquina('');
      setDescricao('');
      setFrequencia(30);

    } catch (error) {
      console.error("Erro ao criar plano: ", error);
      toast.error("Não foi possível criar o plano.");
    }
  };

  // Função para o botão "Gerar Chamado"
  const handleGerarChamado = async (plano) => {
    if (!window.confirm(`Tem certeza que deseja gerar um chamado preditivo para a máquina ${plano.maquina}?`)) {
      return;
    }
    try {
      await addDoc(collection(db, 'chamados'), {
        maquina: plano.maquina,
        descricao: `Manutenção Preditiva agendada: ${plano.descricao}`,
        status: "Aberto",
        tipo: "preditiva",
        planoId: plano.id,
        operadorNome: "Sistema (Plano Preditivo)",
        dataAbertura: serverTimestamp(),
        dataConclusao: null,
        manutentorId: null,
        manutentorNome: null,
        solucao: null,
        operadorId: 'sistema',
        operadorEmail: '',
      });
      toast.success("Chamado preditivo gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar chamado: ", error);
      toast.error("Não foi possível gerar o chamado.");
    }
  };

  // Função para o botão "Excluir"
  const handleExcluirPlano = async (planoId, planoDesc) => {
    if (!window.confirm(`Tem certeza que deseja excluir o plano "${planoDesc}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, "planosPreditivos", planoId));
      toast.success("Plano excluído com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir plano: ", error);
      toast.error("Não foi possível excluir o plano.");
    }
  };

  // Função para calcular a diferença de dias entre duas datas
  const diffEmDias = (data1, data2) => {
    const diffTempo = data2.getTime() - data1.getTime();
    return Math.round(diffTempo / (1000 * 3600 * 24));
  };

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>Planos de Manutenção Preditiva</h1>
      </header>
      <div style={{ padding: '20px' }}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Novo Plano</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formRow}>
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
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="descricao">Descrição da Tarefa</label>
              <input id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} className={styles.input} placeholder="Ex: Verificar óleo e filtros" required />
            </div>
            <button type="submit" className={styles.button}>Criar Plano</button>
          </form>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Planos Ativos</h2>
          {loading ? <p>Carregando...</p> : (
            <ul className={styles.planList}>
              {planos.length === 0 ? <p>Nenhum plano ativo cadastrado.</p> : null}
              {planos.map(plano => {
                const hoje = new Date();
                let diasParaProxima = '-';
                let corProxima = '';
                let diasDesdeUltima = '-';

                if (plano.proximaData) {
                  const proximaData = plano.proximaData.toDate();
                  diasParaProxima = diffEmDias(hoje, proximaData);
                  
                  if (diasParaProxima <= 0) {
                    corProxima = styles.red;
                  } else if (diasParaProxima <= 7) {
                    corProxima = styles.orange;
                  } else {
                    corProxima = styles.green;
                  }
                }

                if (plano.dataUltimaManutencao) {
                  const ultimaData = plano.dataUltimaManutencao.toDate();
                  diasDesdeUltima = diffEmDias(ultimaData, hoje);
                }

                return (
                  <li key={plano.id} className={styles.planItem}>
                    <div className={styles.planInfo}>
                      <strong>{plano.maquina}</strong>
                      <span className={styles.descricao}>{plano.descricao}</span>
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
                      <button onClick={() => handleExcluirPlano(plano.id, plano.descricao)} className={`${styles.actionButton} ${styles.deleteButton}`} title="Excluir Plano">
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

export default PlanosPreditivosPage;