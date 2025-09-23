import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './ChecklistPage.module.css';
import {
  collection, addDoc, serverTimestamp,
  doc, getDoc,
  query, where, onSnapshot, getDocs, limit
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const ChecklistPage = ({ user }) => {
  const { maquinaId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [maquina, setMaquina] = useState(null);
  const [perguntas, setPerguntas] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [blockedItems, setBlockedItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const slugify = (s) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

  // Helper: obter role do usuário (doc /usuarios/{uid} ou custom claim)
  const getUserRole = async (uid) => {
    // 1) tenta Firestore
    try {
      const uref = doc(db, 'usuarios', uid);
      const usnap = await getDoc(uref);
      const r = usnap.exists() ? usnap.data()?.role : null;
      if (r) return r;
    } catch (_) {
      // ignora e cai pro claim
    }
    // 2) cai para custom claim
    const auth = getAuth();
    const token = await auth.currentUser?.getIdTokenResult(true);
    return token?.claims?.role || null;
  };

  // 1) Busca checklist da máquina
  useEffect(() => {
    if (!maquinaId) return;
    (async () => {
      try {
        const maquinaRef = doc(db, 'maquinas', maquinaId);
        const snap = await getDoc(maquinaRef);
        if (!snap.exists()) {
          toast.error(t('checklist.notFound'));
          setLoading(false);
          return;
        }
        const data = snap.data();
        setMaquina(data);
        const lista = data.checklistDiario || [];
        setPerguntas(lista);

        // inicializa todas as respostas em "sim"
        const iniciais = {};
        lista.forEach(item => { iniciais[item] = 'sim'; });
        setRespostas(iniciais);
      } catch (e) {
        console.error(e);
        toast.error(t('checklist.toastFail'));
      } finally {
        setLoading(false);
      }
    })();
  }, [maquinaId, t]);

  // 2) Monitora chamados abertos/andamento para esta máquina e marca bloqueios
  useEffect(() => {
    if (!maquinaId) return;
    const qRef = query(
      collection(db, 'chamados'),
      where('maquinaId', '==', maquinaId),
      where('tipo', '==', 'preditiva'),
      where('status', 'in', ['Aberto', 'Em Andamento'])
    );
    const unsub = onSnapshot(qRef, snap => {
      const bloqueios = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const key = data.checklistItemKey || slugify(data.item);
        bloqueios[key] = d.id;
      });
      setBlockedItems(bloqueios);
    }, (err) => {
      console.error(err);
    });
    return () => unsub();
  }, [maquinaId]);

  const handleRespostaChange = (pergunta, valor) => {
    const key = slugify(pergunta);
    if (valor === 'nao' && blockedItems[key]) {
      toast(t('checklist.toastAlreadyReported', { id: blockedItems[key] }));
      return;
    }
    setRespostas(prev => ({ ...prev, [pergunta]: valor }));
  };

  const handleSubmit = async () => {
    if (enviando) return;
    setEnviando(true);
    setLoading(true);
    let gerados = 0;
    try {
      // role necessário para as regras (criadoPorRole == roleFromAuth())
      const role = await getUserRole(user.uid);
      if (!role) {
        throw new Error('Usuário sem role configurado (nem em /usuarios nem em custom claim).');
      }

      for (const pergunta of perguntas) {
        if (respostas[pergunta] === 'nao') {
          const key = slugify(pergunta);
          // só cria se não houver bloqueio (snapshot) E não existir no servidor agora
          if (!blockedItems[key]) {
            const qChk = query(
              collection(db, 'chamados'),
              where('maquinaId', '==', maquinaId),
              where('tipo', '==', 'preditiva'),
              where('checklistItemKey', '==', key),
              where('status', 'in', ['Aberto', 'Em Andamento']),
              limit(1)
            );
            const snap = await getDocs(qChk);
            if (!snap.empty) continue;

            // descrição precisa ter >= 5 chars (regras)
            const descRaw = (t('checklist.generatedDescription', { item: pergunta }) || '').trim();
            const descricaoValida = descRaw.length >= 5
              ? descRaw
              : `Problema identificado no item: ${pergunta}`;

            // >>>> CRIAÇÃO DO CHAMADO: atende ao bloco (B) das regras
            await addDoc(collection(db, 'chamados'), {
              // básicos
              maquina: maquina?.nome,
              maquinaId,                         // string
              item: pergunta,
              checklistItemKey: key,
              descricao: descricaoValida,        // size >= 5
              status: 'Aberto',
              tipo: 'preditiva',
              dataAbertura: serverTimestamp(),

              // origem + autoria (regras exigem)
              origin: 'checklist',
              criadoPorId: user.uid,             // == auth.uid
              criadoPorNome: user.nome,
              criadoPorRole: role,               // == roleFromAuth()

              // operador (amarrado ao auth)
              operadorId: user.uid,              // == auth.uid
              operadorNome: user.nome,

              // deve vir desatribuído (regras checam == null)
              manutentorId: null,
              manutentorNome: null,
              responsavelAtualId: null
            });

            gerados++;
          }
        }
      }

      // Registro da submissão do checklist (rules: operadorId == auth.uid)
      await addDoc(collection(db, 'checklistSubmissions'), {
        operadorId: user.uid,
        operadorNome: user.nome,
        maquinaId,
        maquinaNome: maquina?.nome,
        dataSubmissao: serverTimestamp(),
        respostas
      });

      toast.success(t('checklist.toastSent', { count: gerados }));
      navigate('/');
    } catch (err) {
      console.error(err);
      toast.error(t('checklist.toastFail'));
    } finally {
      setLoading(false);
      setEnviando(false);
    }
  };

  if (loading) return <p>{t('checklist.loading')}</p>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>{t('checklist.title', { machine: maquina?.nome || '' })}</h1>
          <p>{t('checklist.greeting', { name: user?.nome || '' })}</p>
        </div>

        {perguntas.length === 0 && <p>{t('checklist.empty')}</p>}

        {perguntas.map((pergunta, i) => {
          const key = slugify(pergunta);
          const isBlocked = Boolean(blockedItems[key]);
          return (
            <div key={i} className={styles.checklistItem}>
              <span>{pergunta}</span>
              <div>
                <input
                  type="radio"
                  id={`sim-${i}`}
                  name={`item-${i}`}
                  checked={respostas[pergunta] === 'sim'}
                  onChange={() => handleRespostaChange(pergunta, 'sim')}
                />
                <label htmlFor={`sim-${i}`}>{t('checklist.yes')}</label>

                <input
                  type="radio"
                  id={`nao-${i}`}
                  name={`item-${i}`}
                  checked={respostas[pergunta] === 'nao'}
                  disabled={isBlocked || enviando}
                  onChange={() => handleRespostaChange(pergunta, 'nao')}
                  style={{ marginLeft: '1rem' }}
                />
                <label htmlFor={`nao-${i}`}>{t('checklist.no')}</label>

                {isBlocked && (
                  <small>{t('checklist.alreadyReported', { id: blockedItems[key] })}</small>
                )}
              </div>
            </div>
          );
        })}

        <div className={styles.buttonContainer}>
          <button
            onClick={handleSubmit}
            className={styles.submitButton}
            disabled={loading || enviando}
          >
            {enviando ? t('checklist.sending') : t('checklist.send')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChecklistPage;
