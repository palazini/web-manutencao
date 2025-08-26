import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import styles from './InicioPage.module.css';
import {
  FiServer,
  FiCalendar,
  FiCheckSquare,
  FiBarChart2,
  FiPieChart,
  FiUsers,
  FiUser,
  FiPackage,
  FiClipboard
} from 'react-icons/fi';

const InicioPage = ({ user }) => {
  const { t } = useTranslation();

  return (
    <>
      <header className={styles.header}>
        <h1>{t('inicio.title')}</h1>
        <p>
          <Trans i18nKey="inicio.welcome" values={{ name: user.nome }}>
            Bem-vindo de volta, <strong>{{ name: user.nome }}</strong>!
          </Trans>
        </p>
      </header>

      <div className={styles.content}>
        <h2>{t('inicio.quickAccess')}</h2>

        <div className={styles.actionsGrid}>

          {(user.role === 'manutentor' || user.role === 'gestor') && (
            <Link to="/maquinas" className={styles.actionCard}>
              <FiServer className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>{t('inicio.cards.machines.title')}</h3>
              <p className={styles.cardDescription}>
                {t('inicio.cards.machines.desc')}
              </p>
            </Link>
          )}

          {user.role === 'manutentor' && (
            <Link to="/meus-chamados" className={styles.actionCard}>
              <FiClipboard className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>{t('inicio.cards.myCalls.title')}</h3>
              <p className={styles.cardDescription}>
                {t('inicio.cards.myCalls.desc')}
              </p>
            </Link>
          )}

          {(user.role === 'manutentor' || user.role === 'gestor') && (
            <Link to="/calendario-geral" className={styles.actionCard}>
              <FiCalendar className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>{t('inicio.cards.calendar.title')}</h3>
              <p className={styles.cardDescription}>
                {t('inicio.cards.calendar.desc')}
              </p>
            </Link>
          )}

          {(user.role === 'manutentor' || user.role === 'gestor') && (
            <Link to="/historico" className={styles.actionCard}>
              <FiCheckSquare className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>{t('inicio.cards.history.title')}</h3>
              <p className={styles.cardDescription}>
                {t('inicio.cards.history.desc')}
              </p>
            </Link>
          )}

          {(user.role === 'manutentor' || user.role === 'gestor') && (
            <Link to="/estoque" className={styles.actionCard}>
              <FiPackage className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>{t('inicio.cards.inventory.title')}</h3>
              <p className={styles.cardDescription}>
                {t('inicio.cards.inventory.desc')}
              </p>
            </Link>
          )}

          {user.role === 'gestor' && (
            <Link to="/analise-falhas" className={styles.actionCard}>
              <FiBarChart2 className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>{t('inicio.cards.failureAnalysis.title')}</h3>
              <p className={styles.cardDescription}>
                {t('inicio.cards.failureAnalysis.desc')}
              </p>
            </Link>
          )}

          {user.role === 'gestor' && (
            <Link to="/causas-raiz" className={styles.actionCard}>
              <FiPieChart className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>{t('inicio.cards.rootCauses.title')}</h3>
              <p className={styles.cardDescription}>
                {t('inicio.cards.rootCauses.desc')}
              </p>
            </Link>
          )}

          {user.role === 'gestor' && (
            <Link to="/gerir-utilizadores" className={styles.actionCard}>
              <FiUsers className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>{t('inicio.cards.manageUsers.title')}</h3>
              <p className={styles.cardDescription}>
                {t('inicio.cards.manageUsers.desc')}
              </p>
            </Link>
          )}

          <Link to="/perfil" className={styles.actionCard}>
            <FiUser className={styles.cardIcon} />
            <h3 className={styles.cardTitle}>{t('inicio.cards.profile.title')}</h3>
            <p className={styles.cardDescription}>
              {t('inicio.cards.profile.desc')}
            </p>
          </Link>

        </div>
      </div>
    </>
  );
};

export default InicioPage;
