import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import styles from './OperatorDashboard.module.css';
import { FiPlusCircle, FiTool } from 'react-icons/fi';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const OperatorDashboard = ({ user }) => {
  const [maquina, setMaquina] = useState('');
  const [descricao, setDescricao] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [chamados, setChamados] = useState([]);
  const [listLoading, setListLoading] = useState(true);

  const maquinasDisponiveis = [
    'TCN-12', 'TCN-17', 'TCN-18', 'TCN-19', 'TCN-20', 'CT-01', 'Compressor', 'Lapidadora'
  ];

  useEffect(() => {
    const q = query(
      collection(db, 'chamados'),
      where('operadorId', '==', user.uid),
      orderBy('dataAbertura', 'desc')
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const chamadosData = [];
      querySnapshot.forEach((doc) => {
        chamadosData.push({ id: doc.id, ...doc.data() });
      });
      setChamados(chamadosData);
      setListLoading(false);
    });
    return () => unsubscribe();
  }, [user.uid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!maquina || !descricao) {
      toast.error('Por favor, selecione uma máquina e descreva o problema.');
      return;
    }
    setFormLoading(true);
    try {
      await addDoc(collection(db, 'chamados'), {
        maquina,
        descricao,
        status: 'Aberto',
        operadorId: user.uid,
        operadorEmail: user.email,
        operadorNome: user.nome,
        dataAbertura: serverTimestamp(),
        dataConclusao: null,
        manutentorId: null,
      });
      toast.success(`Chamado para a máquina ${maquina} aberto com sucesso!`);
      setMaquina('');
      setDescricao('');
    } catch (error) {
      console.error("Erro ao adicionar documento: ", error);
      toast.error("Ocorreu um erro ao abrir o chamado.");
    } finally {
      setFormLoading(false);
    }
  };

  // =================================================================
  // A PARTE DO CÓDIGO QUE FALTAVA COMEÇA AQUI
  // =================================================================
  return (
    <div className={styles.dashboard}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <FiPlusCircle className={styles.titleIcon} />
          Abrir Novo Chamado
        </h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="maquina">Selecione a Máquina</label>
            <select id="maquina" value={maquina} onChange={(e) => setMaquina(e.target.value)} className={styles.select} required>
              <option value="" disabled>Escolha uma máquina...</option>
              {maquinasDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="descricao">Descrição do Problema</label>
            <textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} className={styles.textarea} placeholder="Descreva detalhadamente o problema encontrado..." rows="4" required></textarea>
          </div>
          <button type="submit" className={styles.submitButton} disabled={formLoading}>
            {formLoading ? 'Enviando...' : 'Abrir Chamado'}
          </button>
        </form>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <FiTool className={styles.titleIcon} />
          Histórico de Chamados
        </h2>
        {listLoading ? (
          <p>Carregando chamados...</p>
        ) : chamados.length === 0 ? (
          <p>Nenhum chamado aberto por você ainda.</p>
        ) : (
          <ul className={styles.chamadoList}>
            {chamados.map(chamado => (
              <Link to={`/historico/chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoLink}>
                <li className={styles.chamadoItem}>
                  <div className={styles.chamadoInfo}>
                    <strong>Máquina: {chamado.maquina}</strong>
                    <small>Aberto em: {chamado.dataAbertura ? new Date(chamado.dataAbertura.toDate()).toLocaleString() : '...'}</small>
                    <p className={styles.descriptionPreview}>{chamado.descricao}</p>
                  </div>
                  <span className={`${styles.statusBadge} ${styles[chamado.status.toLowerCase().replace(' ', '')]}`}>
                    {chamado.status}
                  </span>
                </li>
              </Link>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default OperatorDashboard;