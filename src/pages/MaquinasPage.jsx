import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getMaquinas, listarChamados, criarMaquina } from '../services/apiClient';
import toast from 'react-hot-toast';
import styles from './MaquinasPage.module.css';
import Modal from '../components/Modal.jsx';
import { FiPlus } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

const MaquinasPage = () => {
  const { t } = useTranslation();
  const [maquinas, setMaquinas] = useState([]);
  const [chamadosAtivos, setChamadosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nomeNovaMaquina, setNomeNovaMaquina] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        // 1) Máquinas
        const lista = await getMaquinas(); // [{id, nome, tag, setor, critico}]
        if (!alive) return;
        setMaquinas(lista);

        // 2) Chamados ativos (fazemos duas buscas e mesclamos)
        const [abertos, emAndamento] = await Promise.all([
          listarChamados({ status: 'Aberto', page: 1, pageSize: 200 }),
          listarChamados({ status: 'Em Andamento', page: 1, pageSize: 200 }),
        ]);
        const itemsAbertos = abertos.items ?? abertos;
        const itemsAnd = emAndamento.items ?? emAndamento;
        const porId = new Map();
        [...itemsAbertos, ...itemsAnd].forEach((c) => porId.set(c.id, c));
        if (!alive) return;
        setChamadosAtivos([...porId.values()]);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const maquinasComStatus = useMemo(() => {
    const statusPorMaquina = {};
    const prioridade = { corretiva: 3, preventiva: 2, preditiva: 1 };
    chamadosAtivos.forEach((chamado) => {
      const tipo = chamado.tipo || 'corretiva';
      if (
        !statusPorMaquina[chamado.maquina] ||
        prioridade[tipo] > prioridade[statusPorMaquina[chamado.maquina]]
      ) {
        statusPorMaquina[chamado.maquina] = tipo;
      }
    });
    return maquinas.map((maquina) => ({
      ...maquina,
      statusDestaque: statusPorMaquina[maquina.nome] || 'normal',
    }));
  }, [maquinas, chamadosAtivos]);

  const getStatusClass = (status) => {
    switch (status) {
      case 'corretiva':
        return styles.statusCorretiva;
      case 'preventiva':
        return styles.statusPreventiva;
      case 'preditiva':
        return styles.statusPreditiva;
      default:
        return styles.statusNormal;
    }
  };

  const handleCriarMaquina = async (e) => {
    e.preventDefault();
    if (nomeNovaMaquina.trim() === '') {
      toast.error(t('maquinas.toasts.nameRequired'));
      return;
    }
    try {
      const nova = await criarMaquina({
        nome: nomeNovaMaquina.trim(),
        // opcionalmente: tag, setor, critico
      });
      // atualiza a lista local sem depender de reload
      setMaquinas((prev) => [nova, ...prev].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')));
      toast.success(t('maquinas.toasts.created', { name: nomeNovaMaquina }));
      setNomeNovaMaquina('');
      setIsModalOpen(false);
    } catch (error) {
      toast.error(t('maquinas.toasts.createError'));
      console.error(error);
    }
  };

  return (
    <>
      <header
        style={{
          padding: '20px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <h1>{t('maquinas.title')}</h1>
      </header>

      <div style={{ padding: '20px' }}>
        {loading ? (
          <p>{t('maquinas.loading')}</p>
        ) : (
          <>
            <div className={styles.legendContainer}>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColorBox} ${styles.statusCorretiva}`} />
                <span>{t('maquinas.legend.corretiva')}</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColorBox} ${styles.statusPreventiva}`} />
                <span>{t('maquinas.legend.preventiva')}</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColorBox} ${styles.statusPreditiva}`} />
                <span>{t('maquinas.legend.preditiva')}</span>
              </div>
            </div>

            <div className={styles.grid}>
              {maquinasComStatus.map((maquina) => (
                <Link
                  to={`/maquinas/${maquina.id}`}
                  key={maquina.id}
                  className={`${styles.card} ${getStatusClass(maquina.statusDestaque)}`}
                >
                  <h2>{maquina.nome}</h2>
                  <p>{t('maquinas.cardHint')}</p>
                </Link>
              ))}

              {/* CARD DE ADICIONAR */}
              <div
                className={`${styles.card} ${styles.addCard}`}
                onClick={() => setIsModalOpen(true)}
                role="button"
                aria-label={t('maquinas.modal.title')}
                title={t('maquinas.modal.title')}
              >
                <FiPlus className={styles.addIcon} />
              </div>
            </div>
          </>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('maquinas.modal.title')}>
        <form onSubmit={handleCriarMaquina}>
          <div style={{ marginBottom: '15px' }}>
            <label
              htmlFor="nome-maquina"
              style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}
            >
              {t('maquinas.modal.nameLabel')}
            </label>
            <input
              id="nome-maquina"
              type="text"
              value={nomeNovaMaquina}
              onChange={(e) => setNomeNovaMaquina(e.target.value)}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              required
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '10px 15px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#4B70E2',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            {t('maquinas.modal.save')}
          </button>
        </form>
      </Modal>
    </>
  );
};

export default MaquinasPage;
