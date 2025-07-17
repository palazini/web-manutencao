// src/pages/MaquinaDetalhePage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase.js';
import { doc, onSnapshot, collection, query, where, orderBy, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import styles from './MaquinaDetalhePage.module.css';
import { FiPlus, FiMinus, FiSend, FiEdit, FiTrash2, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import Modal from '../components/Modal.jsx'; 

const MaquinaDetalhePage = ({ user }) => {
  const { id } = useParams();
  const [maquina, setMaquina] = useState(null);
  const [chamadosConcluidos, setChamadosConcluidos] = useState([]);
  const [chamadosAtivos, setChamadosAtivos] = useState([]);
  const [todosOperadores, setTodosOperadores] = useState([]);
  const [planosPreditivos, setPlanosPreditivos] = useState([]);
  const [planosPreventivos, setPlanosPreventivos] = useState([]);
  const [checklistTemplates, setChecklistTemplates] = useState([]);
  const [historicoChecklist, setHistoricoChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ativos');

  const [freqPreditiva, setFreqPreditiva] = useState(30);
  const [descPreditiva, setDescPreditiva] = useState('');
  const [freqPreventiva, setFreqPreventiva] = useState(30);
  const [descPreventiva, setDescPreventiva] = useState('');
  const [checklistId, setChecklistId] = useState('');
  const [novoItemChecklist, setNovoItemChecklist] = useState('');

  const [selectedSubmission, setSelectedSubmission] = useState(null);

  useEffect(() => {
    const maquinaDocRef = doc(db, 'maquinas', id);
    const unsubMaquina = onSnapshot(maquinaDocRef, (doc) => {
      if (doc.exists()) {
        const maquinaData = { id: doc.id, ...doc.data() };
        setMaquina(maquinaData);

        const ativosQuery = query(collection(db, 'chamados'), where('maquina', '==', maquinaData.nome), where('status', 'in', ['Aberto', 'Em Andamento']), orderBy('dataAbertura', 'desc'));
        const unsubAtivos = onSnapshot(ativosQuery, (snapshot) => {
          setChamadosAtivos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const concluidosQuery = query(collection(db, 'chamados'), where('maquina', '==', maquinaData.nome), where('status', '==', 'Concluído'), orderBy('dataAbertura', 'desc'));
        const unsubConcluidos = onSnapshot(concluidosQuery, (snapshot) => {
          setChamadosConcluidos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const preditivosQuery = query(collection(db, 'planosPreditivos'), where('maquina', '==', maquinaData.nome));
        const unsubPreditivos = onSnapshot(preditivosQuery, (snapshot) => setPlanosPreditivos(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));

        const preventivosQuery = query(collection(db, 'planosPreventivos'), where('maquina', '==', maquinaData.nome));
        const unsubPreventivos = onSnapshot(preventivosQuery, (snapshot) => setPlanosPreventivos(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));

        const hoje = new Date();
        const dataInicio = new Date();
        dataInicio.setDate(hoje.getDate() - 30);
        const qSubmissoes = query(collection(db, 'checklistSubmissions'), where('maquinaId', '==', maquinaData.id), where('dataSubmissao', '>=', dataInicio));
        const unsubSubmissoes = onSnapshot(qSubmissoes, (snapshot) => {
          const submissions = snapshot.docs.map(d => ({...d.data(), dataSubmissao: d.data().dataSubmissao.toDate()}));
          processarHistoricoChecklist(submissions);
        });

        setLoading(false);
        return () => { unsubAtivos(); unsubConcluidos(); unsubPreditivos(); unsubPreventivos(); unsubSubmissoes(); };
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
  
  // NOVA LÓGICA para separar os operadores por turno
  const operadoresPorTurno = useMemo(() => {
    if (!maquina || !todosOperadores.length) {
      return { turno1: {}, turno2: {} };
    }

    const idsTurno1 = new Set(maquina.operadoresPorTurno?.turno1 || []);
    const idsTurno2 = new Set(maquina.operadoresPorTurno?.turno2 || []);

    const atribuidosT1 = todosOperadores.filter(op => idsTurno1.has(op.id));
    const atribuidosT2 = todosOperadores.filter(op => idsTurno2.has(op.id));
    
    const disponiveis = todosOperadores.filter(op => !idsTurno1.has(op.id) && !idsTurno2.has(op.id));

    return {
      turno1: { atribuidos: atribuidosT1, disponiveis },
      turno2: { atribuidos: atribuidosT2, disponiveis },
    };
  }, [maquina, todosOperadores]);

  // FUNÇÕES ATUALIZADAS para mover os operadores por TURNO
  const handleAtribuirOperador = async (operadorId, turno) => {
    const maquinaRef = doc(db, 'maquinas', id);
    await updateDoc(maquinaRef, {
      [`operadoresPorTurno.${turno}`]: arrayUnion(operadorId)
    });
  };

  const handleRemoverOperador = async (operadorId, turno) => {
    const maquinaRef = doc(db, 'maquinas', id);
    await updateDoc(maquinaRef, {
      [`operadoresPorTurno.${turno}`]: arrayRemove(operadorId)
    });
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

  const handleAdicionarItemChecklist = async () => {
    if (novoItemChecklist.trim() === '') {
      toast.error("O item do checklist não pode ser vazio.");
      return;
    }
    const maquinaRef = doc(db, 'maquinas', id);
    try {
      await updateDoc(maquinaRef, {
        checklistDiario: arrayUnion(novoItemChecklist)
      });
      toast.success("Item adicionado ao checklist!");
      setNovoItemChecklist(''); // Limpa o campo
    } catch (error) {
      toast.error("Erro ao adicionar item.");
      console.error(error);
    }
  };

  const handleRemoverItemChecklist = async (itemParaRemover) => {
    if (!window.confirm(`Tem certeza que deseja remover o item "${itemParaRemover}"?`)) return;
    const maquinaRef = doc(db, 'maquinas', id);
    try {
      await updateDoc(maquinaRef, {
        checklistDiario: arrayRemove(itemParaRemover)
      });
      toast.success("Item removido do checklist!");
    } catch (error) {
      toast.error("Erro ao remover item.");
      console.error(error);
    }
  };

  const processarHistoricoChecklist = (submissoes) => {
    const relatorio = {};
    const hoje = new Date();

    for (let i = 0; i < 30; i++) {
      const dia = new Date();
      dia.setDate(hoje.getDate() - i);
      const diaString = dia.toLocaleDateString('pt-BR');
      relatorio[diaString] = {
        dataObj: dia,
        turno1: { status: 'Pendente', submission: null },
        turno2: { status: 'Pendente', submission: null },
      };
    }

    submissoes.forEach(sub => {
      const dataSub = sub.dataSubmissao;
      const diaString = dataSub.toLocaleDateString('pt-BR');
      const hora = dataSub.getHours();
      const minuto = dataSub.getMinutes();
      const minutosAtuais = hora * 60 + minuto;
      const inicioTurno2 = 15 * 60 + 18;
      const turno = minutosAtuais < inicioTurno2 ? 'turno1' : 'turno2';
      
      if (relatorio[diaString]) {
        // AQUI ESTÁ A CORREÇÃO: Adicionamos o objeto 'sub' à propriedade 'submission'
        relatorio[diaString][turno] = { status: 'Entregue', operador: sub.operadorNome, submission: sub };
      }
    });
    setHistoricoChecklist(Object.values(relatorio).sort((a,b) => b.dataObj - a.dataObj));
  };

  const handleShowDetails = (submission) => {
    if (submission) {
      setSelectedSubmission(submission);
    }
  };


  if (loading) return <p style={{ padding: '20px' }}>Carregando dados da máquina...</p>;
  if (!maquina) return <p style={{ padding: '20px' }}>Máquina não encontrada.</p>;

  console.log("Dados do Histórico de Checklist:", historicoChecklist);

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

  const ListaDeChamados = ({ lista, titulo, mensagemVazia }) => (
    <div>
      <h2>{titulo}</h2>
      {lista.length === 0 ? <p>{mensagemVazia}</p> : (
        <ul className={styles.chamadoList}>
          {lista.map(chamado => (
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
  
  // Componente reutilizável para a interface de atribuição de um turno
  const TurnoUI = ({ nomeTurno, numeroTurno, dados }) => (
    <div className={styles.turnoSection}>
      <h3>{nomeTurno}</h3>
      <div className={styles.assignmentContainer}>
        <div className={styles.column}>
          <h4>Operadores Atribuídos</h4>
          <ul className={styles.operatorList}>
            {dados.atribuidos.map(op => (
              <li key={op.id} className={styles.operatorItem}>
                <span>{op.nome}</span>
                <button onClick={() => handleRemoverOperador(op.id, `turno${numeroTurno}`)} className={`${styles.opActionButton} ${styles.removeButton}`} title="Remover">
                  <FiMinus />
                </button>
              </li>
            ))}
            {dados.atribuidos.length === 0 && <p>Nenhum operador neste turno.</p>}
          </ul>
        </div>
        <div className={styles.column}>
          <h4>Operadores Disponíveis</h4>
          <ul className={styles.operatorList}>
            {dados.disponiveis.map(op => (
              <li key={op.id} className={styles.operatorItem}>
                <span>{op.nome}</span>
                <button onClick={() => handleAtribuirOperador(op.id, `turno${numeroTurno}`)} className={`${styles.opActionButton} ${styles.addButton}`} title="Adicionar">
                  <FiPlus />
                </button>
              </li>
            ))}
            {dados.disponiveis.length === 0 && <p>Todos os operadores já foram atribuídos.</p>}
          </ul>
        </div>
      </div>
    </div>
  );


  return (
    <>
      <header className={styles.header}>
        <h1>{maquina.nome}</h1>
        <p>Prontuário completo da máquina e histórico de manutenções.</p>
      </header>

      {user.role === 'gestor' ? (
        // VISÃO DO GESTOR (COM ABAS)
        <div>
          <nav className={styles.tabs}>
            <button className={`${styles.tabButton} ${activeTab === 'ativos' ? styles.active : ''}`} onClick={() => setActiveTab('ativos')}>Chamados Ativos</button>
            <button className={`${styles.tabButton} ${activeTab === 'historico' ? styles.active : ''}`} onClick={() => setActiveTab('historico')}>Histórico</button>
            <button className={`${styles.tabButton} ${activeTab === 'planos' ? styles.active : ''}`} onClick={() => setActiveTab('planos')}>Planos de Manutenção</button>
            <button className={`${styles.tabButton} ${activeTab === 'checklist' ? styles.active : ''}`} onClick={() => setActiveTab('checklist')}>Checklist Diário</button>
            <button className={`${styles.tabButton} ${activeTab === 'operadores' ? styles.active : ''}`} onClick={() => setActiveTab('operadores')}>Operadores</button>
          </nav>

          <div className={styles.tabContent}>
            {activeTab === 'ativos' && <ListaDeChamados lista={chamadosAtivos} titulo={`Chamados Ativos da ${maquina.nome}`} mensagemVazia="Nenhum chamado ativo." />}
            {activeTab === 'historico' && <ListaDeChamados lista={chamadosConcluidos} titulo={`Histórico da ${maquina.nome}`} mensagemVazia="Nenhum chamado concluído." />}
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
                            <button onClick={() => handleGerarChamado(plano, 'preditiva')} className={`${styles.actionButton} ${styles.generateButton}`}><FiSend /> Gerar</button>
                            <Link to={`editar-plano-preditivo/${plano.id}`} className={`${styles.actionButton} ${styles.editButton}`}><FiEdit /> Editar</Link>
                            <button onClick={() => handleExcluirPlano(plano.id, 'preditiva')} className={`${styles.actionButton} ${styles.deleteButton}`}><FiTrash2 /> Excluir</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form onSubmit={handleCriarPlanoPreditivo} className={styles.form}>
                    <h4>Criar Novo Plano Preditivo</h4>
                    <div className={styles.formGroup}><label>Descrição da Tarefa</label><input value={descPreditiva} onChange={(e) => setDescPreditiva(e.target.value)} className={styles.input} required /></div>
                    <div className={styles.formGroup}><label>Frequência (dias)</label><input type="number" value={freqPreditiva} onChange={(e) => setFreqPreditiva(e.target.value)} className={styles.input} required min="1" /></div>
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
                            <button onClick={() => handleGerarChamado(plano, 'preventiva')} className={`${styles.actionButton} ${styles.generateButton}`}><FiSend /> Gerar</button>
                            <Link to={`editar-plano-preventivo/${plano.id}`} className={`${styles.actionButton} ${styles.editButton}`}><FiEdit /> Editar</Link>
                            <button onClick={() => handleExcluirPlano(plano.id, 'preventiva')} className={`${styles.actionButton} ${styles.deleteButton}`}><FiTrash2 /> Excluir</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form onSubmit={handleCriarPlanoPreventivo} className={styles.form}>
                    <h4>Criar Novo Plano Preventivo</h4>
                    <div className={styles.formGroup}><label>Checklist a ser usado</label><select value={checklistId} onChange={(e) => setChecklistId(e.target.value)} className={styles.select} required><option value="" disabled>Selecione...</option>{checklistTemplates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></div>
                    <div className={styles.formGroup}><label>Descrição da Tarefa</label><input value={descPreventiva} onChange={(e) => setDescPreventiva(e.target.value)} className={styles.input} required /></div>
                    <div className={styles.formGroup}><label>Frequência (dias)</label><input type="number" value={freqPreventiva} onChange={(e) => setFreqPreventiva(e.target.value)} className={styles.input} required min="1" /></div>
                    <button type="submit" className={styles.button}>Adicionar Plano</button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'checklist' && (
            <div className={styles.checklistEditor}>
              <h3>Itens do Checklist Diário da {maquina.nome}</h3>
              
              {(!maquina.checklistDiario || maquina.checklistDiario.length === 0) && (
                <p>Nenhum item de checklist cadastrado para esta máquina.</p>
              )}

              <ul className={styles.operatorList}>
                {maquina.checklistDiario && maquina.checklistDiario.map((item, index) => (
                  <li key={index} className={styles.checklistItemManage}>
                    <span>{item}</span>
                    <button onClick={() => handleRemoverItemChecklist(item)} className={`${styles.opActionButton} ${styles.removeButton}`} title="Remover Item">
                      <FiTrash2 />
                    </button>
                  </li>
                ))}
              </ul>

              <div className={styles.checklistInputForm}>
                <input 
                  type="text" 
                  value={novoItemChecklist}
                  onChange={(e) => setNovoItemChecklist(e.target.value)}
                  className={styles.checklistInput}
                  placeholder="Adicionar novo item de verificação"
                />
                <button onClick={handleAdicionarItemChecklist} className={styles.checklistAddButton}>Adicionar</button>
              </div>

              <div className={styles.historyReport}>
                <h3>Histórico de Conformidade Diária</h3>
                <div className={`${styles.dayEntry} ${styles.dayHeader}`}>
                  <span>Data</span>
                  <span>1º Turno</span>
                  <span>2º Turno</span>
                </div>
                {historicoChecklist.map((entry) => (
                  <div key={entry.dataObj.toISOString()} className={styles.dayEntry}>
                    <span>{entry.dataObj.toLocaleDateString('pt-BR')}</span>
                    <div 
                      className={`${styles.turnStatus} ${entry.turno1.status === 'Entregue' ? styles.completed : styles.pending} ${entry.turno1.submission ? styles.clickable : ''}`} 
                      onClick={() => handleShowDetails(entry.turno1.submission)}
                    >
                      {entry.turno1.status === 'Entregue' ? <FiCheckCircle/> : <FiXCircle/>}
                      <span>{entry.turno1.operador || 'Pendente'}</span>
                    </div>
                    <div 
                      className={`${styles.turnStatus} ${entry.turno2.status === 'Entregue' ? styles.completed : styles.pending} ${entry.turno2.submission ? styles.clickable : ''}`} 
                      onClick={() => handleShowDetails(entry.turno2.submission)}
                    >
                      {entry.turno2.status === 'Entregue' ? <FiCheckCircle/> : <FiXCircle/>}
                      <span>{entry.turno2.operador || 'Pendente'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

            {activeTab === 'operadores' && (
              <div>
                <TurnoUI nomeTurno="1º Turno (05:30 - 15:18)" numeroTurno={1} dados={operadoresPorTurno.turno1} />
                <TurnoUI nomeTurno="2º Turno (15:18 - 00:48)" numeroTurno={2} dados={operadoresPorTurno.turno2} />
              </div>
            )}
          </div>
        </div>
      ) : (
        // VISÃO DO MANUTENTOR
        <div className={styles.tabContent}>
          <ListaDeChamados lista={chamadosAtivos} titulo={`Chamados Ativos da ${maquina.nome}`} mensagemVazia="Nenhum chamado ativo." />
          <hr style={{margin: '30px 0'}}/>
          <ListaDeChamados lista={chamadosConcluidos} titulo={`Histórico da ${maquina.nome}`} mensagemVazia="Nenhum chamado concluído." />
        </div>
      )}
      <Modal 
        isOpen={!!selectedSubmission} 
        onClose={() => setSelectedSubmission(null)}
        title={`Checklist de ${selectedSubmission?.dataSubmissao ? selectedSubmission.dataSubmissao.toLocaleDateString('pt-BR') : ''}`}
      >
        {selectedSubmission && (
          <div>
            <h4>{selectedSubmission.checklistNome}</h4>
            <ul className={styles.detailsList}>
              {Object.entries(selectedSubmission.respostas).map(([pergunta, resposta]) => (
                <li key={pergunta} className={styles.detailItem}>
                  <span>{pergunta}</span>
                  <strong className={resposta === 'sim' ? styles.completed : styles.pending}>
                    {resposta.toUpperCase()}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
};
export default MaquinaDetalhePage;