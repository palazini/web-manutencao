// src/pages/ManutencaoLayout.jsx

import React from 'react';
import { Outlet } from 'react-router-dom';

// Este componente simplesmente renderiza a rota filha que corresponder à URL.
const ManutencaoLayout = () => {
  return <Outlet />;
};

export default ManutencaoLayout;