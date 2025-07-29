// src/pages/CalendarioGeralPage.jsx

import React, { useState, useEffect } from 'react';
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  query,
  onSnapshot,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import Modal from '../components/Modal.jsx';
import 'moment/locale/pt-br';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import styles from './CalendarioGeralPage.module.css';

moment.locale('pt-br');
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

export default function CalendarioGeralPage({ user }) {
  const [events, setEvents]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [currentDate, setCurrentDate]     = useState(new Date());
  const [view, setView]                   = useState('month');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showNew, setShowNew]             = useState(false);
  const [slotInfo, setSlotInfo]           = useState(null);

  const [machines, setMachines]               = useState([]);
  const [selMachine, setSelMachine]           = useState('');
  const [descAgendamento, setDescAgendamento] = useState('');
  const [checklistTxt, setChecklistTxt]       = useState('');

  const intervalDays = 90;

  // carrega agendamentos
  useEffect(() => {
    const q = query(
      collection(db, 'agendamentosPreventivos'),
      orderBy('start')
    );
    const unsub = onSnapshot(q, snap => {
      const evs = snap.docs.map(d => {
        const data = d.data();
        return {
          id:       d.id,
          title:    `${data.maquinaNome}: ${data.descricao}`,
          start:    data.start.toDate(),
          end:      data.end.toDate(),
          allDay:   true,
          resource: data
        };
      });
      setEvents(evs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // carrega máquinas para dropdown
  useEffect(() => {
    const q = query(collection(db, 'maquinas'), orderBy('nome'));
    const unsub = onSnapshot(q, snap => {
      setMachines(snap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
    });
    return () => unsub();
  }, []);

  const getContrastColor = bg => {
    const r = parseInt(bg.slice(1,3),16),
          g = parseInt(bg.slice(3,5),16),
          b = parseInt(bg.slice(5,7),16);
    const yiq = (r*299 + g*587 + b*114)/1000;
    return yiq >= 128 ? '#000' : '#fff';
  };

  const handleSelectEvent = e => {
    setSelectedEvent(e);
  };

  const handleSelectSlot = info => {
    if (user?.role !== 'gestor') return;
    setSlotInfo(info);
    setSelMachine('');
    setDescAgendamento('');
    setChecklistTxt('');
    setShowNew(true);
  };

  const handleSubmitNew = async e => {
    e.preventDefault();
    const itensArray = checklistTxt
      .split('\n')
      .map(i => i.trim())
      .filter(Boolean);
    if (!selMachine || !descAgendamento || itensArray.length === 0) {
      return toast.error('Preencha todos os campos.');
    }
    await addDoc(collection(db, 'agendamentosPreventivos'), {
      maquinaId:       selMachine,
      maquinaNome:     machines.find(m => m.id === selMachine).nome,
      descricao:       descAgendamento,
      itensChecklist:  itensArray,
      start:           slotInfo.start,
      end:             slotInfo.end,
      criadoEm:        serverTimestamp(),
      status:          'agendado'
    });
    toast.success('Agendamento criado!');
    setShowNew(false);
  };

  const handleIniciarManutencao = async event => {
    if (!window.confirm(`Iniciar manutenção "${event.title}" agora?`)) return;
    try {
      await addDoc(collection(db, 'chamados'), {
        maquina:       event.resource.maquinaNome,
        descricao:     `Manutenção preventiva agendada: ${event.title}`,
        status:        'Aberto',
        tipo:          'preventiva',
        checklist:     event.resource.itensChecklist.map(item => ({ item, resposta: 'sim' })),
        agendamentoId: event.id,
        operadorNome:  `Sistema (Iniciado por ${user.nome})`,
        dataAbertura:  serverTimestamp(),
      });
      const ref = doc(db, 'agendamentosPreventivos', event.id);
      await updateDoc(ref, { status: 'iniciado' });
      toast.success('Chamado criado e agendamento iniciado!');
      setSelectedEvent(null);
    } catch (err) {
      console.error(err);
      toast.error('Falha ao iniciar manutenção.');
    }
  };

  return (
    <>
      <header style={{
        padding: '20px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <h1>Calendário Geral de Manutenções</h1>
      </header>

      <div className={styles.calendarContainer}>
        <div className={styles.legend}>
          <div><span className={styles.legendBox} style={{backgroundColor:'#8B0000'}}/> Vencido</div>
          <div><span className={styles.legendBox} style={{backgroundColor:'#FFA500'}}/> Hoje</div>
          <div><span className={styles.legendBox} style={{backgroundColor:'#90EE90'}}/> Futuro</div>
          <div><span className={styles.legendBox} style={{backgroundColor:'#006400'}}/> Iniciado</div>
          <div><span className={styles.legendBox} style={{backgroundColor:'#00008B'}}/> Concluído</div>
        </div>

        <div className={styles.calendarWrapper}>
          {loading ? (
            <p style={{ padding: 20 }}>Carregando agendamentos...</p>
          ) : (
            <DnDCalendar
              localizer={localizer}

              date={currentDate}
              onNavigate={setCurrentDate}
              view={view}
              onView={setView}
              length={intervalDays}

              views={['month','agenda']}
              defaultView="month"
              toolbar

              messages={{
                previous: 'Anterior',
                today:    'Hoje',
                next:     'Próximo',
                month:    'Mês',
                agenda:   'Agenda',
                showMore: total => `+${total} mais`
              }}

              formats={{
                agendaHeaderFormat: ({ start, end }) =>
                  `${moment(start).format('DD/MM/YYYY')} – ${moment(end).format('DD/MM/YYYY')}`
              }}

              events={events}
              startAccessor="start"
              endAccessor="end"

              selectable={user?.role === 'gestor'}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}

              draggableAccessor={() => user?.role === 'gestor'}
              onEventDrop={
                user?.role === 'gestor'
                  ? ({ event, start, end }) => {
                      const ref = doc(db, 'agendamentosPreventivos', event.id);
                      updateDoc(ref, { start, end }).catch(() => toast.error('Falha ao reagendar'));
                    }
                  : undefined
              }

              eventPropGetter={event => {
                const hoje   = new Date(); hoje.setHours(0,0,0,0);
                const inicio = event.start;
                const s      = event.resource.status;
                let bg = '#FFFFFF';
                if      (s === 'iniciado')                                  bg = '#006400';
                else if (s === 'agendado' && inicio < hoje)                  bg = '#8B0000';
                else if (s === 'agendado' && inicio.toDateString()===hoje.toDateString()) bg = '#FFA500';
                else if (s === 'agendado')                                  bg = '#90EE90';
                else if (s === 'concluido')                                 bg = '#00008B';
                return { style: {
                  backgroundColor: bg,
                  color:           getContrastColor(bg),
                  borderRadius:    4,
                  border:          '1px solid #aaa'
                }};
              }}

              components={{
                event: ({ event }) => (
                  <div className={styles.eventoNoCalendario}>
                    {event.title}
                  </div>
                ),
                agenda: { time: () => null }
              }}

              style={{ height: 600, backgroundColor: '#fff', borderRadius: 8 }}
            />
          )}
        </div>
      </div>

      {/* Modal de detalhes do evento */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title}
      >
        {selectedEvent && (
          <div className={styles.modalDetails}>
            <p><strong>Máquina:</strong> {selectedEvent.resource.maquinaNome}</p>
            <p><strong>Descrição:</strong> {selectedEvent.resource.descricao}</p>
            <p>
              <strong>Data:</strong>{" "}
              {selectedEvent.start.toLocaleDateString("pt-BR")}
            </p>
            <p><strong>Status:</strong> {selectedEvent.resource.status}</p>
            {selectedEvent.resource.itensChecklist && (
              <>
                <h4>Checklist da Tarefa:</h4>
                <ul>
                  {selectedEvent.resource.itensChecklist.map((item,i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </>
            )}
            {selectedEvent.resource.status !== 'iniciado' &&
              selectedEvent.resource.status !== 'concluido' &&
              (user.role === 'manutentor' || user.role === 'gestor') && (
                <button
                  className={styles.modalButton}
                  onClick={() => handleIniciarManutencao(selectedEvent)}
                >
                  Iniciar Manutenção Agora
                </button>
            )}
          </div>
        )}
      </Modal>

      {/* Modal de novo agendamento */}
      <Modal
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        title="Agendar Manutenção"
      >
        <form onSubmit={handleSubmitNew}>
          <div className={styles.formGroup}>
            <label>Máquina</label>
            <select
              value={selMachine}
              onChange={e => setSelMachine(e.target.value)}
              className={styles.select}
              required
            >
              <option value="" disabled>Selecione...</option>
              {machines.map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
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
              value={checklistTxt}
              onChange={e => setChecklistTxt(e.target.value)}
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
    </>
  );
}
