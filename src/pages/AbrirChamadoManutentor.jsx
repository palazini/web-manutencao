import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiPlusCircle } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import {
  addDoc, collection, getDocs, orderBy, query, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import styles from "./AbrirChamadoManutentor.module.css";

export default function AbrirChamadoManutentor({ user }) {
  const { t } = useTranslation();

  const [maquina, setMaquina] = useState("");
  const [descricao, setDescricao] = useState("");
  const [assumirAgora, setAssumirAgora] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [sugestoesMaquinas, setSugestoesMaquinas] = useState([]);

  const podeAbrir = user?.role === "manutentor" || user?.role === "gestor" || false;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const nomes = new Set();
        const tryLoad = async (col) => {
          try {
            let snap;
            try { snap = await getDocs(query(collection(db, col), orderBy("nome"))); }
            catch { snap = await getDocs(collection(db, col)); }
            snap.forEach((d) => {
              const data = d.data() || {};
              const n = data.nome || data.nomeMaquina || data.tag || data.codigo || d.id;
              if (n) nomes.add(String(n));
            });
          } catch {}
        };
        await tryLoad("machines");
        await tryLoad("maquinas");
        if (!alive) return;
        setSugestoesMaquinas([...nomes].sort((a, b) => a.localeCompare(b, "pt")));
      } catch (e) {
        console.error(e);
        toast.error(t("techOpen.errors.loadMachines"));
      }
    })();
    return () => { alive = false; };
  }, [t]);

  const desabilitado = useMemo(
    () => enviando || !podeAbrir || maquina.trim().length < 1 || descricao.trim().length < 5,
    [enviando, podeAbrir, maquina, descricao]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (desabilitado) return;
    try {
      setEnviando(true);
      const payload = {
        maquina: maquina.trim(),
        tipo: 'corretiva',
        descricao: descricao.trim(),
        status: assumirAgora ? "Em Andamento" : "Aberto",
        dataAbertura: serverTimestamp(),
        criadoPorId: user?.uid || null,
        criadoPorNome: user?.displayName || user?.email || "manutentor",
        criadoPorRole: user?.role || "manutentor",
        ...(assumirAgora
          ? { manutentorId: user?.uid || null, manutentorNome: user?.displayName || user?.email || "manutentor", responsavelAtualId: user?.uid || null }
          : { manutentorId: null, manutentorNome: null, responsavelAtualId: null }),
      };
      await addDoc(collection(db, "chamados"), payload);
      toast.success(t("techOpen.success.created"));
      setMaquina(""); setDescricao("");
    } catch (err) {
      console.error(err);
      toast.error(t("techOpen.errors.create"));
    } finally { setEnviando(false); }
  };

  if (!podeAbrir) {
    return (
      <>
        <header className={styles.pageHeaderBar}>
          <h1 className={styles.h1}>{t("techOpen.header.title")}</h1>
        </header>
        <div className={styles.listContainer}>
          <p className={styles.helper}>
            {t("techOpen.noAccess")}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Cabeçalho idêntico ao das outras páginas */}
      <header style={{ padding: '20px', backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0' }}>
        <h1>{t('techOpen.header.title')}</h1>
      </header> 

      {/* Container branco do conteúdo (mesmo estilo do MeusChamados) */}
      <div className={styles.listContainer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="maquina" className={styles.label}>
              {t("techOpen.fields.machine")}
            </label>
            <select
              id="maquina"
              className={styles.select}
              value={maquina}
              onChange={(e) => setMaquina(e.target.value)}
              required
            >
              <option value="" disabled>
                {t("techOpen.placeholders.chooseMachine")}
              </option>
              {sugestoesMaquinas.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="descricao" className={styles.label}>
              {t("techOpen.fields.description")}
            </label>
            <textarea
              id="descricao"
              className={styles.textarea}
              placeholder={t("techOpen.placeholders.description")}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={5}
              required
            />
          </div>

          <div className={styles.inlineCheck}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={assumirAgora} onChange={(e) => setAssumirAgora(e.target.checked)} />
              <span>{t("techOpen.fields.takeNow")}</span>
            </label>
            <small className={styles.helper}>
              {t("techOpen.helper.takeNow")}
            </small>
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={desabilitado}
              title={
                desabilitado
                  ? t("techOpen.cta.disabled")
                  : undefined
              }
            >
              <FiPlusCircle />
              {enviando
                ? t("techOpen.cta.sending")
                : t("techOpen.cta.create")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
