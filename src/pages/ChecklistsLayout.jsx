// src/pages/ChecklistsLayout.jsx

import React from 'react';
import { Outlet } from 'react-router-dom';

// Este componente simplesmente fornece um ponto de renderização para as rotas aninhadas.
const ChecklistsLayout = () => {
  return <Outlet />;
};

export default ChecklistsLayout;