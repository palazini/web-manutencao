// src/pages/CausasRaizPage.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import styles from './CausasRaizPage.module.css';
import toast from 'react-hot-toast';

export default function CausasRaizPage() {
  const [causas, setCausas] = useState([]);
  const [novaCausa, setNovaCausa] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'causasRaiz'), snap => {
      setCausas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleAdd = async () => {
    if (!novaCausa.trim()) return;
    try {
      await addDoc(collection(db, 'causasRaiz'), { nome: novaCausa.trim() });
      setNovaCausa('');
      toast.success('Causa adicionada');
    } catch {
      toast.error('Erro ao adicionar');
    }
  };

  const handleUpdate = async (id, novoNome) => {
    try {
      await updateDoc(doc(db, 'causasRaiz', id), { nome: novoNome });
      toast.success('Causa atualizada');
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Excluir causa?')) return;
    try {
      await deleteDoc(doc(db, 'causasRaiz', id));
      toast.success('Causa removida');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <div className={styles.container}>
      <h2>Gerir Causas Raiz</h2>
      <div className={styles.addForm}>
        <input
          value={novaCausa}
          onChange={e => setNovaCausa(e.target.value)}
          placeholder="Nova causa"
        />
        <button onClick={handleAdd}>Adicionar</button>
      </div>
      <ul className={styles.list}>
        {causas.map(c => (
          <li key={c.id}>
            <input
              value={c.nome}
              onChange={e => handleUpdate(c.id, e.target.value)}
            />
            <button onClick={() => handleDelete(c.id)}>❌</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
