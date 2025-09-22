﻿import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/pt-br';
import 'moment/locale/es';
import toast from 'react-hot-toast';
import Modal from '../components/Modal.jsx';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import styles from './CalendarioGeralPage.module.css';
import { useTranslation } from 'react-i18next';
import { df } from '../i18n/format';

import {
  listarAgendamentos,
  criarAgendamento,
  atualizarAgendamento,
  excluirAgendamento,
  iniciarAgendamento
} from '../services/apiClient';
import { getMaquinas } from '../services/apiClient';
import { subscribeSSE } from "../services/sseClient";

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

// ---- Helper para garantir que tudo que vai para o JSX é string legível
function toPlainText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;

  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (x == null) return '';
        if (typeof x === 'string') return x;
        if (typeof x === 'object') {
          return x.texto ?? x.item ?? x.nome ?? x.label ?? x.key ?? '';
        }
        return String(x);
      })
      .filter(Boolean)
      .join(' • ');
  }

  if (typeof v === 'object') {
    return v.texto ?? v.item ?? v.nome ?? v.label ?? v.key ?? '';
  }

  try { return String(v); } catch { return ''; }
}

export default function CalendarioGeralPage({ user }) {
  const { t, i18n } = useTranslation();

  const [events, setEvents]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [currentDate, setCurrentDate]     = useState(new Date());
  const [view, setView]                   = useState('month');
  const [reloadTick, setReloadTick]       = useState(0);
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
    () => df({ dateStyle: 'short' }),
    [i18n.language]
  );

  // SSE para reagir a mudanças de agendamentos
  useEffect(() => {
    const unsubscribe = subscribeSSE((msg) => {
      if (msg?.topic === 'agendamentos') {
        setReloadTick((n) => n + 1);
      }
    });
    return () => unsubscribe();
  }, []);

  // carrega agendamentos do mês visível
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const from = new Date(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
        const to   = new Date(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
        const lista = await listarAgendamentos({
          from: from.toISOString(),
          to:   to.toISOString()
        });
        if (!alive) return;

        const evs = lista.map(a => {
          // itens_checklist pode ser array de strings/objetos — manter array para o modal e normalizar na renderização
          const itensArr = Array.isArray(a.itens_checklist) ? a.itens_checklist : [];
          const titulo = `${toPlainText(a.maquina_nome)}: ${toPlainText(a.descricao)}`;

          return {
            id: a.id,
            title: toPlainText(titulo),
            start: new Date(a.start_ts),
            end:   new Date(a.end_ts),
            allDay: true,
            resource: {
              maquinaNome: toPlainText(a.maquina_nome),
              descricao: toPlainText(a.descricao),
              itensChecklist: itensArr, // será normalizado no render
              originalStart: a.original_start ? new Date(a.original_start) : null,
              originalEnd:   a.original_end   ? new Date(a.original_end)   : null,
              status: a.status,
              concluidoEm: a.concluido_em ? new Date(a.concluido_em) : null,
              atrasado: !!a.atrasado
            }
          };
        });

        setEvents(evs);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [currentDate.getFullYear(), currentDate.getMonth(), reloadTick]);

  // carrega máquinas para dropdown
  useEffect(() => {
    (async () => {
      try {
        const lista = await getMaquinas();
        setMachines(lista.map(m => ({ id: m.id, nome: toPlainText(m.nome) })));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // últimos templates para importar checklist
  useEffect(() => {
    (async () => {
      try {
        const ultimos = await listarAgendamentos({ limit: 5, order: 'recent' });
        setTemplates(ultimos.map(a => ({
          id: a.id,
          maquinaNome: toPlainText(a.maquina_nome),
          date: a.criado_em ? new Date(a.criado_em) : new Date(),
          itens: Array.isArray(a.itens_checklist) ? a.itens_checklist : []
        })));
      } catch (e) {
        console.error(e);
      }
    })();
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
      .map(i => toPlainText(i).trim())
      .filter(Boolean);

    if (!selMachine || !descAgendamento || itensArray.length === 0) {
      return toast.error(t('calendarioGeral.toasts.fillAll'));
    }

    await criarAgendamento({
      maquinaId: selMachine,
      descricao: toPlainText(descAgendamento),
      itensChecklist: itensArray,
      start: slotInfo.start.toISOString(),
      end:   slotInfo.end.toISOString()
    });

    toast.success(t('calendarioGeral.toasts.created'));
    setShowNew(false);
    setReloadTick((n) => n + 1);
    // recarrega mês atual
    setCurrentDate(new Date(currentDate));
  };

  const handleIniciarManutencao = async (event) => {
    if (!window.confirm(t('calendarioGeral.confirm.startNow', { title: event.title }))) return;
    try {
      await iniciarAgendamento(event.id, {
        criadoPorEmail: user.email,
        role: user.role,
        email: user.email
      });
      toast.success(t('calendarioGeral.toasts.callCreated'));
      setSelectedEvent(null);
      setReloadTick((n) => n + 1);
      setCurrentDate(new Date(currentDate));
    } catch (err) {
      console.error(err);
      toast.error(t('calendarioGeral.toasts.startFail'));
    }
  };

  const handleDeleteAgendamento = async () => {
    if (!window.confirm(t('calendarioGeral.confirm.delete', { title: selectedEvent.title }))) return;
    try {
      await excluirAgendamento(selectedEvent.id, {
        "x-user-role": user.role,
        "x-user-email": user.email
      });
      toast.success(t('calendarioGeral.toasts.deleted'));
      setSelectedEvent(null);
      setReloadTick((n) => n + 1);
      setCurrentDate(new Date(currentDate));
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
                  ? async ({ event, start, end }) => {
                      const previousStart = event.start;
                      const previousEnd = event.end;
                      const nextStart = new Date(start);
                      const nextEnd = new Date(end);

                      setEvents((prevEvents) =>
                        prevEvents.map((ev) =>
                          ev.id === event.id ? { ...ev, start: nextStart, end: nextEnd } : ev
                        )
                      );

                      try {
                        await atualizarAgendamento(
                          event.id,
                          { start: nextStart.toISOString(), end: nextEnd.toISOString() },
                          { "x-user-role": user.role, "x-user-email": user.email }
                        );
                        setReloadTick((n) => n + 1);
                      } catch (err) {
                        console.error(err);
                        toast.error(t('calendarioGeral.toasts.rescheduleFail'));
                        setEvents((prevEvents) =>
                          prevEvents.map((ev) =>
                            ev.id === event.id
                              ? { ...ev, start: previousStart, end: previousEnd }
                              : ev
                          )
                        );
                      }
                    }
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
                event: ({ event }) => (
                  <div className={styles.eventoNoCalendario}>
                    {toPlainText(event.title)}
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
      <Modal isOpen={!!selectedEvent} onClose={() => setSelectedEvent(null)} title={toPlainText(selectedEvent?.title)}>
        {selectedEvent && (
          <div className={styles.modalDetails}>
            <p><strong>{t('calendarioGeral.details.machine')}</strong> {toPlainText(selectedEvent.resource.maquinaNome)}</p>
            <p><strong>{t('calendarioGeral.details.description')}</strong> {toPlainText(selectedEvent.resource.descricao)}</p>

            <p><strong>{t('calendarioGeral.details.currentDate')}</strong> {fmtDate.format(selectedEvent.start)}</p>
            {selectedEvent.resource.originalStart && (
              <p>
                <strong>{t('calendarioGeral.details.originalDate')}</strong>{' '}
                {fmtDate.format(selectedEvent.resource.originalStart)}
              </p>
            )}

            <p><strong>{t('calendarioGeral.details.status')}</strong> {toPlainText(selectedEvent.resource.status)}</p>
            {selectedEvent.resource.concluidoEm && (
              <p>
                <strong>{t('calendarioGeral.details.finishedAt')}</strong>{' '}
                {fmtDate.format(selectedEvent.resource.concluidoEm)}
              </p>
            )}

            {Array.isArray(selectedEvent.resource.itensChecklist) && selectedEvent.resource.itensChecklist.length > 0 && (
              <>
                <h4>{t('calendarioGeral.details.checklistTitle')}</h4>
                <ul>
                  {selectedEvent.resource.itensChecklist.map((item, i) => (
                    <li key={i}>{toPlainText(item)}</li>
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
              {machines.map(m => <option key={m.id} value={m.id}>{toPlainText(m.nome)}</option>)}
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
                const linhas = (tpl ? (tpl.itens || []) : []).map(toPlainText).filter(Boolean);
                setChecklistTxt(linhas.join('\n'));
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



