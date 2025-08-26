import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase.js';
import {
  doc, onSnapshot, collection, query, where, orderBy,
  updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import styles from './MaquinaDetalhePage.module.css';
import { FiPlus, FiTrash2, FiCheckCircle, FiXCircle, FiDownload } from 'react-icons/fi';
import { QRCodeCanvas } from 'qrcode.react';
import Modal from '../components/Modal.jsx';

import { Calendar } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

import { dateFnsLocalizer } from 'react-big-calendar';
import { ptBR } from 'date-fns/locale';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import moment from 'moment';
import 'moment/locale/pt-br';

import { useTranslation } from 'react-i18next';
import { df, statusKey } from '../i18n/format';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({
  format,
  parse: (value, formatStr) => parse(value, formatStr, new Date(), { locale: ptBR }),
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }),
  getDay,
  locales,
});
const DnDCalendar = withDragAndDrop(Calendar);

const MaquinaDetalhePage = ({ user }) => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const [maquina, setMaquina] = useState(null);
  const [chamadosConcluidos, setChamadosConcluidos] = useState([]);
  const [chamadosAtivos, setChamadosAtivos] = useState([]);
  const [historicoChecklist, setHistoricoChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ativos');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [eventosPreventivos, setEventosPreventivos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [modalAgendamentoOpen, setModalAgendamentoOpen] = useState(false);
  const [dadosAgendamento, setDadosAgendamento] = useState(null);
  const [descAgendamento, setDescAgendamento] = useState('');
  const [itensChecklistAgendamento, setItensChecklistAgendamento] = useState('');
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [novoItemChecklist, setNovoItemChecklist] = useState('');
  const qrCodeRef = useRef(null);

  const fmtDate = useMemo(() => df({ dateStyle: 'short' }), [i18n.language]);

  useEffect(() => {
    const maquinaDocRef = doc(db, 'maquinas', id);
    const unsubMaquina = onSnapshot(maquinaDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const maquinaData = { id: docSnap.id, ...docSnap.data() };
        setMaquina(maquinaData);

        const unsubAgendamentos = onSnapshot(
          query(collection(db, 'agendamentosPreventivos'), where('maquinaId', '==', maquinaData.id)),
          (snapshot) => {
            const eventos = snapshot.docs.map(d => {
              const data = d.data();
              return {
                id: d.id,
                title: data.descricao,
                start: data.start.toDate(),
                end: data.end.toDate(),
                allDay: true,
                resource: data
              };
            });
            setAgendamentos(eventos);
          }
        );

        const unsubAtivos = onSnapshot(
          query(
            collection(db, 'chamados'),
            where('maquina', '==', maquinaData.nome),
            where('status', 'in', ['Aberto', 'Em Andamento']),
            orderBy('dataAbertura', 'desc')
          ),
          (s) => setChamadosAtivos(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        const unsubConcluidos = onSnapshot(
          query(
            collection(db, 'chamados'),
            where('maquina', '==', maquinaData.nome),
            where('status', '==', 'Concluído'),
            orderBy('dataAbertura', 'desc')
          ),
          (s) => setChamadosConcluidos(s.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        const unsubPlanos = onSnapshot(
          query(collection(db, 'planosPreventivos'), where('maquina', '==', maquinaData.nome)),
          (snapshot) => {
            const eventos = snapshot.docs.map((d) => {
              const data = d.data();
              const proximaData = data.proximaData?.toDate?.() || null;
              return {
                id: d.id,
                title: data.descricao,
                start: proximaData || new Date(),
                end: proximaData || new Date(),
                allDay: true,
                resource: data
              };
            });
            setEventosPreventivos(eventos);
          }
        );

        const hoje = new Date();
        const dataInicio = new Date();
        dataInicio.setDate(hoje.getDate() - 30);
        const unsubSubmissoes = onSnapshot(
          query(
            collection(db, 'checklistSubmissions'),
            where('maquinaId', '==', maquinaData.id),
            where('dataSubmissao', '>=', dataInicio)
          ),
          (snapshot) => {
            const submissions = snapshot.docs.map(d => ({ ...d.data(), dataSubmissao: d.data().dataSubmissao.toDate() }));
            processarHistoricoChecklist(submissions);
          }
        );

        setLoading(false);
        return () => { unsubAgendamentos(); unsubAtivos(); unsubConcluidos(); unsubPlanos(); unsubSubmissoes(); };
      } else {
        setMaquina(null);
        setLoading(false);
      }
    });
    return () => unsubMaquina();
  }, [id]);

  const handleAdicionarItemChecklist = async () => {
    if (novoItemChecklist.trim() === '') {
      toast.error(t('maquinaDetalhe.toasts.itemEmpty'));
      return;
    }
    try {
      await updateDoc(doc(db, 'maquinas', id), { checklistDiario: arrayUnion(novoItemChecklist) });
      toast.success(t('maquinaDetalhe.toasts.itemAdded'));
      setNovoItemChecklist('');
    } catch (e) {
      console.error(e);
      toast.error(t('maquinaDetalhe.toasts.itemAddError'));
    }
  };

  const handleRemoverItemChecklist = async (itemParaRemover) => {
    if (!window.confirm(t('maquinaDetalhe.checklist.confirmRemove', { item: itemParaRemover }))) return;
    try {
      await updateDoc(doc(db, 'maquinas', id), { checklistDiario: arrayRemove(itemParaRemover) });
      toast.success(t('maquinaDetalhe.toasts.itemRemoved'));
    } catch (e) {
      console.error(e);
      toast.error(t('maquinaDetalhe.toasts.itemRemoveError'));
    }
  };

  const processarHistoricoChecklist = (submissoes) => {
    const relatorio = {};
    const hoje = new Date();
    for (let i = 0; i < 30; i++) {
      const dia = new Date();
      dia.setDate(hoje.getDate() - i);
      const diaString = dia.toLocaleDateString('pt-BR'); // interno
      relatorio[diaString] = {
        dataObj: dia,
        turno1: { status: 'Pendente', submission: null },
        turno2: { status: 'Pendente', submission: null },
      };
    }
    submissoes.forEach(sub => {
      const dataSub = sub.dataSubmissao;
      const diaString = dataSub.toLocaleDateString('pt-BR');
      const minutosAtuais = dataSub.getHours() * 60 + dataSub.getMinutes();
      const inicioTurno2 = 15 * 60 + 18;
      const turno = minutosAtuais < inicioTurno2 ? 'turno1' : 'turno2';
      if (relatorio[diaString]) {
        relatorio[diaString][turno] = { status: 'Entregue', operador: sub.operadorNome, submission: sub };
      }
    });
    setHistoricoChecklist(Object.values(relatorio).sort((a, b) => b.dataObj - a.dataObj));
  };

  const handleShowDetails = (submission) => {
    if (submission) setSelectedSubmission(submission);
  };

  const getStatusClass = (tipo) => {
    switch (tipo) {
      case 'corretiva': return styles.corretiva;
      case 'preventiva': return styles.preventiva;
      case 'preditiva': return styles.preditiva;
      default: return styles.normal;
    }
  };

  const handleDownloadQRCode = () => {
    const canvas = qrCodeRef.current?.querySelector('canvas');
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      const downloadLink = document.createElement('a');
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

  const handleSelectEvent = (event) => setEventoSelecionado(event);

  const handleCriarAgendamento = async (e) => {
    e.preventDefault();
    const itensArray = itensChecklistAgendamento.split('\n').filter(item => item.trim() !== '');
    if (!descAgendamento || itensArray.length === 0) {
      toast.error(t('maquinaDetalhe.agendar.errors.missing'));
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
        status: 'agendado',
      });
      toast.success(t('maquinaDetalhe.agendar.toasts.created'));
      setModalAgendamentoOpen(false);
      setDescAgendamento('');
      setItensChecklistAgendamento('');
    } catch (error) {
      console.error(error);
      toast.error(t('maquinaDetalhe.agendar.toasts.error'));
    }
  };

  const handleIniciarManutencao = async (agendamento) => {
    if (!window.confirm(t('maquinaDetalhe.evento.confirmStart', { title: agendamento.title }))) return;
    try {
      const chamadoRef = await addDoc(collection(db, 'chamados'), {
        maquina: agendamento.resource.maquinaNome,
        descricao: t('maquinaDetalhe.evento.callDesc', { title: agendamento.title }),
        status: 'Aberto',
        tipo: 'preventiva',
        checklist: agendamento.resource.itensChecklist.map(item => ({ item, resposta: 'sim' })),
        agendamentoId: agendamento.id,
        operadorNome: t('maquinaDetalhe.evento.openedBy', { name: user.nome }),
        dataAbertura: serverTimestamp(),
      });
      toast.success(t('maquinaDetalhe.evento.toasts.callCreated'));

      const agRef = doc(db, 'agendamentosPreventivos', agendamento.id);
      await updateDoc(agRef, { status: 'iniciado' });

      const unsubscribe = onSnapshot(chamadoRef, (snap) => {
        const data = snap.data();
        if (data?.status === 'Concluído') {
          updateDoc(agRef, { status: 'concluido' });
          unsubscribe();
        }
      });
      setEventoSelecionado(null);
    } catch (e) {
      console.error(e);
      toast.error(t('maquinaDetalhe.evento.toasts.startError'));
    }
  };

  const ListaDeChamados = ({ lista, titulo, mensagemVazia }) => (
    <div>
      <h2>{titulo}</h2>
      {lista.length === 0 ? <p>{mensagemVazia}</p> : (
        <ul className={styles.chamadoList}>
          {lista.map(chamado => {
            const tipoChamado = chamado.tipo || 'corretiva';
            const isConcluido = chamado.status === 'Concluído';
            const statusClass = isConcluido ? styles.concluidoCard : getStatusClass(tipoChamado);

            return (
              <Link to={`/maquinas/chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoCard}>
                <li className={`${styles.chamadoItem} ${statusClass}`}>
                  <strong>{chamado.descricao}</strong>
                  <p>
                    {t('maquinaDetalhe.listas.statusLabel', {
                      status: t(`status.${statusKey ? statusKey(chamado.status) : 'open'}`)
                    })}
                  </p>
                  <small>
                    {t('maquinaDetalhe.listas.openedAt', {
                      date: chamado.dataAbertura ? fmtDate.format(chamado.dataAbertura.toDate()) : 'N/A'
                    })}
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
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }

  if (loading) return <p style={{ padding: 20 }}>{t('maquinaDetalhe.loading')}</p>;
  if (!maquina) return <p style={{ padding: 20 }}>{t('maquinaDetalhe.notFound')}</p>;

  return (
    <>
      <header className={styles.header}>
        <h1>{maquina.nome}</h1>
        <p>{t('maquinaDetalhe.subtitle')}</p>
      </header>

      {user.role === 'gestor' ? (
        <div>
          <nav className={styles.tabs}>
            <button className={`${styles.tabButton} ${activeTab === 'ativos' ? styles.active : ''}`} onClick={() => setActiveTab('ativos')}>{t('maquinaDetalhe.tabs.active')}</button>
            <button className={`${styles.tabButton} ${activeTab === 'historico' ? styles.active : ''}`} onClick={() => setActiveTab('historico')}>{t('maquinaDetalhe.tabs.history')}</button>
            <button className={`${styles.tabButton} ${activeTab === 'preventiva' ? styles.active : ''}`} onClick={() => setActiveTab('preventiva')}>{t('maquinaDetalhe.tabs.preventive')}</button>
            <button className={`${styles.tabButton} ${activeTab === 'checklist' ? styles.active : ''}`} onClick={() => setActiveTab('checklist')}>{t('maquinaDetalhe.tabs.checklist')}</button>
            <button className={`${styles.tabButton} ${activeTab === 'qrcode' ? styles.active : ''}`} onClick={() => setActiveTab('qrcode')}>{t('maquinaDetalhe.tabs.qrcode')}</button>
          </nav>

          <div className={styles.tabContent}>
            {activeTab === 'ativos' && (
              <ListaDeChamados
                lista={chamadosAtivos}
                titulo={t('maquinaDetalhe.listas.activeTitle', { name: maquina.nome })}
                mensagemVazia={t('maquinaDetalhe.listas.activeEmpty')}
              />
            )}

            {activeTab === 'historico' && (
              <ListaDeChamados
                lista={chamadosConcluidos}
                titulo={t('maquinaDetalhe.listas.historyTitle', { name: maquina.nome })}
                mensagemVazia={t('maquinaDetalhe.listas.historyEmpty')}
              />
            )}

            {activeTab === 'preventiva' && (
              <div className={styles.planSection}>
                {/* legenda */}
                <div className={styles.legend}>
                  <div><span className={styles.legendBox} style={{ backgroundColor: '#8B0000' }}></span> {t('maquinaDetalhe.legend.overdue')}</div>
                  <div><span className={styles.legendBox} style={{ backgroundColor: '#FFA500' }}></span> {t('maquinaDetalhe.legend.today')}</div>
                  <div><span className={styles.legendBox} style={{ backgroundColor: '#90EE90' }}></span> {t('maquinaDetalhe.legend.future')}</div>
                  <div><span className={styles.legendBox} style={{ backgroundColor: '#006400' }}></span> {t('maquinaDetalhe.legend.started')}</div>
                  <div><span className={styles.legendBox} style={{ backgroundColor: '#00008B' }}></span> {t('maquinaDetalhe.legend.finished')}</div>
                </div>

                <div style={{ height: 600, marginTop: 20 }}>
                  <DnDCalendar
                    localizer={localizer}
                    date={currentDate}
                    onNavigate={setCurrentDate}
                    view={view}
                    onView={setView}
                    views={['month', 'agenda']}
                    defaultView="month"
                    length={30}
                    toolbar
                    events={agendamentos}
                    startAccessor="start"
                    endAccessor="end"
                    selectable={user.role === 'gestor'}
                    onSelectSlot={(slot) => {
                      setDadosAgendamento({ start: slot.start, end: slot.end });
                      setModalAgendamentoOpen(true);
                    }}
                    onSelectEvent={setEventoSelecionado}
                    onEventDrop={({ event, start, end }) => {
                      updateDoc(doc(db, 'agendamentosPreventivos', event.id), { start, end })
                        .catch(() => toast.error(t('maquinaDetalhe.agendar.toasts.rescheduleError')));
                    }}
                    messages={{
                      next: t('calendar.next'),
                      previous: t('calendar.previous'),
                      today: t('calendar.today'),
                      month: t('calendar.month'),
                      week: t('calendar.week'),
                      day: t('calendar.day'),
                      agenda: t('calendar.agenda'),
                      date: t('calendar.date'),
                      time: t('calendar.time'),
                      showMore: (total) => t('calendar.showMore', { total }),
                    }}
                    formats={{
                      agendaHeaderFormat: ({ start, end }) =>
                        `${moment(start).format('DD/MM/YYYY')} – ${moment(end).format('DD/MM/YYYY')}`
                    }}
                    eventPropGetter={event => {
                      const today = new Date(); today.setHours(0,0,0,0);
                      const startDate = event.start;
                      let bg;
                      if (event.resource.status === 'iniciado') bg = '#006400';
                      else if (event.resource.status === 'agendado') {
                        if (startDate < today) bg = '#8B0000';
                        else if (startDate.toDateString() === today.toDateString()) bg = '#FFA500';
                        else bg = '#90EE90';
                      } else if (event.resource.status === 'concluido') bg = '#00008B';
                      else bg = '#FFFFFF';
                      return {
                        style: {
                          backgroundColor: bg,
                          color: getContrastColor(bg),
                          borderRadius: 4,
                          border: '1px solid #aaa'
                        }
                      };
                    }}
                    components={{
                      event: ({ event }) => <div className={styles.eventoNoCalendario}>{event.title}</div>
                    }}
                    style={{ backgroundColor: 'white', borderRadius: 8, padding: 10 }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'checklist' && (
              <div className={styles.checklistEditor}>
                <h3>{t('maquinaDetalhe.checklist.title', { name: maquina.nome })}</h3>

                {(!maquina.checklistDiario || maquina.checklistDiario.length === 0) && (
                  <p>{t('maquinaDetalhe.checklist.empty')}</p>
                )}

                <ul className={styles.operatorList}>
                  {maquina.checklistDiario?.map((item, index) => (
                    <li key={index} className={styles.checklistItemManage}>
                      <span>{item}</span>
                      <button
                        onClick={() => handleRemoverItemChecklist(item)}
                        className={`${styles.opActionButton} ${styles.removeButton}`}
                        title={t('maquinaDetalhe.checklist.remove')}
                      >
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
                    placeholder={t('maquinaDetalhe.checklist.placeholder')}
                  />
                  <button onClick={handleAdicionarItemChecklist} className={styles.checklistAddButton}>
                    {t('maquinaDetalhe.checklist.add')}
                  </button>
                </div>

                <div className={styles.historyReport}>
                  <h3>{t('maquinaDetalhe.checklist.historyTitle')}</h3>
                  <div className={`${styles.dayEntry} ${styles.dayHeader}`}>
                    <span>{t('maquinaDetalhe.checklist.columns.date')}</span>
                    <span>{t('maquinaDetalhe.checklist.columns.turn1')}</span>
                    <span>{t('maquinaDetalhe.checklist.columns.turn2')}</span>
                  </div>
                  {historicoChecklist.map((entry) => (
                    <div key={entry.dataObj.toISOString()} className={styles.dayEntry}>
                      <span>{fmtDate.format(entry.dataObj)}</span>
                      <div
                        className={`${styles.turnStatus} ${entry.turno1.status === 'Entregue' ? styles.completed : styles.pending} ${entry.turno1.submission ? styles.clickable : ''}`}
                        onClick={() => handleShowDetails(entry.turno1.submission)}
                      >
                        {entry.turno1.status === 'Entregue' ? <FiCheckCircle /> : <FiXCircle />}
                        <span>{entry.turno1.operador || t('maquinaDetalhe.checklist.pending')}</span>
                      </div>
                      <div
                        className={`${styles.turnStatus} ${entry.turno2.status === 'Entregue' ? styles.completed : styles.pending} ${entry.turno2.submission ? styles.clickable : ''}`}
                        onClick={() => handleShowDetails(entry.turno2.submission)}
                      >
                        {entry.turno2.status === 'Entregue' ? <FiCheckCircle /> : <FiXCircle />}
                        <span>{entry.turno2.operador || t('maquinaDetalhe.checklist.pending')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'qrcode' && (
              <div className={styles.qrCodeSection}>
                <h3>{t('maquinaDetalhe.qrcode.title')}</h3>
                <p>{t('maquinaDetalhe.qrcode.info')}</p>

                <div ref={qrCodeRef} className={styles.qrCodeCanvas}>
                  <QRCodeCanvas
                    value={`${window.location.origin}/maquinas/${id}`}
                    size={256}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="L"
                    includeMargin
                  />
                </div>

                <button onClick={handleDownloadQRCode} className={styles.downloadButton}>
                  <FiDownload /> {t('maquinaDetalhe.qrcode.download')}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        // VISÃO DO MANUTENTOR
        <div className={styles.tabContent}>
          <ListaDeChamados
            lista={chamadosAtivos}
            titulo={t('maquinaDetalhe.listas.activeTitle', { name: maquina.nome })}
            mensagemVazia={t('maquinaDetalhe.listas.activeEmpty')}
          />
          <hr style={{ margin: '30px 0' }} />
          <ListaDeChamados
            lista={chamadosConcluidos}
            titulo={t('maquinaDetalhe.listas.historyTitle', { name: maquina.nome })}
            mensagemVazia={t('maquinaDetalhe.listas.historyEmpty')}
          />

          <hr style={{ margin: '30px 0' }} />
          <div className={styles.planSection}>
            <h3>{t('maquinaDetalhe.preventiveCalendar.title')}</h3>
            <p>{t('maquinaDetalhe.preventiveCalendar.subtitle')}</p>

            <div style={{ padding: 16, backgroundColor: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 8, marginTop: 20 }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: 12 }}>
                <div><span style={{ display: 'inline-block', width: 16, height: 16, backgroundColor: '#8B0000', marginRight: 4 }} />{t('maquinaDetalhe.legend.overdue')}</div>
                <div><span style={{ display: 'inline-block', width: 16, height: 16, backgroundColor: '#FFA500', marginRight: 4 }} />{t('maquinaDetalhe.legend.today')}</div>
                <div><span style={{ display: 'inline-block', width: 16, height: 16, backgroundColor: '#90EE90', marginRight: 4 }} />{t('maquinaDetalhe.legend.future')}</div>
                <div><span style={{ display: 'inline-block', width: 16, height: 16, backgroundColor: '#006400', marginRight: 4 }} />{t('maquinaDetalhe.legend.started')}</div>
                <div><span style={{ display: 'inline-block', width: 16, height: 16, backgroundColor: '#00008B', marginRight: 4 }} />{t('maquinaDetalhe.legend.finished')}</div>
              </div>

              <Calendar
                localizer={localizer}
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
                onSelectEvent={setEventoSelecionado}
                messages={{
                  previous: t('calendar.previous'),
                  today: t('calendar.today'),
                  next: t('calendar.next'),
                  month: t('calendar.month'),
                  agenda: t('calendar.agenda'),
                  showMore: (total) => t('calendar.showMore', { total }),
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
                  else if (s === 'agendado' && inicio.toDateString() === hoje.toDateString()) bg = '#FFA500';
                  else if (s === 'agendado')                        bg = '#90EE90';
                  else if (s === 'concluido')                       bg = '#00008B';
                  return { style: { backgroundColor: bg, color: getContrastColor(bg), borderRadius: 4, border: '1px solid #aaa' } };
                }}
                components={{
                  event: ({ event }) => <div className={styles.eventoNoCalendario}>{event.title}</div>,
                  agenda: { time: () => null }
                }}
                style={{ height: 600, backgroundColor: '#fff', borderRadius: 8 }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal: criar agendamento */}
      <Modal isOpen={modalAgendamentoOpen} onClose={() => setModalAgendamentoOpen(false)} title={t('maquinaDetalhe.agendar.title')}>
        <form onSubmit={handleCriarAgendamento}>
          <div className={styles.formGroup}>
            <label>{t('maquinaDetalhe.agendar.descricao')}</label>
            <input value={descAgendamento} onChange={e => setDescAgendamento(e.target.value)} className={styles.input} required />
          </div>
          <div className={styles.formGroup}>
            <label>{t('maquinaDetalhe.agendar.itensLabel')}</label>
            <textarea value={itensChecklistAgendamento} onChange={e => setItensChecklistAgendamento(e.target.value)} className={styles.textarea} rows="5" required />
          </div>
          <button type="submit" className={styles.button}>{t('maquinaDetalhe.agendar.save')}</button>
        </form>
      </Modal>

      {/* Modal: detalhes de evento e iniciar manutenção */}
      <Modal isOpen={!!eventoSelecionado} onClose={() => setEventoSelecionado(null)} title={eventoSelecionado?.title}>
        {eventoSelecionado && (
          <div className={styles.modalDetails}>
            <p><strong>{t('maquinaDetalhe.evento.descricao')} </strong>{eventoSelecionado.resource.descricao}</p>
            <p><strong>{t('maquinaDetalhe.evento.data')} </strong>{fmtDate.format(eventoSelecionado.start)}</p>
            <p><strong>{t('maquinaDetalhe.evento.status')} </strong>{eventoSelecionado.resource.status}</p>

            {eventoSelecionado.resource.itensChecklist && (
              <>
                <h4>{t('maquinaDetalhe.evento.checklistTitle')}</h4>
                <ul>
                  {eventoSelecionado.resource.itensChecklist.map((item, i) => (<li key={i}>{item}</li>))}
                </ul>
              </>
            )}

            {eventoSelecionado.resource.status !== 'iniciado' && eventoSelecionado.resource.status !== 'concluido' && (
              <button className={styles.modalButton} onClick={() => handleIniciarManutencao(eventoSelecionado)}>
                {t('maquinaDetalhe.evento.startNow')}
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Modal: detalhes da submissão do checklist */}
      <Modal
        isOpen={!!selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        title={t('maquinaDetalhe.submission.title', {
          date: selectedSubmission?.dataSubmissao ? fmtDate.format(selectedSubmission.dataSubmissao) : ''
        })}
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
