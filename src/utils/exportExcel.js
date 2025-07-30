// src/utils/exportExcel.js
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/**
 * Exporta um array de objetos para planilha Excel (.xlsx).
 * @param {Array<Object>} data — lista de registros (cada objeto vira uma linha).
 * @param {string} sheetName — nome da aba.
 * @param {string} fileName — nome do arquivo gerado (sem extensão).
 */
export function exportToExcel(data, sheetName = 'Dados', fileName = 'relatorio') {
  // Converte para worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  // Cria um workbook e anexa a worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  // Gera um array binário e dispara download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `${fileName}.xlsx`);
}
