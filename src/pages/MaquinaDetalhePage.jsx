// src/pages/MaquinaDetalhePage.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase.js';
import { doc, onSnapshot, collection, query, where, orderBy, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import styles from './MaquinaDetalhePage.module.css';
import { FiPlus, FiMinus, FiSend, FiEdit, FiTrash2, FiCheckCircle, FiXCircle, FiDownload } from 'react-icons/fi';
import { AiOutlineQrcode } from 'react-icons/ai';
import { QRCodeCanvas } from 'qrcode.react';
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
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const qrCodeRef = useRef(null);

  // Formulários
  const [freqPreditiva, setFreqPreditiva] = useState(30);
  const [descPreditiva, setDescPreditiva] = useState('');
  const [freqPreventiva, setFreqPreventiva] = useState(30);
  const [descPreventiva, setDescPreventiva] = useState('');
  const [checklistId, setChecklistId] = useState('');
  const [novoItemChecklist, setNovoItemChecklist] = useState('');

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
    
    const checklistsQuery = query(collection(db, 'checklistTemplates'));
    const unsubChecklists = onSnapshot(checklistsQuery, (snapshot) => setChecklistTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    return () => { unsubMaquina(); unsubChecklists(); };
  }, [id]);
  

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

  const getStatusClass = (tipo) => {
    switch(tipo) {
      case 'corretiva': return styles.corretiva;
      case 'preventiva': return styles.preventiva;
      case 'preditiva': return styles.preditiva;
      default: return styles.normal;
    }
  };

  const handleDownloadQRCode = () => {
    const canvas = qrCodeRef.current.querySelector('canvas');
    if (canvas) {
      const pngUrl = canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
      let downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `${maquina.nome}-QRCode.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
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
              <li className={`${styles.chamadoItem} ${getStatusClass(tipoChamado)}`}>
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
          {lista.map(chamado => {
            // Se o tipo não existir, consideramos como 'corretiva'
            const tipoChamado = chamado.tipo || 'corretiva';
            return (
              <Link to={`/historico/chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoCard}>
                {/* Aplicamos a classe de cor dinâmica aqui */}
                <li className={`${styles.chamadoItem} ${getStatusClass(tipoChamado)}`}>
                  <strong>{chamado.descricao}</strong>
                  <p>Status: {chamado.status}</p>
                  <small>Aberto em: {chamado.dataAbertura ? new Date(chamado.dataAbertura.toDate()).toLocaleDateString('pt-BR') : 'N/A'}</small>
                </li>
              </Link>
            );
          })}
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
        // VISÃO DO GESTOR (COM ABAS)
        <div>
          <nav className={styles.tabs}>
            <button className={`${styles.tabButton} ${activeTab === 'ativos' ? styles.active : ''}`} onClick={() => setActiveTab('ativos')}>Chamados Ativos</button>
            <button className={`${styles.tabButton} ${activeTab === 'historico' ? styles.active : ''}`} onClick={() => setActiveTab('historico')}>Histórico</button>
            <button className={`${styles.tabButton} ${activeTab === 'preditiva' ? styles.active : ''}`} onClick={() => setActiveTab('preditiva')}>Preditiva</button>
            <button className={`${styles.tabButton} ${activeTab === 'preventiva' ? styles.active : ''}`} onClick={() => setActiveTab('preventiva')}>Preventiva</button>
            <button className={`${styles.tabButton} ${activeTab === 'checklist' ? styles.active : ''}`} onClick={() => setActiveTab('checklist')}>Checklist Diário</button>
            {user.role === 'gestor' && (
              <button className={`${styles.tabButton} ${activeTab === 'qrcode' ? styles.active : ''}`} onClick={() => setActiveTab('qrcode')}>QR Code</button>
            )}
          </nav>
          <div className={styles.tabContent}>
            {activeTab === 'ativos' && <ListaDeChamados lista={chamadosAtivos} titulo={`Chamados Ativos da ${maquina.nome}`} mensagemVazia="Nenhum chamado ativo." />}
            {activeTab === 'historico' && <ListaDeChamados lista={chamadosConcluidos} titulo={`Histórico da ${maquina.nome}`} mensagemVazia="Nenhum chamado concluído." />}
            
            {activeTab === 'preditiva' && (
              <div className={styles.planSection}>
                <h3>Planos de Manutenção Preditiva</h3>
                {planosPreditivos.length === 0 ? <p>Nenhum plano preditivo criado.</p> : (
                  <ul className={styles.planList}>
                    {planosPreditivos.map(plano => (
                      <li key={plano.id} className={styles.planItem}>
                        <strong>{plano.descricao}</strong>
                        <span>A cada {plano.frequencia} dias</span>
                        <div className={styles.planActions}>
                          <button onClick={() => handleGerarChamado(plano, 'preditiva')} className={`${styles.actionButton} ${styles.generateButton}`}><FiSend /> Gerar</button>
                          <Link to={`/editar-plano-preditivo/${plano.id}`} className={`${styles.actionButton} ${styles.editButton}`}><FiEdit /> Editar</Link>
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
            )}
            {activeTab === 'preventiva' && (
              <div className={styles.planSection}>
                <h3>Planos de Manutenção Preventiva</h3>
                {planosPreventivos.length === 0 ? <p>Nenhum plano preventivo criado.</p> : (
                  <ul className={styles.planList}>
                    {planosPreventivos.map(plano => (
                      <li key={plano.id} className={styles.planItem}>
                        <strong>{plano.descricao}</strong>
                        <span>Checklist: {plano.checklistNome}</span>
                        <div className={styles.planActions}>
                          <button onClick={() => handleGerarChamado(plano, 'preventiva')} className={`${styles.actionButton} ${styles.generateButton}`}><FiSend /> Gerar</button>
                          <Link to={`/editar-plano-preventivo/${plano.id}`} className={`${styles.actionButton} ${styles.editButton}`}><FiEdit /> Editar</Link>
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

          {activeTab === 'qrcode' && (
            <div className={styles.qrCodeSection}>
              <h3>QR Code para Acesso Rápido</h3>
              <p>Baixe este código e cole na máquina para acesso rápido ao prontuário.</p>
              
              <div ref={qrCodeRef} className={styles.qrCodeCanvas}>
                <QRCodeCanvas 
                  value={`${window.location.origin}/maquinas/${id}`} 
                  size={256}
                  bgColor={"#ffffff"}
                  fgColor={"#000000"}
                  level={"L"}
                  includeMargin={true}
                />
              </div>

              <button onClick={handleDownloadQRCode} className={styles.downloadButton}>
                <FiDownload /> Baixar QR Code
              </button>
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