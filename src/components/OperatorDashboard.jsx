// src/components/OperatorDashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import styles from './OperatorDashboard.module.css';
import { FiPlusCircle, FiTool } from 'react-icons/fi';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import { getIdTokenResult } from 'firebase/auth';
import { db } from '../firebase';
import { useTranslation } from 'react-i18next';
import { statusKey } from '../i18n/format';

const STATUS_BADGE = {
  'Aberto': 'aberto',
  'Em Andamento': 'emandamento',
  'Concluído': 'concluido'
};

const OperatorDashboard = ({ user }) => {
  const { t, i18n } = useTranslation();

  const [maquina, setMaquina] = useState('');
  const [descricao, setDescricao] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [chamados, setChamados] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [maquinasDisponiveis, setMaquinasDisponiveis] = useState([]);

  const dtFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }),
    [i18n.language]
  );
  const formatTS = (ts) => {
    if (!ts) return '...';
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return isNaN(d) ? '...' : dtFmt.format(d);
  };

  // Lista de chamados do operador logado
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'chamados'),
      where('operadorId', '==', user.uid),
      orderBy('dataAbertura', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const chamadosData = [];
        querySnapshot.forEach((doc) => {
          chamadosData.push({ id: doc.id, ...doc.data() });
        });
        setChamados(chamadosData);
        setListLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar chamados do operador:', err);
        setListLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user?.uid]);

  // Carrega opções de máquinas (de 'maquinas' e fallback 'machines')
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const nomes = new Set();

        const load = async (col) => {
          try {
            let snap;
            try {
              snap = await getDocs(query(collection(db, col), orderBy('nome', 'asc')));
            } catch {
              snap = await getDocs(collection(db, col));
            }
            snap.forEach((d) => {
              const data = d.data() || {};
              const n =
                data.nome ??
                data.nomeMaquina ??
                data.tag ??
                data.codigo ??
                d.id;
              if (n && String(n).trim().length) nomes.add(String(n).trim());
            });
          } catch (e) {
            // Se a coleção não existir ou a regra bloquear, apenas ignoramos essa fonte.
            console.warn(`Falha ao ler coleção ${col}:`, e);
          }
        };

        await Promise.all([load('maquinas'), load('machines')]);

        if (!alive) return;
        setMaquinasDisponiveis([...nomes].sort((a, b) => a.localeCompare(b, 'pt') ));
      } catch (e) {
        console.error('Falha ao carregar máquinas:', e);
      }
    })();
    return () => { alive = false; };
  }, []);

  // SUBMISSÃO do chamado (OPERADOR via DASHBOARD)
  const handleSubmit = async (e) => {
    e.preventDefault();
    const desc = (descricao || '').trim();
    const maq = (maquina || '').trim();

    if (!maq || !desc || desc.length < 5) {
      toast.error(t('operatorDashboard.form.required'));
      return;
    }
    if (!user?.uid) {
      toast.error(t('auth.required'));
      return;
    }

    setFormLoading(true);
    try {
      // Descobre o "role" do usuário para casar com roleFromAuth() nas regras
      let role;
      try {
        const token = await getIdTokenResult(user); // tenta custom claims
        role = token?.claims?.role;
      } catch {}
      if (!role) {
        try {
          const udoc = await getDoc(doc(db, 'usuarios', user.uid)); // tenta doc usuarios/{uid}
          role = udoc.exists() ? udoc.data()?.role : undefined;
        } catch {}
      }
      if (!role) role = 'operador'; // fallback coerente com sua regra

      const nome =
        user?.nome ||
        user?.displayName ||
        (user?.email ? user.email.split('@')[0] : 'Operador');

      await addDoc(collection(db, 'chamados'), {
        // Campos exigidos pela regra (C)
        maquina: maq,
        descricao: desc,
        status: 'Aberto',
        tipo: 'corretiva',
        origin: 'dashboard',
        dataAbertura: serverTimestamp(),

        // Autor/operador amarrados ao auth
        criadoPorId: user.uid,
        criadoPorNome: nome,
        criadoPorRole: role,
        operadorId: user.uid,
        operadorNome: nome,

        // Não pode vir atribuído
        manutentorId: null,
        manutentorNome: null,
        responsavelAtualId: null,

        // Extra opcional
        operadorEmail: user.email ?? null
      });

      toast.success(t('operatorDashboard.form.opened', { machine: maq }));
      setMaquina('');
      setDescricao('');
    } catch (error) {
      console.error('Erro ao adicionar documento: ', error);
      toast.error(t('operatorDashboard.form.error'));
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <FiPlusCircle className={styles.titleIcon} />
          {t('operatorDashboard.form.title')}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="maquina">{t('operatorDashboard.form.selectMachine')}</label>
            <select
              id="maquina"
              value={maquina}
              onChange={(e) => setMaquina(e.target.value)}
              className={styles.select}
              required
            >
              <option value="" disabled>
                {t('operatorDashboard.form.choosePlaceholder')}
              </option>
              {maquinasDisponiveis.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="descricao">{t('operatorDashboard.form.problem')}</label>
            <textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={styles.textarea}
              placeholder={t('operatorDashboard.form.problemPlaceholder')}
              rows="4"
              required
            />
          </div>
          <button type="submit" className={styles.submitButton} disabled={formLoading}>
            {formLoading ? t('operatorDashboard.form.sending') : t('operatorDashboard.form.open')}
          </button>
        </form>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <FiTool className={styles.titleIcon} />
          {t('operatorDashboard.list.title')}
        </h2>
        {listLoading ? (
          <p>{t('operatorDashboard.list.loading')}</p>
        ) : chamados.length === 0 ? (
          <p>{t('operatorDashboard.list.empty')}</p>
        ) : (
          <ul className={styles.chamadoList}>
            {chamados.map((chamado) => (
              <Link to={`/maquinas/chamado/${chamado.id}`} key={chamado.id} className={styles.chamadoLink}>
                <li className={styles.chamadoItem}>
                  <div className={styles.chamadoInfo}>
                    <strong>{t('operatorDashboard.list.machine', { name: chamado.maquina })}</strong>
                    <small>
                      {t('operatorDashboard.list.openedAt', { date: formatTS(chamado.dataAbertura) })}
                    </small>
                    <p className={styles.descriptionPreview}>{chamado.descricao}</p>
                  </div>
                  <span className={`${styles.statusBadge} ${styles[STATUS_BADGE[chamado.status] || 'badge']}`}>
                    {t(`status.${statusKey(chamado.status)}`)}
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
