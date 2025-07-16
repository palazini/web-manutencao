import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, onSnapshot, collection, query, where, orderBy, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import styles from './MaquinaDetalhePage.module.css';
import { FiPlus, FiMinus, FiSend, FiEdit, FiTrash2 } from 'react-icons/fi';

const MaquinaDetalhePage = ({ user }) => {
  const { id } = useParams();
  const [maquina, setMaquina] = useState(null);
  const [chamados, setChamados] = useState([]);
  const [todosOperadores, setTodosOperadores] = useState([]);
  const [planosPreditivos, setPlanosPreditivos] = useState([]);
  const [planosPreventivos, setPlanosPreventivos] = useState([]);
  const [checklistTemplates, setChecklistTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('historico');

  // Formulário Preditivo
  const [freqPreditiva, setFreqPreditiva] = useState(30);
  const [descPreditiva, setDescPreditiva] = useState('');

  // Formulário Preventivo
  const [freqPreventiva, setFreqPreventiva] = useState(30);
  const [descPreventiva, setDescPreventiva] = useState('');
  const [checklistId, setChecklistId] = useState('');

  useEffect(() => {
    const maquinaDocRef = doc(db, 'maquinas', id);
    const unsubMaquina = onSnapshot(maquinaDocRef, (doc) => {
      if (doc.exists()) {
        const maquinaData = { id: doc.id, ...doc.data() };
        setMaquina(maquinaData);

        const chamadosQuery = query(collection(db, 'chamados'), where('maquina', '==', maquinaData.nome), orderBy('dataAbertura', 'desc'));
        const unsubChamados = onSnapshot(chamadosQuery, (snapshot) => setChamados(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
        
        const preditivosQuery = query(collection(db, 'planosPreditivos'), where('maquina', '==', maquinaData.nome));
        const unsubPreditivos = onSnapshot(preditivosQuery, (snapshot) => setPlanosPreditivos(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));

        const preventivosQuery = query(collection(db, 'planosPreventivos'), where('maquina', '==', maquinaData.nome));
        const unsubPreventivos = onSnapshot(preventivosQuery, (snapshot) => setPlanosPreventivos(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));

        setLoading(false);
        return () => { unsubChamados(); unsubPreditivos(); unsubPreventivos(); };
      } else {
        setMaquina(null); setLoading(false);
      }
    });

    const operadoresQuery = query(collection(db, 'usuarios'), where('role', '==', 'operador'));
    const unsubOperadores = onSnapshot(operadoresQuery, (snapshot) => setTodosOperadores(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const checklistsQuery = query(collection(db, 'checklistTemplates'));
    const unsubChecklists = onSnapshot(checklistsQuery, (snapshot) => setChecklistTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    return () => { unsubMaquina(); unsubOperadores(); unsubChecklists(); };
  }, [id]);
  
  const { operadoresAtribuidos, operadoresDisponiveis } = useMemo(() => {
    if (!maquina || !todosOperadores.length) return { operadoresAtribuidos: [], operadoresDisponiveis: [] };
    const idsAtribuidos = new Set(maquina.operadoresResponsaveis || []);
    const atribuidos = todosOperadores.filter(op => idsAtribuidos.has(op.id));
    const disponiveis = todosOperadores.filter(op => !idsAtribuidos.has(op.id));
    return { operadoresAtribuidos: atribuidos, operadoresDisponiveis: disponiveis };
  }, [maquina, todosOperadores]);

  const handleAtribuirOperador = async (operadorId) => {
    const maquinaRef = doc(db, 'maquinas', id);
    await updateDoc(maquinaRef, { operadoresResponsaveis: arrayUnion(operadorId) });
  };
  const handleRemoverOperador = async (operadorId) => {
    const maquinaRef = doc(db, 'maquinas', id);
    await updateDoc(maquinaRef, { operadoresResponsaveis: arrayRemove(operadorId) });
  };

  const handleCriarPlanoPreditivo = async (e) => {
    e.preventDefault();
    if (!descPreditiva) return toast.error('A descrição é obrigatória.');
    try {
      await addDoc(collection(db, 'planosPreditivos'), {
        maquina: maquina.nome,
        descricao: descPreditiva,
        frequencia: Number(freqPreditiva),
        dataUltimaManutencao: null,
        proximaData: null,
        ativo: true,
      });
      toast.success('Plano Preditivo criado!');
      setDescPreditiva('');
    } catch (error) { toast.error('Erro ao criar plano.'); }
  };

  const handleCriarPlanoPreventivo = async (e) => {
    e.preventDefault();
    if (!descPreventiva || !checklistId) return toast.error('Todos os campos são obrigatórios.');
    const checklistSelecionado = checklistTemplates.find(c => c.id === checklistId);
    try {
      await addDoc(collection(db, 'planosPreventivos'), {
        maquina: maquina.nome,
        descricao: descPreventiva,
        frequencia: Number(freqPreventiva),
        checklistId: checklistId,
        checklistNome: checklistSelecionado.nome,
        ativo: true,
        proximaData: null,
        dataUltimaManutencao: null,
      });
      toast.success('Plano Preventivo criado!');
      setDescPreventiva('');
      setChecklistId('');
    } catch (error) { toast.error('Erro ao criar plano.'); }
  };

  const handleGerarChamado = async (plano, tipo) => {
    const tipoChamado = tipo === 'preditiva' ? 'Preditiva' : 'Preventiva';
    if (!window.confirm(`Gerar chamado para a manutenção ${tipoChamado.toLowerCase()} "${plano.descricao}"?`)) return;
    try {
      let novoChamado = {
        maquina: plano.maquina,
        descricao: `Manutenção ${tipo}: ${plano.descricao}`,
        status: "Aberto",
        tipo: tipo,
        planoId: plano.id,
        operadorNome: "Sistema (Plano)",
        dataAbertura: serverTimestamp(),
      };
      if (tipo === 'preventiva') {
        const checklistTemplateDoc = await getDoc(doc(db, "checklistTemplates", plano.checklistId));
        if (checklistTemplateDoc.exists()) {
          novoChamado.checklist = checklistTemplateDoc.data().itens.map(item => ({ item, concluido: false }));
        } else {
          toast.error("Modelo de checklist associado a este plano não foi encontrado!");
          return;
        }
      }
      await addDoc(collection(db, 'chamados'), novoChamado);
      toast.success(`Chamado ${tipo} gerado com sucesso!`);
    } catch (error) {
      console.error("Erro ao gerar chamado: ", error);
      toast.error("Erro ao gerar chamado.");
    }
  };

  const handleExcluirPlano = async (planoId, tipo) => {
    const collectionName = tipo === 'preditiva' ? 'planosPreditivos' : 'planosPreventivos';
    if (!window.confirm("Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.")) return;
    try {
      await deleteDoc(doc(db, collectionName, planoId));
      toast.success("Plano excluído com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir plano: ", error);
      toast.error("Erro ao excluir plano.");
    }
  };

  if (loading) return <p style={{ padding: '20px' }}>Carregando dados da máquina...</p>;
  if (!maquina) return <p style={{ padding: '20px' }}>Máquina não encontrada.</p>;

  const HistoricoDaMaquina = () => (
    <div>
      <h2>Histórico de Manutenções da {maquina.nome}</h2>
      {chamados.length === 0 ? (
        <p>Nenhum chamado registrado para esta máquina.</p>
      ) : (
        <ul className={styles.chamadoList}>
          {chamados.map(chamado => (
            <Link to={`/historico/chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoCard}>
              <li className={styles.chamadoItem}>
                <strong>{chamado.descricao}</strong>
                <p>Status: {chamado.status}</p>
                <small>Aberto em: {chamado.dataAbertura ? new Date(chamado.dataAbertura.toDate()).toLocaleDateString('pt-BR') : 'N/A'}</small>
              </li>
            </Link>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <header className={styles.header}>
        <h1>{maquina.nome}</h1>
        <p>Prontuário completo da máquina e histórico de manutenções.</p>
      </header>

      {user.role === 'gestor' ? (
        // VISÃO COMPLETA DO GESTOR
        <div>
          <nav className={styles.tabs}>
            <button className={`${styles.tabButton} ${activeTab === 'historico' ? styles.active : ''}`} onClick={() => setActiveTab('historico')}>Histórico</button>
            <button className={`${styles.tabButton} ${activeTab === 'planos' ? styles.active : ''}`} onClick={() => setActiveTab('planos')}>Planos de Manutenção</button>
            <button className={`${styles.tabButton} ${activeTab === 'operadores' ? styles.active : ''}`} onClick={() => setActiveTab('operadores')}>Operadores Responsáveis</button>
          </nav>
          <div className={styles.tabContent}>
            {activeTab === 'historico' && <HistoricoDaMaquina />}
            {activeTab === 'planos' && (
              <div>
                <div className={styles.planSection}>
                  <h3>Planos Preditivos</h3>
                  {planosPreditivos.length === 0 ? <p>Nenhum plano preditivo criado.</p> : (
                    <ul className={styles.planList}>
                      {planosPreditivos.map(plano => (
                        <li key={plano.id} className={styles.planItem}>
                          <strong>{plano.descricao}</strong>
                          <span>A cada {plano.frequencia} dias</span>
                          <div className={styles.planActions}>
                            <button onClick={() => handleGerarChamado(plano, 'preditiva')} /* ... */ >
                              <FiSend /> Gerar
                            </button>
                            {/* LINK CORRIGIDO AQUI */}
                            <Link to={`/maquina/${id}/editar-plano-preditivo/${plano.id}`} className={`${styles.actionButton} ${styles.editButton}`}>
                              <FiEdit /> Editar
                            </Link>
                            <button onClick={() => handleExcluirPlano(plano.id, 'preditiva')} /* ... */ >
                              <FiTrash2 /> Excluir
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form onSubmit={handleCriarPlanoPreditivo} className={styles.form}>
                    <h4>Criar Novo Plano Preditivo</h4>
                    <div className={styles.formGroup}>
                      <label>Descrição da Tarefa</label>
                      <input value={descPreditiva} onChange={(e) => setDescPreditiva(e.target.value)} className={styles.input} required />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Frequência (dias)</label>
                      <input type="number" value={freqPreditiva} onChange={(e) => setFreqPreditiva(e.target.value)} className={styles.input} required min="1" />
                    </div>
                    <button type="submit" className={styles.button}>Adicionar Plano</button>
                  </form>
                </div>
                <div className={styles.planSection}>
                  <h3>Planos Preventivos</h3>
                  {planosPreventivos.length === 0 ? <p>Nenhum plano preventivo criado.</p> : (
                    <ul className={styles.planList}>
                      {planosPreventivos.map(plano => (
                        <li key={plano.id} className={styles.planItem}>
                          <strong>{plano.descricao}</strong>
                          <span>Checklist: {plano.checklistNome}</span>
                          <div className={styles.planActions}>
                            <button onClick={() => handleGerarChamado(plano, 'preventiva')} /* ... */ >
                              <FiSend /> Gerar
                            </button>
                            {/* LINK CORRIGIDO AQUI */}
                            <Link to={`/maquina/${id}/editar-plano-preventivo/${plano.id}`} className={`${styles.actionButton} ${styles.editButton}`}>
                              <FiEdit /> Editar
                            </Link>
                            <button onClick={() => handleExcluirPlano(plano.id, 'preventiva')} /* ... */ >
                              <FiTrash2 /> Excluir
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form onSubmit={handleCriarPlanoPreventivo} className={styles.form}>
                    <h4>Criar Novo Plano Preventivo</h4>
                    <div className={styles.formGroup}>
                      <label>Checklist a ser usado</label>
                      <select value={checklistId} onChange={(e) => setChecklistId(e.target.value)} className={styles.select} required>
                        <option value="" disabled>Selecione...</option>
                        {checklistTemplates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label>Descrição da Tarefa</label>
                      <input value={descPreventiva} onChange={(e) => setDescPreventiva(e.target.value)} className={styles.input} required />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Frequência (dias)</label>
                      <input type="number" value={freqPreventiva} onChange={(e) => setFreqPreventiva(e.target.value)} className={styles.input} required min="1" />
                    </div>
                    <button type="submit" className={styles.button}>Adicionar Plano</button>
                  </form>
                </div>
              </div>
            )}
            {activeTab === 'operadores' && (
              <div>
                <h2>Operadores Responsáveis pela {maquina.nome}</h2>
                <div className={styles.assignmentContainer}>
                  <div className={styles.column}>
                    <h3>Atribuídos a esta Máquina</h3>
                    <ul className={styles.operatorList}>
                      {operadoresAtribuidos.map(op => (
                        <li key={op.id} className={styles.operatorItem}>
                          <span>{op.nome}</span>
                          <button onClick={() => handleRemoverOperador(op.id)} className={`${styles.opActionButton} ${styles.removeButton}`} title="Remover"><FiMinus /></button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={styles.column}>
                    <h3>Operadores Disponíveis</h3>
                    <ul className={styles.operatorList}>
                      {operadoresDisponiveis.map(op => (
                        <li key={op.id} className={styles.operatorItem}>
                          <span>{op.nome}</span>
                          <button onClick={() => handleAtribuirOperador(op.id)} className={`${styles.opActionButton} ${styles.addButton}`} title="Adicionar"><FiPlus /></button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // VISÃO SIMPLIFICADA DO MANUTENTOR
        <div className={styles.tabContent}>
          <HistoricoDaMaquina />
        </div>
      )}
    </>
  );
};

export default MaquinaDetalhePage;