import React from 'react';
import { Outlet } from 'react-router-dom';

function HistoricoLayout() {
  // Este componente atua apenas como um invólucro para as rotas aninhadas.
  // O <Outlet /> renderizará o componente da rota filha correspondente
  // (seja a lista do histórico ou os detalhes de um chamado).
  return <Outlet />;
}

export default HistoricoLayout;