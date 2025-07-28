import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import { db } from '../firebase';
import 'moment/locale/pt-br';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import styles from './CalendarioGeralPage.module.css';

moment.locale('pt-br');
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

export default function CalendarioGeralPage() {
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView]               = useState('month');  // ① controla a view
  const intervalDays                  = 90;

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

  const getContrastColor = bg => {
    const r = parseInt(bg.slice(1,3),16),
          g = parseInt(bg.slice(3,5),16),
          b = parseInt(bg.slice(5,7),16);
    const yiq = (r*299 + g*587 + b*114)/1000;
    return yiq >= 128 ? '#000' : '#fff';
  };

  const handleSelectEvent = e => {
    alert(`Tarefa: ${e.title}\nMáquina: ${e.resource.maquinaNome}`);
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

              // ─── aqui é o pulo do gato ───
              date={currentDate}
              onNavigate={setCurrentDate}
              view={view}
              onView={setView}
              length={intervalDays}
              // ──────────────────────────────

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
                  // aqui sobrescrevemos só o intervalo da Agenda
                  agendaHeaderFormat: ({ start, end }) =>
                  `${moment(start).format('DD/MM/YYYY')} – ${moment(end).format('DD/MM/YYYY')}`
               }}

              events={events}
              startAccessor="start"
              endAccessor="end"
              onSelectEvent={handleSelectEvent}

              onEventDrop={({ event, start, end }) => {
                const ref = doc(db, 'agendamentosPreventivos', event.id);
                updateDoc(ref, { start, end }).catch(() =>
                  alert('Falha ao reagendar')
                );
              }}

              eventPropGetter={event => {
                const hoje   = new Date(); hoje.setHours(0,0,0,0);
                const inicio = event.start;
                const s      = event.resource.status;
                let bg;
                if (s === 'iniciado')       bg = '#006400';
                else if (s === 'agendado') {
                  if (inicio < hoje)         bg = '#8B0000';
                  else if (inicio.toDateString() === hoje.toDateString())
                                             bg = '#FFA500';
                  else                       bg = '#90EE90';
                }
                else if (s === 'concluido')  bg = '#00008B';
                else                          bg = '#FFFFFF';
                return {
                  style: {
                    backgroundColor: bg,
                    color:           getContrastColor(bg),
                    borderRadius:    4,
                    border:          '1px solid #aaa'
                  }
                };
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
    </>
  );
}
