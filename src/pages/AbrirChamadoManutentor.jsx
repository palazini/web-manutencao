import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiPlusCircle } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { getMaquinas, criarChamado } from "../services/apiClient";
import styles from "./AbrirChamadoManutentor.module.css";

export default function AbrirChamadoManutentor({ user }) {
  const { t } = useTranslation();

  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [assumirAgora, setAssumirAgora] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(false);

  const podeAbrir = user?.role === "manutentor" || user?.role === "gestor";

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const lista = await getMaquinas(); // [{ id, nome, tag }]
        setMaquinas(Array.isArray(lista) ? lista : []);
      } catch (e) {
        console.error(e);
        toast.error(t("techOpen.errors.loadMachines"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const sugestoesMaquinas = useMemo(() => {
    const itens = maquinas.map((m) => {
      const nome = m?.nome ?? m?.id ?? "";
      const tag  = m?.tag ? ` (${m.tag})` : "";
      return { label: `${nome}${tag}`, value: String(m?.id ?? "") };
    });
    return itens.sort((a, b) => a.label.localeCompare(b.label, "pt"));
  }, [maquinas]);

  const desabilitado =
    enviando || !podeAbrir || !selectedMachineId || descricao.trim().length < 5;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (desabilitado) return;

    try {
      setEnviando(true);

      if (!selectedMachineId) throw new Error("Selecione uma máquina válida.");
      if (!user?.email) throw new Error("Seu usuário não possui e-mail carregado.");

      // pega a máquina escolhida para extrair tag/nome
      const maquinaSel = maquinas.find(m => String(m.id) === String(selectedMachineId));
      if (!maquinaSel) throw new Error("Máquina não encontrada na lista local.");

      const payload = {
        // o back atual exige tag ou nome:
        maquinaTag:  maquinaSel.tag ?? undefined,
        maquinaNome: maquinaSel.nome ?? undefined,

        // mantém também se o seu back já usa/precisa:
        maquinaId: selectedMachineId,

        tipo: "corretiva",
        descricao: descricao.trim(),
        assumir: !!assumirAgora,
        criadoPorEmail: user.email,
        ...(assumirAgora ? { atribuidoParaEmail: user.email } : {})
      };

      const novo = await criarChamado(payload);
      toast.success(t("techOpen.success.created"));
      setSelectedMachineId("");
      setDescricao("");
      void novo;
    } catch (err) {
      console.error(err);
      toast.error(err?.message || t("techOpen.errors.create"));
    } finally {
      setEnviando(false);
    }
  };

  if (!podeAbrir) {
    return (
      <>
        <header className={styles.pageHeaderBar}>
          <h1 className={styles.h1}>{t("techOpen.header.title")}</h1>
        </header>
        <div className={styles.listContainer}>
          <p className={styles.helper}>{t("techOpen.noAccess")}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <header style={{ padding: 20, background: "#fff", borderBottom: "1px solid #e0e0e0" }}>
        <h1>{t("techOpen.header.title")}</h1>
      </header>

      <div className={styles.listContainer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="maquina" className={styles.label}>
              {t("techOpen.fields.machine")}
            </label>
            <select
              id="maquina"
              className={styles.select}
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              required
              disabled={loading}
            >
              <option value="" disabled>
                {loading ? t("common.loading") : t("techOpen.placeholders.chooseMachine")}
              </option>
              {sugestoesMaquinas.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
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
              <input
                type="checkbox"
                checked={assumirAgora}
                onChange={(e) => setAssumirAgora(e.target.checked)}
              />
              <span>{t("techOpen.fields.takeNow")}</span>
            </label>
            <small className={styles.helper}>
              {t("techOpen.helper.takeNow")}
            </small>
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.primaryBtn} disabled={desabilitado}>
              <FiPlusCircle />
              {enviando ? t("techOpen.cta.sending") : t("techOpen.cta.create")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
