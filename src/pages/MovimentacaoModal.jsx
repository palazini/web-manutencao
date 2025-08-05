// src/pages/MovimentacaoModal.jsx
import React, { useState } from 'react';
import {
  doc,
  addDoc,
  collection,
  updateDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import styles from './MovimentacaoModal.module.css';
import Modal from '../components/Modal.jsx';
import toast from 'react-hot-toast';

export default function MovimentacaoModal({ peca, tipo, user, onClose }) {
  const [quantidade, setQuantidade] = useState(1);
  const [descricao, setDescricao] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // 1) registra a movimentação
      await addDoc(collection(db, 'movimentacoes'), {
        pecaId:    peca.id,
        tipo,      // 'entrada' ou 'saida'
        quantidade,
        descricao,
        usuario:   user.nome,
        data:      serverTimestamp()
      });

      // 2) atualiza o estoque da peça
      const pecaRef = doc(db, 'pecas', peca.id);
      const delta = tipo === 'entrada' ? quantidade : -quantidade;
      await updateDoc(pecaRef, {
        estoqueAtual: increment(delta),
        atualizadoEm: serverTimestamp()
      });

      toast.success(`Movimentação de ${tipo} realizada com sucesso!`);
      onClose();
    } catch (err) {
      console.error('Erro ao registrar movimentação:', err);
      toast.error('Falha ao registrar movimentação.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={tipo === 'entrada' ? 'Registrar Entrada' : 'Registrar Saída'}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label>Peça</label>
          <p>
            <strong>
              {peca.codigo} – {peca.nome}
            </strong>
          </p>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="quantidade">Quantidade</label>
          <input
            id="quantidade"
            type="number"
            min="1"
            className={styles.input}
            value={quantidade}
            onChange={e => setQuantidade(Number(e.target.value))}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="descricao">Descrição (opcional)</label>
          <textarea
            id="descricao"
            className={styles.textarea}
            rows="3"
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className={styles.button}
          disabled={isSaving}
        >
          {isSaving ? 'Processando...' : 'Confirmar'}
        </button>
      </form>
    </Modal>
  );
}
