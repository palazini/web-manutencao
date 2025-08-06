// src/pages/EstoquePage.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  deleteDoc,
  doc
} from 'firebase/firestore';
import styles from './EstoquePage.module.css';
import MovimentacaoModal from './MovimentacaoModal.jsx';
import PecaModal from './PecaModal.jsx';
import toast from 'react-hot-toast';

// Reaproveitando as helpers do histórico
import { exportToExcel } from '../utils/exportExcel';
import { exportToPdf }   from '../utils/exportPdf';

export default function EstoquePage({ user }) {
  const [pecas, setPecas]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedPeca, setSelectedPeca] = useState(null);
  const [modalTipo, setModalTipo]       = useState('entrada');
  const [editingPeca, setEditingPeca]   = useState(undefined);

  useEffect(() => {
    const q = query(collection(db, 'pecas'), orderBy('codigo'));
    return onSnapshot(q, snap => {
      setPecas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, console.error);
  }, []);

  const openModalMov = (peca, tipo) => {
    setSelectedPeca(peca);
    setModalTipo(tipo);
  };

  const handleDeletePeca = async id => {
    if (!window.confirm('Tem certeza que deseja excluir esta peça?')) return;
    try {
      await deleteDoc(doc(db, 'pecas', id));
      toast.success('Peça excluída com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao excluir peça.');
    }
  };

  // Prepara dados para exportação em Excel
  const handleExportExcel = () => {
    const excelData = pecas.map(p => ({
      Código:      p.codigo,
      Nome:        p.nome,
      Categoria:   p.categoria,
      Estoque:     p.estoqueAtual,
      Mínimo:      p.estoqueMinimo,
      Localização: p.localizacao,
    }));
    // (exportToExcel(data, nomeDaPlanilha, nomeDoArquivo))
    exportToExcel(excelData, 'Estoque', 'estoque');
  };

  // Prepara dados e colunas para exportação em PDF
  const handleExportPdf = () => {
    const pdfColumns = [
      { key: 'codigo',      label: 'Código' },
      { key: 'nome',        label: 'Nome' },
      { key: 'categoria',   label: 'Categoria' },
      { key: 'estoqueAtual',  label: 'Estoque' },
      { key: 'estoqueMinimo', label: 'Mínimo' },
      { key: 'localizacao', label: 'Localização' }
    ];
    const pdfData = pecas.map(p => ({
      codigo:      p.codigo,
      nome:        p.nome,
      categoria:   p.categoria,
      estoqueAtual:  p.estoqueAtual,
      estoqueMinimo: p.estoqueMinimo,
      localizacao: p.localizacao
    }));
    // (exportToPdf(dataArray, columns, nomeDoArquivo))
    exportToPdf(pdfData, pdfColumns, 'estoque');
  };

  return (
    <>
      <header className={styles.header}>
        <h1>Controle de Estoque de Manutenção</h1>
      </header>

      <div className={styles.container}>
        {/* Toolbar: criação e exportação */}
        <div className={styles.toolbar}>
          {user?.role === 'gestor' && (
            <button
              className={styles.newButton}
              onClick={() => setEditingPeca(null)}
            >
              + Nova Peça
            </button>
          )}
          <button
            className={styles.exportButton}
            onClick={handleExportExcel}
          >
            Exportar Excel
          </button>
          <button
            className={styles.exportButton}
            onClick={handleExportPdf}
          >
            Exportar PDF
          </button>
        </div>

        {/* Grid de cards */}
        <div className={styles.grid}>
          {loading ? (
            <p>Carregando peças...</p>
          ) : pecas.length === 0 ? (
            <p>Nenhuma peça cadastrada.</p>
          ) : (
            pecas.map(p => (
              <div key={p.id} className={styles.cardCatalog}>
                <h3>{p.nome}</h3>
                <p><strong>Código:</strong> {p.codigo} </p>
                <p><strong>Categoria:</strong> {p.categoria}</p>
                <p><strong>Estoque:</strong> {p.estoqueAtual}</p>
                <p><strong>Mínimo:</strong> {p.estoqueMinimo}</p>
                <p><strong>Localização:</strong> {p.localizacao}</p>

                {(user.role === 'manutentor' || user.role === 'gestor') && (
                  <div className={styles.cardButtons}>
                    <button
                      className={styles.buttonSmall}
                      onClick={() => openModalMov(p, 'entrada')}
                    >
                      Entrada
                    </button>
                    <button
                      className={styles.buttonSmall}
                      onClick={() => openModalMov(p, 'saida')}
                    >
                      Saída
                    </button>
                    <button
                      className={styles.buttonSmall}
                      onClick={() => setEditingPeca(p)}
                    >
                      Editar
                    </button>
                    <button
                      className={styles.buttonSmallDelete}
                      onClick={() => handleDeletePeca(p.id)}
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modais */}
        {selectedPeca && (
          <MovimentacaoModal
            peca={selectedPeca}
            tipo={modalTipo}
            user={user}
            onClose={() => setSelectedPeca(null)}
          />
        )}
        {editingPeca !== undefined && (
          <PecaModal
            peca={editingPeca}
            onClose={() => setEditingPeca(undefined)}
          />
        )}
      </div>
    </>
  );
}
