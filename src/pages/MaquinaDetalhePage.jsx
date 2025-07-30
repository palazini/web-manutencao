// src/pages/MaquinaDetalhePage.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase.js';
import { doc, onSnapshot, collection, query, where, orderBy, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import styles from './MaquinaDetalhePage.module.css';
import { FiPlus, FiMinus, FiSend, FiEdit, FiTrash2, FiCheckCircle, FiXCircle, FiDownload } from 'react-icons/fi';
import { AiOutlineQrcode } from 'react-icons/ai';
import { QRCodeCanvas } from 'qrcode.react';
import Modal from '../components/Modal.jsx'; 
import { Calendar } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { dateFnsLocalizer } from 'react-big-calendar'
import { ptBR } from 'date-fns/locale';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import moment from 'moment';
import 'moment/locale/pt-br';


const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({
  format,
  parse: (value, formatStr) => parse(value, formatStr, new Date(), { locale: ptBR }),
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }),
  getDay,
  locales,
});
const DnDCalendar = withDragAndDrop(Calendar)

const MaquinaDetalhePage = ({ user }) => {
  const { id } = useParams();
  const [maquina, setMaquina] = useState(null);
  const [chamadosConcluidos, setChamadosConcluidos] = useState([]);
  const [chamadosAtivos, setChamadosAtivos] = useState([]);
  const [historicoChecklist, setHistoricoChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ativos');
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const qrCodeRef = useRef(null);


  // Formulários
  const [novoItemChecklist, setNovoItemChecklist] = useState('');
  const [eventosPreventivos, setEventosPreventivos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [modalAgendamentoOpen, setModalAgendamentoOpen] = useState(false);
  const [dadosAgendamento, setDadosAgendamento] = useState(null);
  const [descAgendamento, setDescAgendamento] = useState('');
  const [itensChecklistAgendamento, setItensChecklistAgendamento] = useState('');
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView]           = useState('month');

  useEffect(() => {
    const maquinaDocRef = doc(db, 'maquinas', id);
    const unsubMaquina = onSnapshot(maquinaDocRef, (doc) => {
      if (doc.exists()) {
        const maquinaData = { id: doc.id, ...doc.data() };
        setMaquina(maquinaData);

        const agendamentosQuery = query(collection(db, 'agendamentosPreventivos'), where('maquinaId', '==', maquinaData.id));
        const unsubAgendamentos = onSnapshot(agendamentosQuery, (snapshot) => {
          const eventos = snapshot.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              title: data.descricao,
              start: data.start.toDate(),
              end: data.end.toDate(),
              allDay: true,
              resource: data, 
            };
          });
          setAgendamentos(eventos);
        });

        const ativosQuery = query(collection(db, 'chamados'), where('maquina', '==', maquinaData.nome), where('status', 'in', ['Aberto', 'Em Andamento']), orderBy('dataAbertura', 'desc'));
        const unsubAtivos = onSnapshot(ativosQuery, (snapshot) => {
          setChamadosAtivos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const concluidosQuery = query(collection(db, 'chamados'), where('maquina', '==', maquinaData.nome), where('status', '==', 'Concluído'), orderBy('dataAbertura', 'desc'));
        const unsubConcluidos = onSnapshot(concluidosQuery, (snapshot) => {
          setChamadosConcluidos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const planosQuery = query(collection(db, 'planosPreventivos'), where('maquina', '==', maquinaData.nome));
        const unsubPlanos = onSnapshot(planosQuery, (snapshot) => {
          const eventos = snapshot.docs.map((doc) => {
            const data = doc.data();
            const proximaData = data.proximaData?.toDate?.() || null;
            return {
              id: doc.id,
              title: data.descricao,
              start: proximaData || new Date(),
              end: proximaData || new Date(),
              allDay: true,
              resource: data,
            };
          });
          setEventosPreventivos(eventos);
        });

        const hoje = new Date();
        const dataInicio = new Date();
        dataInicio.setDate(hoje.getDate() - 30);
        const qSubmissoes = query(collection(db, 'checklistSubmissions'), where('maquinaId', '==', maquinaData.id), where('dataSubmissao', '>=', dataInicio));
        const unsubSubmissoes = onSnapshot(qSubmissoes, (snapshot) => {
          const submissions = snapshot.docs.map(d => ({...d.data(), dataSubmissao: d.data().dataSubmissao.toDate()}));
          processarHistoricoChecklist(submissions);
        });

        setLoading(false);
        return () => { unsubAtivos(); unsubConcluidos(); unsubPlanos(); unsubAgendamentos(); unsubSubmissoes(); };
      } else {
        setMaquina(null); setLoading(false);
      }
    });
    return () => { unsubMaquina(); };
  }, [id]);

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

  const handleSelectSlot = (slot) => {
    if (user.role !== 'gestor') return;
    setDadosAgendamento({ start: slot.start, end: slot.end });
    setModalAgendamentoOpen(true);
  };

  const handleSelectEvent = (event) => {
    setEventoSelecionado(event);
  };

  const handleCriarAgendamento = async (e) => {
    e.preventDefault();
    const itensArray = itensChecklistAgendamento.split('\n').filter(item => item.trim() !== '');
    if (!descAgendamento || itensArray.length === 0) {
      toast.error("Preencha a descrição e pelo menos um item do checklist.");
      return;
    }
    try {
      await addDoc(collection(db, 'agendamentosPreventivos'), {
        maquinaId: id,
        maquinaNome: maquina.nome,
        descricao: descAgendamento,
        itensChecklist: itensArray,
        start: dadosAgendamento.start,
        end: dadosAgendamento.end,
        criadoEm: serverTimestamp(),
        status: 'agendado', // Status inicial
      });
      toast.success("Manutenção preventiva agendada!");
      setModalAgendamentoOpen(false);
      setDescAgendamento('');
      setItensChecklistAgendamento('');
    } catch (error) {
      toast.error("Erro ao agendar manutenção.");
      console.error(error);
    }
  };

  const handleIniciarManutencao = async (agendamento) => {
    if (!window.confirm(`Tem certeza que deseja iniciar a manutenção "${agendamento.title}" agora?`))
      return;

    try {
      // 1) Cria o chamado e obtém a referência
      const chamadoRef = await addDoc(
        collection(db, 'chamados'),
        {
          maquina: agendamento.resource.maquinaNome,
          descricao: `Manutenção preventiva agendada: ${agendamento.title}`,
          status: "Aberto",
          tipo: "preventiva",
          checklist: agendamento.resource.itensChecklist.map(item => ({ item, resposta: 'sim' })),
          agendamentoId: agendamento.id,
          operadorNome: `Sistema (Iniciado por ${user.nome})`,
          dataAbertura: serverTimestamp(),
        }
      );

      toast.success("Chamado de manutenção criado com sucesso!");

      // 2) Marca imediatamente o agendamento como "iniciado"
      const agRef = doc(db, 'agendamentosPreventivos', agendamento.id);
      await updateDoc(agRef, { status: 'iniciado' });
      console.log(`✅ Agendamento ${agendamento.id} marcado como iniciado.`);

      // 3) Inscreve‑se num listener naquele chamado
      const unsubscribe = onSnapshot(chamadoRef, (snap) => {
        const data = snap.data();
        // Quando o chamado for concluído, atualiza o agendamento para 'concluido'
        if (data.status === 'Concluído') {
          console.log('🔄 Concluído — atualizando agendamento...');
          updateDoc(agRef, { status: 'concluido' });
          // já fez o trabalho, cancele o listener
          unsubscribe();
        }
      });

      // Fecha o modal de detalhes
      setEventoSelecionado(null);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível iniciar a manutenção.");
    }
  };



  if (loading) return <p style={{ padding: '20px' }}>Carregando dados da máquina...</p>;
  if (!maquina) return <p style={{ padding: '20px' }}>Máquina não encontrada.</p>;

  const ListaDeChamados = ({ lista, titulo, mensagemVazia }) => (
    <div>
      <h2>{titulo}</h2>
      {lista.length === 0 ? <p>{mensagemVazia}</p> : (
        <ul className={styles.chamadoList}>
          {lista.map(chamado => {
            const tipoChamado = chamado.tipo || 'corretiva';
            const isConcluido = chamado.status === 'Concluído';

            // Se for concluído, use a classe que "desliga" a cor;
            // caso contrário, mantém o getStatusClass original
            const statusClass = isConcluido
              ? styles.concluidoCard
              : getStatusClass(tipoChamado);

            return (
              <Link
                to={`/historico/chamado/${chamado.id}`}
                key={chamado.id}
                className={styles.chamadoCard}
              >
                <li className={`${styles.chamadoItem} ${statusClass}`}>
                  <strong>{chamado.descricao}</strong>
                  <p>Status: {chamado.status}</p>
                  <small>
                    Aberto em:{' '}
                    {chamado.dataAbertura
                      ? new Date(chamado.dataAbertura.toDate()).toLocaleDateString('pt-BR')
                      : 'N/A'}
                  </small>
                </li>
              </Link>
            );
          })}
        </ul>
      )}
    </div>
  );

  function getContrastColor(hex) {
    // Remove o ‘#’ se presente
    hex = hex.replace('#','');
    // Converte R, G e B para valores numéricos
    const r = parseInt(hex.substring(0,2),16);
    const g = parseInt(hex.substring(2,4),16);
    const b = parseInt(hex.substring(4,6),16);
    // Cálculo de luminância perceptual
    const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }
  


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

            <button className={`${styles.tabButton} ${activeTab === 'preventiva' ? styles.active : ''}`} onClick={() => setActiveTab('preventiva')}>Preventiva</button>
            <button className={`${styles.tabButton} ${activeTab === 'checklist' ? styles.active : ''}`} onClick={() => setActiveTab('checklist')}>Checklist Diário</button>
            {user.role === 'gestor' && (
              <button className={`${styles.tabButton} ${activeTab === 'qrcode' ? styles.active : ''}`} onClick={() => setActiveTab('qrcode')}>QR Code</button>
            )}
          </nav>
          <div className={styles.tabContent}>
            {activeTab === 'ativos' && <ListaDeChamados lista={chamadosAtivos} titulo={`Chamados Ativos da ${maquina.nome}`} mensagemVazia="Nenhum chamado ativo." />}
            {activeTab === 'historico' && <ListaDeChamados lista={chamadosConcluidos} titulo={`Histórico da ${maquina.nome}`} mensagemVazia="Nenhum chamado concluído." />}
            
            {activeTab === 'preventiva' && (
              <div className={styles.planSection}>

                {/* Legend */}
                <div className={styles.legend}>
                  <div>
                    <span className={styles.legendBox} style={{ backgroundColor: '#8B0000' }}></span> Vencido
                  </div>
                  <div>
                    <span className={styles.legendBox} style={{ backgroundColor: '#FFA500' }}></span> Hoje
                  </div>
                  <div>
                    <span className={styles.legendBox} style={{ backgroundColor: '#90EE90' }}></span> Futuro
                  </div>
                  <div>
                    <span className={styles.legendBox} style={{ backgroundColor: '#006400' }}></span> Iniciado
                  </div>
                  <div>
                    <span className={styles.legendBox} style={{ backgroundColor: '#00008B' }}></span> Concluído
                  </div>
                </div>

                {/* Calendar */}
                <div style={{ height: 600, marginTop: 20 }}>
                  <DnDCalendar
                    localizer={localizer}

                    /* ① controla a data mostrada */
                    date={currentDate}
                    onNavigate={setCurrentDate}

                    /* ② controla qual aba está ativa */
                    view={view}
                    onView={setView}

                    /* ③ suas views e range da Agenda */
                    views={['month','agenda']}
                    defaultView="month"
                    length={30}

                    toolbar
                    events={agendamentos}
                    startAccessor="start"
                    endAccessor="end"
                    selectable={user.role === 'gestor'}
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    onEventDrop={({ event, start, end }) => {
                      const agRef = doc(db, 'agendamentosPreventivos', event.id);
                      updateDoc(agRef, { start, end }).catch(() => toast.error('Failed to reschedule'));
                    }}
                    messages={{
                      next: "Próximo",
                      previous: "Anterior",
                      today: "Hoje",
                      month: "Mês",
                      week: "Semana",
                      day: "Dia",
                      agenda: "Agenda",
                      date: "Data",
                      time: "Hora",
                      showMore: total => `+${total} mais`,
                    }}
                    formats={{
                      // aqui sobrescrevemos só o intervalo da Agenda
                      agendaHeaderFormat: ({ start, end }) =>
                      `${moment(start).format('DD/MM/YYYY')} – ${moment(end).format('DD/MM/YYYY')}`
                    }}
                    eventPropGetter={event => {
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      const startDate = event.start;
                      let bg;
                      if (event.resource.status === 'iniciado') {
                        bg = '#006400';
                      } else if (event.resource.status === 'agendado') {
                        if (startDate < today)               bg = '#8B0000';
                        else if (startDate.toDateString() === today.toDateString()) bg = '#FFA500';
                        else                                 bg = '#90EE90';
                      } else if (event.resource.status === 'concluido') {
                        bg = '#00008B';
                      } else {
                        bg = '#FFFFFF';
                      }
                      return {
                        style: {
                          backgroundColor: bg,
                          color: getContrastColor(bg),
                          borderRadius: '4px',
                          border: '1px solid #aaa'
                        }
                      };
                    }}
                    components={{
                      event: ({ event }) => (
                        <div className={styles.eventoNoCalendario}>
                          {event.title}
                        </div>
                      )
                    }}
                    style={{ backgroundColor: 'white', borderRadius: 8, padding: 10 }}
                  />
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
        // VISÃO DO MANUTENTOR (agora com calendário)
        <div className={styles.tabContent}>
          <ListaDeChamados
            lista={chamadosAtivos}
            titulo={`Chamados Ativos da ${maquina.nome}`}
            mensagemVazia="Nenhum chamado ativo."
          />
          <hr style={{ margin: '30px 0' }} />
          <ListaDeChamados
            lista={chamadosConcluidos}
            titulo={`Histórico da ${maquina.nome}`}
            mensagemVazia="Nenhum chamado concluído."
          />
          
         {/* ––– visão do manutentor ––– */}
          <hr style={{ margin: '30px 0' }} />

          <div className={styles.planSection}>
            <h3>Calendário de Manutenção Preventiva</h3>
            <p>Visualize os agendamentos já criados.</p>

            <div
              style={{
                padding: 16,
                backgroundColor: '#ffffff',
                border: '1px solid #e0e0e0',
                borderRadius: 8,
                marginTop: 20,
              }}
            >
              {/* legenda dentro da mesma caixa */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: 12 }}>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 16,
                      height: 16,
                      backgroundColor: '#8B0000',
                      marginRight: 4,
                      verticalAlign: 'middle',
                    }}
                  />
                  Vencido
                </div>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 16,
                      height: 16,
                      backgroundColor: '#FFA500',
                      marginRight: 4,
                      verticalAlign: 'middle',
                    }}
                  />
                  Hoje
                </div>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 16,
                      height: 16,
                      backgroundColor: '#90EE90',
                      marginRight: 4,
                      verticalAlign: 'middle',
                    }}
                  />
                  Futuro
                </div>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 16,
                      height: 16,
                      backgroundColor: '#006400',
                      marginRight: 4,
                      verticalAlign: 'middle',
                    }}
                  />
                  Iniciado
                </div>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 16,
                      height: 16,
                      backgroundColor: '#00008B',
                      marginRight: 4,
                      verticalAlign: 'middle',
                    }}
                  />
                  Concluído
                </div>
              </div>

              {/* calendário */}
              <Calendar
                localizer={localizer}

                /* para toolbar e agenda funcionarem */
                date={currentDate}
                onNavigate={setCurrentDate}
                view={view}
                onView={setView}

                views={['month', 'agenda']}
                defaultView="month"
                toolbar

                events={agendamentos}
                startAccessor="start"
                endAccessor="end"

                selectable={false}
                onSelectEvent={handleSelectEvent}

                messages={{
                  previous: 'Anterior',
                  today: 'Hoje',
                  next: 'Próximo',
                  month: 'Mês',
                  agenda: 'Agenda',
                  showMore: total => `+${total} mais`,
                }}

                formats={{
                  agendaHeaderFormat: ({ start, end }) =>
                    `${moment(start).format('DD/MM/YYYY')} – ${moment(end).format('DD/MM/YYYY')}`,
                }}

                eventPropGetter={event => {
                  const hoje = new Date(); hoje.setHours(0,0,0,0);
                  const inicio = event.start;
                  const s = event.resource.status;
                  let bg = '#FFFFFF';
                  if      (s === 'iniciado')                        bg = '#006400';
                  else if (s === 'agendado' && inicio < hoje)       bg = '#8B0000';
                  else if (s === 'agendado' &&
                          inicio.toDateString() === hoje.toDateString()) bg = '#FFA500';
                  else if (s === 'agendado')                        bg = '#90EE90';
                  else if (s === 'concluido')                       bg = '#00008B';
                  return { style: {
                    backgroundColor: bg,
                    color: getContrastColor(bg),
                    borderRadius: 4,
                    border: '1px solid #aaa'
                  }};
                }}

                components={{
                  event: ({ event }) => (
                    <div className={styles.eventoNoCalendario}>{event.title}</div>
                  ),
                  agenda: {
                    time: () => null,   // remove coluna “Time” na agenda
                  }
                }}

                style={{
                  height: 600,
                  backgroundColor: '#fff',
                  borderRadius: 8,
                }}
              />
            </div>
          </div>
        </div>
      )}
     <Modal
        isOpen={modalAgendamentoOpen}
        onClose={() => setModalAgendamentoOpen(false)}
        title="Agendar Manutenção"
      >
        <form onSubmit={handleCriarAgendamento}>
          <div className={styles.formGroup}>
            <label>Descrição</label>
            <input
              value={descAgendamento}
              onChange={e => setDescAgendamento(e.target.value)}
              className={styles.input}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>Itens do Checklist (um por linha)</label>
            <textarea
              value={itensChecklistAgendamento}
              onChange={e => setItensChecklistAgendamento(e.target.value)}
              className={styles.textarea}
              rows="5"
              required
            />
          </div>
          <button type="submit" className={styles.button}>
            Salvar Agendamento
          </button>
        </form>
      </Modal>

      {/* Modal para VER DETALHES e INICIAR a manutenção */}
      <Modal
        isOpen={!!eventoSelecionado}
        onClose={() => setEventoSelecionado(null)}
        title={eventoSelecionado?.title}
      >
        {eventoSelecionado && (
          <div className={styles.modalDetails}>
            <p>
              <strong>Descrição:</strong> {eventoSelecionado.resource.descricao}
            </p>
            <p>
              <strong>Data:</strong>{" "}
              {eventoSelecionado.start.toLocaleDateString("pt-BR")}
            </p>
            <p><strong>Status:</strong> {eventoSelecionado.resource.status}</p>

            {eventoSelecionado.resource.itensChecklist && (
              <>
                <h4>Checklist da Tarefa:</h4>
                <ul>
                  {eventoSelecionado.resource.itensChecklist.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </>
            )}
            {eventoSelecionado.resource.status !== 'iniciado' && eventoSelecionado.resource.status !== 'concluido'&&(
              <button
                className={styles.modalButton}
                onClick={() => handleIniciarManutencao(eventoSelecionado)}
              >
                Iniciar Manutenção Agora
              </button>
            )}
          </div>
        )}
      </Modal>

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