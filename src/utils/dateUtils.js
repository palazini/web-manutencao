// src/utils/dateUtils.js

export const getTurnoAtual = () => {
  const agora = new Date();
  const hora = agora.getHours();
  const minuto = agora.getMinutes();

  // Converte a hora atual para minutos totais desde o início do dia
  const minutosAtuais = hora * 60 + minuto;

  // Define os horários de início em minutos
  const inicioTurno1 = 5 * 60 + 30; // 05:30
  const inicioTurno2 = 15 * 60 + 18; // 15:18
  const fimTurno2 = 0 * 60 + 48; // 00:48 (do dia seguinte)

  if (minutosAtuais >= inicioTurno1 && minutosAtuais < inicioTurno2) {
    return 'turno1';
  }
  // O turno 2 atravessa a meia-noite
  if (minutosAtuais >= inicioTurno2 || minutosAtuais < fimTurno2) {
    return 'turno2';
  }

  // Se não estiver em nenhum turno (ex: entre 00:48 e 05:30), retorna null
  return null;
};