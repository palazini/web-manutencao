import React, { useState, useEffect } from 'react';
import { listarPecas, excluirPeca } from '../services/apiClient';

import styles from './EstoquePage.module.css';
import MovimentacaoModal from './MovimentacaoModal.jsx';
import PecaModal from './PecaModal.jsx';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Reaproveitando as helpers do histórico
import { exportToExcel } from '../utils/exportExcel';
import { exportToPdf }   from '../utils/exportPdf';

export default function EstoquePage({ user }) {
  const { t } = useTranslation();

  const [pecas, setPecas]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedPeca, setSelectedPeca] = useState(null);
  const [modalTipo, setModalTipo]       = useState('entrada');
  const [editingPeca, setEditingPeca]   = useState(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const itens = await listarPecas(); // [{id,codigo,nome,categoria,estoqueAtual,estoqueMinimo,localizacao}]
        if (!alive) return;
        setPecas(itens);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // (Opcional) atualizações em tempo real via SSE
  // useEffect(() => {
  //   const unsub = subscribeSSE((msg) => {
  //     if (msg?.topic === 'pecas' || msg?.topic === 'movimentacoes') {
  //       listarPecas().then(setPecas).catch(console.error);
  //     }
  //   });
  //   return () => unsub();
  // }, []);

  const openModalMov = (peca, tipo) => {
    setSelectedPeca(peca);
    setModalTipo(tipo);
  };

  const handleDeletePeca = async id => {
    if (!window.confirm(t('estoque.confirm.delete'))) return;
    try {
      await excluirPeca(id, { role: user?.role, email: user?.email });
      // Atualiza a lista local sem precisar reler tudo
      setPecas(prev => prev.filter(p => p.id !== id));
      toast.success(t('estoque.toasts.deleted'));
    } catch (err) {
      console.error(err);
      toast.error(t('estoque.toasts.deleteFail'));
    }
  };

  // Prepara dados para exportação em Excel
  const handleExportExcel = () => {
    const excelData = pecas.map(p => ({
      [t('estoque.export.columns.code')]:      p.codigo,
      [t('estoque.export.columns.name')]:      p.nome,
      [t('estoque.export.columns.category')]:  p.categoria,
      [t('estoque.export.columns.stock')]:     p.estoqueAtual,
      [t('estoque.export.columns.min')]:       p.estoqueMinimo,
      [t('estoque.export.columns.location')]:  p.localizacao,
    }));
    exportToExcel(excelData, t('estoque.export.sheetName'), 'estoque');
  };

  // Prepara dados e colunas para exportação em PDF
  const handleExportPdf = () => {
    const pdfColumns = [
      { key: 'codigo',        label: t('estoque.export.columns.code') },
      { key: 'nome',          label: t('estoque.export.columns.name') },
      { key: 'categoria',     label: t('estoque.export.columns.category') },
      { key: 'estoqueAtual',  label: t('estoque.export.columns.stock') },
      { key: 'estoqueMinimo', label: t('estoque.export.columns.min') },
      { key: 'localizacao',   label: t('estoque.export.columns.location') }
    ];
    const pdfData = pecas.map(p => ({
      codigo:        p.codigo,
      nome:          p.nome,
      categoria:     p.categoria,
      estoqueAtual:  p.estoqueAtual,
      estoqueMinimo: p.estoqueMinimo,
      localizacao:   p.localizacao
    }));
    exportToPdf(pdfData, pdfColumns, 'estoque');
  };

  return (
    <>
      <header className={styles.header}>
        <h1>{t('estoque.title')}</h1>
      </header>

      <div className={styles.container}>
        {/* Toolbar: criação e exportação */}
        <div className={styles.toolbar}>
          {user?.role === 'gestor' && (
            <button
              className={styles.newButton}
              onClick={() => setEditingPeca(null)}
            >
              {t('estoque.toolbar.new')}
            </button>
          )}
          <button
            className={styles.exportButton}
            onClick={handleExportExcel}
          >
            {t('estoque.toolbar.exportExcel')}
          </button>
          <button
            className={styles.exportButton}
            onClick={handleExportPdf}
          >
            {t('estoque.toolbar.exportPdf')}
          </button>
        </div>

        {/* Grid de cards */}
        <div className={styles.grid}>
          {loading ? (
            <p>{t('estoque.loading')}</p>
          ) : pecas.length === 0 ? (
            <p>{t('estoque.empty')}</p>
          ) : (
            pecas.map(p => (
              <div key={p.id} className={styles.cardCatalog}>
                <h3>{p.nome}</h3>
                <p><strong>{t('estoque.card.labels.code')}</strong> {p.codigo}</p>
                <p><strong>{t('estoque.card.labels.category')}</strong> {p.categoria}</p>
                <p><strong>{t('estoque.card.labels.stock')}</strong> {p.estoqueAtual}</p>
                <p><strong>{t('estoque.card.labels.min')}</strong> {p.estoqueMinimo}</p>
                <p><strong>{t('estoque.card.labels.location')}</strong> {p.localizacao}</p>

                {user?.role === 'gestor' && (
                  <div className={styles.cardButtons}>
                    <button
                      className={styles.buttonSmall}
                      onClick={() => openModalMov(p, 'entrada')}
                    >
                      {t('estoque.card.buttons.in')}
                    </button>
                    <button
                      className={styles.buttonSmall}
                      onClick={() => openModalMov(p, 'saida')}
                    >
                      {t('estoque.card.buttons.out')}
                    </button>
                    <button
                      className={styles.buttonSmall}
                      onClick={() => setEditingPeca(p)}
                    >
                      {t('estoque.card.buttons.edit')}
                    </button>
                    <button
                      className={styles.buttonSmallDelete}
                      onClick={() => handleDeletePeca(p.id)}
                    >
                      {t('estoque.card.buttons.delete')}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modais */}
        {selectedPeca && (
          <>
            {/* Se o seu MovimentacaoModal aceitar callback de sucesso,
                você pode recarregar a lista assim:
                onSaved={() => listarPecas().then(setPecas).catch(console.error)} */}
            <MovimentacaoModal
              peca={selectedPeca}
              tipo={modalTipo}
              user={user}
              onClose={() => setSelectedPeca(null)}
            />
          </>
        )}

        {editingPeca !== undefined && (
          <>
            {/* null = criar, objeto = editar */}
            <PecaModal
              peca={editingPeca}
              user={user}
              onClose={() => setEditingPeca(undefined)}
              onSaved={(saved) => {
                setPecas((prev) => {
                  if (!saved || !saved.id) return prev;
                  const sem = prev.filter((p) => p.id !== saved.id);
                  return [...sem, saved].sort((a, b) =>
                    String(a.codigo).localeCompare(String(b.codigo), 'pt')
                  );
                });
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
