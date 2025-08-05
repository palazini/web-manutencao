// src/pages/PecaModal.jsx
import { getAuth } from 'firebase/auth';
import React, { useState, useEffect } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import Modal from '../components/Modal.jsx';
import toast from 'react-hot-toast';
import styles from './PecaModal.module.css';

export default function PecaModal({ peca, onClose }) {
  const [codigo, setCodigo]           = useState('');
  const [nome, setNome]               = useState('');
  const [categoria, setCategoria]     = useState('');
  const [unidade, setUnidade]         = useState('');
  const [estoqueAtual, setEstoqueAtual]   = useState(0);
  const [estoqueMinimo, setEstoqueMinimo] = useState(0);
  const [localizacao, setLocalizacao] = useState('');
  const [isSaving, setIsSaving]       = useState(false);

  useEffect(() => {
    if (peca) {
      // preenche o formulário para edição
      setCodigo(peca.codigo || '');
      setNome(peca.nome || '');
      setCategoria(peca.categoria || '');
      setUnidade(peca.unidade || '');
      setEstoqueAtual(peca.estoqueAtual ?? 0);
      setEstoqueMinimo(peca.estoqueMinimo ?? 0);
      setLocalizacao(peca.localizacao || '');
    } else {
      // limpa para criação
      setCodigo('');
      setNome('');
      setCategoria('');
      setUnidade('');
      setEstoqueAtual(0);
      setEstoqueMinimo(0);
      setLocalizacao('');
    }
  }, [peca]);

  const handleSubmit = async e => {
    e.preventDefault();
    setIsSaving(true);
    try {

        const auth = getAuth();
    const idTokenResult = await auth.currentUser.getIdTokenResult(true);
    console.log('>>> Claims atuais:', idTokenResult.claims);
      const data = {
        codigo,
        nome,
        categoria,
        unidade,
        estoqueAtual,
        estoqueMinimo,
        localizacao,
        atualizadoEm: serverTimestamp()
      };

      if (peca === null) {
        // criação
        await addDoc(collection(db, 'pecas'), {
          ...data,
          criadoEm: serverTimestamp()
        });
        toast.success('Peça criada com sucesso!');
      } else {
        // edição
        const ref = doc(db, 'pecas', peca.id);
        await updateDoc(ref, data);
        toast.success('Peça atualizada com sucesso!');
      }

      onClose();
    } catch (err) {
      console.error('Erro ao salvar peça:', err);
      toast.error('Falha ao salvar peça.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={peca ? 'Editar Peça' : 'Nova Peça'}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="codigo">Código</label>
          <input
            id="codigo"
            type="text"
            className={styles.input}
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="nome">Nome</label>
          <input
            id="nome"
            type="text"
            className={styles.input}
            value={nome}
            onChange={e => setNome(e.target.value)}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="categoria">Categoria</label>
          <input
            id="categoria"
            type="text"
            className={styles.input}
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="unidade">Unidade</label>
          <input
            id="unidade"
            type="text"
            className={styles.input}
            value={unidade}
            onChange={e => setUnidade(e.target.value)}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="estoqueAtual">Estoque Atual</label>
          <input
            id="estoqueAtual"
            type="number"
            min="0"
            className={styles.input}
            value={estoqueAtual}
            onChange={e => setEstoqueAtual(Number(e.target.value))}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="estoqueMinimo">Estoque Mínimo</label>
          <input
            id="estoqueMinimo"
            type="number"
            min="0"
            className={styles.input}
            value={estoqueMinimo}
            onChange={e => setEstoqueMinimo(Number(e.target.value))}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="localizacao">Localização</label>
          <input
            id="localizacao"
            type="text"
            className={styles.input}
            value={localizacao}
            onChange={e => setLocalizacao(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className={styles.button}
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </Modal>
  );
}
