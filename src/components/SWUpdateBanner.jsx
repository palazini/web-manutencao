import React, { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';
import styles from './SWUpdateBanner.module.css';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)')?.matches ||
  window.navigator?.standalone === true; // iOS

export default function SWUpdateBanner({ onlyStandalone = true }) {
  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW();
  const [dismissed, setDismissed] = useState(false);

  const standalone = isStandalone();

  // se pediu para exibir só quando instalado e não está instalado: não renderiza
  if (onlyStandalone && !standalone) return null;
  if ((!(needRefresh || offlineReady)) || dismissed) return null;
  
  return (
    <div className={styles.banner} role="region" aria-live="polite">
      <div className={styles.content}>
        {offlineReady && <span>{t('pwa.offlineReady')}</span>}
        {needRefresh && (
          <>
            <span className={styles.text}>{t('pwa.newVersion')}</span>
            <button
              className={styles.primary}
              onClick={() => updateServiceWorker(true)} // skipWaiting + clientsClaim
            >
              {t('pwa.update')}
            </button>
          </>
        )}
      </div>
      <button
        className={styles.close}
        onClick={() => setDismissed(true)}
        aria-label={t('pwa.dismiss')}
        title={t('pwa.dismiss')}
      >
        ×
      </button>
    </div>
  );
}
