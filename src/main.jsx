import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import App from './App.jsx';
import './index.css';
import './i18n';

// registra o SW já na primeira carga
import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });

// banner global para “nova versão disponível / offline pronto”
import SWUpdateBanner from './components/SWUpdateBanner.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SWUpdateBanner />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
