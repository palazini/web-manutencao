import React, { useState, useEffect, useMemo } from 'react';
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  query,
  onSnapshot,
  orderBy,
  serverTimestamp,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/pt-br';
import 'moment/locale/es';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import Modal from '../components/Modal.jsx';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import styles from './CalendarioGeralPage.module.css';
import { useTranslation } from 'react-i18next';
import { df } from '../i18n/format';

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

export default function CalendarioGeralPage({ user }) {
  const { t, i18n } = useTranslation();

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

  // Templates (para importar checklist)
  const [templates, setTemplates]             = useState([]);
  const [selTemplate, setSelTemplate]         = useState('');

  const intervalDays = 90;

  // aplica locale do moment conforme idioma atual
  useEffect(() => {
    moment.locale(i18n.language?.startsWith('es') ? 'es' : 'pt-br');
  }, [i18n.language]);

  const fmtDate = useMemo(
    () => df({ dateStyle: 'short' }), // Intl com idioma atual
    [i18n.language]
  );

  // carrega agendamentos
  useEffect(() => {
    const q = query(collection(db, 'agendamentosPreventivos'), orderBy('start'));
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

  // últimos templates para importar checklist
  useEffect(() => {
    const tplQuery = query(
      collection(db, 'agendamentosPreventivos'),
      orderBy('criadoEm', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(tplQuery, snap => {
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id:          d.id,
          maquinaNome: data.maquinaNome,
          date:        data.criadoEm?.toDate?.() || new Date(),
          itens:       data.itensChecklist || []
        };
      });
      setTemplates(list);
    });
    return () => unsub();
  }, []);

  const getContrastColor = (bg) => {
    const r = parseInt(bg.slice(1,3),16),
          g = parseInt(bg.slice(3,5),16),
          b = parseInt(bg.slice(5,7),16);
    const yiq = (r*299 + g*587 + b*114)/1000;
    return yiq >= 128 ? '#000' : '#fff';
  };

  const handleSelectEvent = (e) => setSelectedEvent(e);

  const handleSelectSlot = (info) => {
    if (user?.role !== 'gestor') return;
    setSlotInfo(info);
    setSelMachine('');
    setDescAgendamento('');
    setChecklistTxt('');
    setSelTemplate('');
    setShowNew(true);
  };

  const handleSubmitNew = async (e) => {
    e.preventDefault();
    const itensArray = checklistTxt
      .split('\n')
      .map(i => i.trim())
      .filter(Boolean);
    if (!selMachine || !descAgendamento || itensArray.length === 0) {
      return toast.error(t('calendarioGeral.toasts.fillAll'));
    }
    await addDoc(collection(db, 'agendamentosPreventivos'), {
      maquinaId:       selMachine,
      maquinaNome:     machines.find(m => m.id === selMachine).nome,
      descricao:       descAgendamento,
      itensChecklist:  itensArray,
      originalStart:   slotInfo.start,
      originalEnd:     slotInfo.end,
      start:           slotInfo.start,
      end:             slotInfo.end,
      criadoEm:        serverTimestamp(),
      status:          'agendado'
    });
    toast.success(t('calendarioGeral.toasts.created'));
    setShowNew(false);
  };

  const handleIniciarManutencao = async (event) => {
    if (!window.confirm(t('calendarioGeral.confirm.startNow', { title: event.title }))) return;
    try {
      await addDoc(collection(db, 'chamados'), {
        maquina:       event.resource.maquinaNome,
        descricao:     t('calendarioGeral.generated.callDesc', { title: event.title }),
        status:        'Aberto',
        tipo:          'preventiva',
        checklist:     (event.resource.itensChecklist || []).map(item => ({ item, resposta: 'sim' })),
        agendamentoId: event.id,
        operadorNome:  t('calendarioGeral.generated.openedBy', { name: user.nome }),
        dataAbertura:  serverTimestamp()
      });
      const ref = doc(db, 'agendamentosPreventivos', event.id);
      await updateDoc(ref, { status: 'iniciado' });
      toast.success(t('calendarioGeral.toasts.callCreated'));
      setSelectedEvent(null);
    } catch (err) {
      console.error(err);
      toast.error(t('calendarioGeral.toasts.startFail'));
    }
  };

  const handleDeleteAgendamento = async () => {
    if (!window.confirm(t('calendarioGeral.confirm.delete', { title: selectedEvent.title }))) return;
    try {
      await deleteDoc(doc(db, 'agendamentosPreventivos', selectedEvent.id));
      toast.success(t('calendarioGeral.toasts.deleted'));
      setSelectedEvent(null);
    } catch (err) {
      console.error(err);
      toast.error(t('calendarioGeral.toasts.deleteFail'));
    }
  };

  return (
    <>
      <header style={{ padding: '20px', backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>{t('calendarioGeral.title')}</h1>
      </header>

      <div className={styles.calendarContainer}>
        <div className={styles.legend}>
          <div><span className={styles.legendBox} style={{backgroundColor:'#8B0000'}}/> {t('calendarioGeral.legend.overdue')}</div>
          <div><span className={styles.legendBox} style={{backgroundColor:'#FFA500'}}/> {t('calendarioGeral.legend.today')}</div>
          <div><span className={styles.legendBox} style={{backgroundColor:'#90EE90'}}/> {t('calendarioGeral.legend.future')}</div>
          <div><span className={styles.legendBox} style={{backgroundColor:'#006400'}}/> {t('calendarioGeral.legend.started')}</div>
          <div><span className={styles.legendBox} style={{backgroundColor:'#00008B'}}/> {t('calendarioGeral.legend.finished')}</div>
          <div><span className={styles.legendBox} style={{backgroundColor:'#8B008B'}}/> {t('calendarioGeral.legend.finishedLate')}</div>
        </div>

        <div className={styles.calendarWrapper}>
          {loading ? (
            <p style={{ padding: 20 }}>{t('calendarioGeral.loading')}</p>
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
                previous: t('calendar.previous'),
                today: t('calendar.today'),
                next: t('calendar.next'),
                month: t('calendar.month'),
                agenda: t('calendar.agenda'),
                showMore: (total) => t('calendar.showMore', { total })
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
                  ? ({ event, start, end }) =>
                      updateDoc(doc(db, 'agendamentosPreventivos', event.id), { start, end })
                        .catch(() => toast.error(t('calendarioGeral.toasts.rescheduleFail')))
                  : undefined
              }
              eventPropGetter={(event) => {
                const hoje = new Date(); hoje.setHours(0,0,0,0);
                const inicio = event.start;
                const s = event.resource.status;
                let bg = '#FFFFFF';
                if      (s === 'iniciado')                                    bg = '#006400';
                else if (s === 'agendado' && inicio < hoje)                   bg = '#8B0000';
                else if (s === 'agendado' && inicio.toDateString() === hoje.toDateString()) bg = '#FFA500';
                else if (s === 'agendado')                                    bg = '#90EE90';
                else if (event.resource.atrasado)                             bg = '#8B008B';
                else if (s === 'concluido')                                   bg = '#00008B';
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
                event: ({ event }) => <div className={styles.eventoNoCalendario}>{event.title}</div>,
                agenda: { time: () => null }
              }}
              style={{ height: 600, backgroundColor: '#fff', borderRadius: 8 }}
            />
          )}
        </div>
      </div>

      {/* Modal de detalhes do evento */}
      <Modal isOpen={!!selectedEvent} onClose={() => setSelectedEvent(null)} title={selectedEvent?.title}>
        {selectedEvent && (
          <div className={styles.modalDetails}>
            <p><strong>{t('calendarioGeral.details.machine')}</strong> {selectedEvent.resource.maquinaNome}</p>
            <p><strong>{t('calendarioGeral.details.description')}</strong> {selectedEvent.resource.descricao}</p>

            <p><strong>{t('calendarioGeral.details.currentDate')}</strong> {fmtDate.format(selectedEvent.start)}</p>
            {selectedEvent.resource.originalStart && (
              <p>
                <strong>{t('calendarioGeral.details.originalDate')}</strong>{' '}
                {fmtDate.format(selectedEvent.resource.originalStart.toDate())}
              </p>
            )}

            <p><strong>{t('calendarioGeral.details.status')}</strong> {selectedEvent.resource.status}</p>
            {selectedEvent.resource.concluidoEm && (
              <p>
                <strong>{t('calendarioGeral.details.finishedAt')}</strong>{' '}
                {fmtDate.format(selectedEvent.resource.concluidoEm.toDate())}
              </p>
            )}

            {selectedEvent.resource.itensChecklist?.length > 0 && (
              <>
                <h4>{t('calendarioGeral.details.checklistTitle')}</h4>
                <ul>
                  {selectedEvent.resource.itensChecklist.map((item, i) => (
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
                  {t('calendarioGeral.actions.startNow')}
                </button>
            )}

            {user.role === 'gestor' && (
              <button
                className={styles.modalButton}
                style={{ marginTop: 10, backgroundColor: '#d32f2f', color: '#fff' }}
                onClick={handleDeleteAgendamento}
              >
                {t('calendarioGeral.actions.delete')}
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Modal de novo agendamento */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title={t('calendarioGeral.new.title')}>
        <form onSubmit={handleSubmitNew}>
          <div className={styles.formGroup}>
            <label>{t('calendarioGeral.new.machine')}</label>
            <select
              value={selMachine}
              onChange={e => setSelMachine(e.target.value)}
              className={styles.select}
              required
            >
              <option value="" disabled>{t('calendarioGeral.new.selectPlaceholder')}</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>{t('calendarioGeral.new.description')}</label>
            <input
              value={descAgendamento}
              onChange={e => setDescAgendamento(e.target.value)}
              className={styles.input}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>{t('calendarioGeral.new.importTemplate')}</label>
            <select
              value={selTemplate}
              onChange={e => {
                const id = e.target.value;
                setSelTemplate(id);
                const tpl = templates.find(tpl => tpl.id === id);
                setChecklistTxt(tpl ? (tpl.itens || []).join('\n') : '');
              }}
              className={styles.select}
            >
              <option value="">{t('calendarioGeral.new.none')}</option>
              {templates.map(tpl => (
                <option key={tpl.id} value={tpl.id}>
                  {`${tpl.maquinaNome} — ${fmtDate.format(tpl.date)}`}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>{t('calendarioGeral.new.itemsLabel')}</label>
            <textarea
              value={checklistTxt}
              onChange={e => setChecklistTxt(e.target.value)}
              className={styles.textarea}
              rows="5"
              required
            />
          </div>
          <button type="submit" className={styles.button}>
            {t('calendarioGeral.new.save')}
          </button>
        </form>
      </Modal>
    </>
  );
}
