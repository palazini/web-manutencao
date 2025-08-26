import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register'
import './i18n';

const updateSW = registerSW({
  onNeedRefresh() {
    // exiba um toast/modal seu e, ao confirmar:
    // updateSW(true) para aplicar a nova versão (reload)
    console.log('Nova versão disponível. Atualize para aplicar.')
  },
  onOfflineReady() {
    console.log('PWA pronto para uso offline.')
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);