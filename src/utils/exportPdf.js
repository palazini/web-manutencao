// src/utils/exportPdf.js
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Exporta um array de objetos para PDF com cabeçalho de colunas.
 * @param {Array<Object>} data — lista de registros.
 * @param {Array<{ key: string, label: string }>} columns — lista de chaves/labels para colunas.
 * @param {string} fileName — nome do arquivo PDF (sem .pdf).
 */
export function exportToPdf(data, columns, fileName = 'relatorio') {
  // 1) Cria o documento em landscape
  const doc = new jsPDF({ orientation: 'landscape' });

  // 2) Prepara head e body
  const head = [ columns.map(col => col.label) ];
  const body = data.map(row => columns.map(col => row[col.key] ?? ''));

  // 3) Gera a tabela com autoTable
  autoTable(doc, {
    head,
    body,
    styles:    { fontSize: 8 },
    headStyles:{ fillColor: [22, 160, 133] }
  });

  // 4) Salva o PDF
  doc.save(`${fileName}.pdf`);
}
