// src/services/apiClient.js
export const BASE = (
  import.meta.env?.VITE_API_URL ||
  import.meta.env?.VITE_API_BASE ||        // opcional: aceita os dois nomes
  "http://localhost:3000"
).replace(/\/+$/, ""); // remove barra no final

function buildAuthHeaders(auth) {
  const h = { "Content-Type": "application/json" };
  if (auth?.email) h["X-User-Email"] = auth.email;
  if (auth?.role)  h["X-User-Role"]  = auth.role;
  return h;
}

export async function criarChamado({
  maquinaTag,        // opcional
  maquinaNome,       // opcional
  maquinaId,         // opcional
  descricao,
  criadoPorEmail,
  status = 'Aberto',
  manutentorEmail,   // opcional
  tipo,              // opcional: 'preditiva' | 'corretiva'
  checklistItemKey,  // opcional (preditiva)
  item,              // opcional (preditiva)
  ...extras          // campos futuros
}, {
  role,
  email
} = {}) {
  // 1) validação mínima de máquina (evita 400 no backend)
  if (!maquinaId && !maquinaTag && !maquinaNome) {
    throw new Error('Informe maquinaId, maquinaTag ou maquinaNome.');
  }

  const body = {
    descricao: String(descricao || '').trim(),
    criadoPorEmail: String(criadoPorEmail || '').trim().toLowerCase(),
    status: String(status || 'Aberto'),
    // 2) força tipo 'corretiva' por padrão para o fluxo do operador
    tipo: String(tipo || 'corretiva'),
    ...extras
  };

  // 3) normalizações e inclusão condicional
  if (maquinaId)       body.maquinaId       = String(maquinaId);
  if (maquinaTag)      body.maquinaTag      = String(maquinaTag).trim();
  if (maquinaNome)     body.maquinaNome     = String(maquinaNome).trim();
  if (manutentorEmail) body.manutentorEmail = String(manutentorEmail).trim().toLowerCase();
  if (checklistItemKey)body.checklistItemKey= String(checklistItemKey).trim();
  if (item)            body.item            = String(item).trim();

  const res = await fetch(`${BASE}/chamados`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role':  role  || 'operador',
      'x-user-email': email || body.criadoPorEmail || ''
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Falha ao criar chamado (${res.status})`);
  return data;
}

export async function listarChamadosPorCriador(email, page = 1, pageSize = 50) {
  const res = await fetch(
    `${BASE}/chamados?criadoPorEmail=${encodeURIComponent(email)}&page=${page}&pageSize=${pageSize}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Erro ao listar chamados (${res.status})`);
  return data;
}

export async function listarChamados(params = {}) {
  // cópia defensiva + normalização de datas (from/to)
  const p = { ...params };
  for (const k of ['from', 'to']) {
    const v = p[k];
    if (v instanceof Date) p[k] = v.toISOString();
  }

  const u = new URL(`${BASE}/chamados`);
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  });

  const res = await fetch(u.toString());
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : { error: await res.text() };
  if (!res.ok) throw new Error(data?.error || `Erro ao listar chamados (${res.status})`);

  // --- Normalização: SEMPRE devolver objeto com items/total/paginação ---
  const items = Array.isArray(data) ? data
              : Array.isArray(data?.items) ? data.items
              : [];

  const total = typeof data?.total === 'number' ? data.total : items.length;
  const page = Number(data?.page ?? 1);
  const pageSize = Number(data?.pageSize ?? items.length);
  const hasNext = Boolean(
    typeof data?.hasNext === 'boolean' ? data.hasNext : (page * pageSize < total)
  );

  return { items, total, page, pageSize, hasNext };
}

export async function getMaquinas(q = "") {
  const url = q ? `${BASE}/maquinas?q=${encodeURIComponent(q)}` : `${BASE}/maquinas`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao buscar máquinas: ${res.status}`);
  return res.json();
}

export async function criarMaquina({ nome, tag, setor, critico }) {
  const res = await fetch(`${BASE}/maquinas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome,
      tag: tag ?? nome,       // se não mandar tag, usa o nome
      setor: setor ?? null,
      critico: !!critico
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Erro ao criar máquina (${res.status})`);
  return data; // { id, nome, tag, setor, critico }
}

export async function listarAgendamentos(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([,v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  const res = await fetch(`${BASE}/agendamentos?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Erro ao listar agendamentos (${res.status})`);
  return data; // array
}

export async function criarAgendamento({ maquinaId, descricao, itensChecklist, start, end }) {
  const res = await fetch(`${BASE}/agendamentos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maquinaId, descricao, itensChecklist, start, end })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Erro ao criar agendamento (${res.status})`);
  return data;
}

export async function atualizarAgendamento(id, { start, end, status }, headers = {}) {
  const res = await fetch(`${BASE}/agendamentos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ start, end, status })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ao atualizar agendamento (${res.status})`);
  return data;
}

export async function excluirAgendamento(id, headers = {}) {
  const res = await fetch(`${BASE}/agendamentos/${id}`, {
    method: "DELETE",
    headers
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ao excluir agendamento (${res.status})`);
  return data;
}

export async function iniciarAgendamento(id, { criadoPorEmail, role, email }) {
  const res = await fetch(`${BASE}/agendamentos/${id}/iniciar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": role || "manutentor",
      "x-user-email": email || criadoPorEmail
    },
    body: JSON.stringify({ criadoPorEmail })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Erro ao iniciar (${res.status})`);
  return data; // { ok: true, chamadoId }
}

// Detalhe
export async function getChamado(id) {
  const res = await fetch(`${BASE}/chamados/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Erro ao buscar chamado (${res.status})`);
  return data; // { id, maquina, tipo, status, descricao, criado_por, ... }
}

// Manutentores (para atribuição)
export async function listarManutentores(auth = {}) {
  const res = await fetch(`${BASE}/usuarios?role=manutentor`, {
    headers: {
      'x-user-role':  auth.role  || 'gestor',   // papel com permissão
      'x-user-email': auth.email || ''          // email do usuário logado
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ao listar manutentores (${res.status})`);
  // suporta {items:[...]} ou array direto
  return Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
}

// Causas-raiz
export async function listarCausasRaiz() {
  const res = await fetch(`${BASE}/causas`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Erro ao listar causas (${res.status})`);
  return data; // [{ nome }]
}

// Ações no chamado (endpoints finos para clareza)
export async function atribuirChamado(id, { manutentorEmail, role, email }) {
  const res = await fetch(`${BASE}/chamados/${id}/atribuir`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-role": role, "x-user-email": email },
    body: JSON.stringify({ manutentorEmail })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ao atribuir (${res.status})`);
  return data;
}
export async function removerAtribuicao(id, { role, email }) {
  const res = await fetch(`${BASE}/chamados/${id}/remover-atribuicao`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-role": role, "x-user-email": email }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ao remover atribuição (${res.status})`);
  return data;
}
export async function atenderChamado(id, { role, email } = {}) {
  const headers = {
    "Content-Type": "application/json",
    "x-user-role": role ? String(role).trim() : "",
    "x-user-email": email ? String(email).trim().toLowerCase() : ""
  };
  const res = await fetch(`${BASE}/chamados/${id}/atender`, {
    method: "POST",
    headers
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ao atender (${res.status})`);
  return data;
}
export async function adicionarObservacao(id, { texto, role, email }) {
  const res = await fetch(`${BASE}/chamados/${id}/observacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-role": role, "x-user-email": email },
    body: JSON.stringify({ texto })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ao salvar observação (${res.status})`);
  return data;
}
export async function concluirChamado(id, payload, { role, email }) {
  const res = await fetch(`${BASE}/chamados/${id}/concluir`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-role": role, "x-user-email": email },
    body: JSON.stringify(payload) // {tipo:'preventiva', checklist:[...] } OU {tipo:'corretiva', causa, solucao}
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ao concluir (${res.status})`);
  return data;
}
export async function deletarChamado(id, { role, email }) {
  const res = await fetch(`${BASE}/chamados/${id}`, {
    method: "DELETE",
    headers: { "x-user-role": role, "x-user-email": email }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ao excluir (${res.status})`);
  return data;
}

export async function getMaquina(id) {
  const res = await fetch(`${BASE}/maquinas/${id}`);
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : { error: await res.text() };
  if (!res.ok) throw new Error(data?.error || `Erro ao buscar máquina (${res.status})`);
  return data; // { id, nome, tag, setor, critico, chamadosAtivos: [...] }
}

export async function addChecklistItem(maquinaId, item, auth) {
  const r = await fetch(`${BASE}/maquinas/${maquinaId}/checklist-add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': auth?.role || '',
      'x-user-email': auth?.email || ''
    },
    body: JSON.stringify({ item })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || 'Falha ao adicionar item');
  return j;
}

export async function removeChecklistItem(maquinaId, item, auth) {
  const r = await fetch(`${BASE}/maquinas/${maquinaId}/checklist-remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': auth?.role || '',
      'x-user-email': auth?.email || ''
    },
    body: JSON.stringify({ item })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || 'Falha ao remover item');
  return j;
}

//Buscar checklist diário (itens atuais) de uma máquina
export async function getChecklistDiario(maquinaId) {
  const r = await fetch(`${BASE}/maquinas/${maquinaId}/checklist-diario`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Erro ao buscar checklist diário (${r.status})`);
  // backend pode devolver { items:[...]} ou array
  const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
  return items; // ex.: [{ id, texto, ordem }, ...]
}

//Enviar submissão do checklist diário (uma máquina por vez)
export async function enviarChecklistDiaria({
  operadorEmail,
  operadorNome,
  maquinaId,
  maquinaNome,
  date,       // 'YYYY-MM-DD'
  respostas,  // objeto { pergunta: 'sim'|'nao' }
}) {
  const res = await fetch(`${BASE}/checklists/daily/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'operador',
      'x-user-email': operadorEmail || '',
    },
    body: JSON.stringify({
      operadorEmail,
      operadorNome,
      maquinaId,
      maquinaNome,
      date,
      respostas,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Falha ao enviar checklist diário (${res.status})`);
  return data;
}

export async function listarChamadosPorMaquina(maquinaId, { status } = {}) {
  const u = new URL(`${BASE}/chamados`);
  u.searchParams.set('maquinaId', maquinaId);
  if (status) u.searchParams.set('status', status);
  const r = await fetch(u);
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || 'Falha ao listar chamados');
  return j.items || j;
}

export async function listarPecas() {
  const r = await fetch(`${BASE}/pecas`);
  const ct = r.headers.get('content-type') || '';
  const j = ct.includes('application/json') ? await r.json() : { error: await r.text() };
  if (!r.ok) throw new Error(j?.error || 'Falha ao listar peças');
  return j.items || j; // backend pode retornar {items:[...]} ou [...]
}

export async function excluirPeca(id, auth) {
  const r = await fetch(`${BASE}/pecas/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'x-user-role': auth?.role || '',
      'x-user-email': auth?.email || '',
    },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || 'Falha ao excluir peça');
  return j;
}

export async function criarPeca(payload, auth) {
  const r = await fetch(`${BASE}/pecas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': auth?.role || '',
      'x-user-email': auth?.email || '',
    },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || 'Falha ao criar peça');
  return j; // {id,codigo,nome,categoria,estoqueAtual,estoqueMinimo,localizacao}
}

export async function atualizarPeca(id, payload, auth) {
  const r = await fetch(`${BASE}/pecas/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': auth?.role || '',
      'x-user-email': auth?.email || '',
    },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || 'Falha ao atualizar peça');
  return j;
}

export async function listarCausas() {
  const r = await fetch(`${BASE}/causas`);
  const ct = r.headers.get('content-type') || '';
  const j = ct.includes('application/json') ? await r.json() : { error: await r.text() };
  if (!r.ok) throw new Error(j?.error || `Falha ao listar causas (${r.status})`);
  return j.items ?? j; // array
}

export async function criarCausa(payload, auth) {
  const r = await fetch(`${BASE}/causas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': auth?.role || '',
      'x-user-email': auth?.email || ''
    },
    body: JSON.stringify(payload)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || 'Falha ao criar causa');
  return j; // { id, nome }
}

export async function excluirCausa(id, auth) {
  const r = await fetch(`${BASE}/causas/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'x-user-role': auth?.role || '',
      'x-user-email': auth?.email || ''
    }
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || 'Falha ao excluir causa');
  return j;
}

export async function listarUsuarios(opts = {}) {
  const u = new URL(`${BASE}/usuarios`);
  if (opts.role) u.searchParams.set('role', String(opts.role))
  const r = await fetch(u.toString());
  const ct = r.headers.get('content-type') || '';
  const j = ct.includes('application/json') ? await r.json() : { error: await r.text() };
  if (!r.ok) throw new Error(j?.error || `Falha ao listar usuários (${r.status})`);
  return j.items ?? j; // array
}

export async function criarUsuario(data, { role, email } = {}) {
  // data pode conter: nome, usuario, email, role, funcao, senha?
  const r = await fetch(`${BASE}/usuarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': role || '',
      'x-user-email': email || ''
    },
    body: JSON.stringify(data)
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.error || `Falha ao criar usuário (${r.status})`);
  return json; // { id, nome, usuario, email, role, funcao }
}

export async function atualizarUsuario(id, data, { role, email } = {}) {
  // data pode conter: nome, usuario, email, role, funcao, senha? (para reset)
  const r = await fetch(`${BASE}/usuarios/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': role || '',
      'x-user-email': email || ''
    },
    body: JSON.stringify(data)
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.error || `Falha ao atualizar usuário (${r.status})`);
  return json;
}

export async function excluirUsuario(id, auth) {
  const r = await fetch(`${BASE}/usuarios/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'x-user-role': (auth?.role || '').toString().toLowerCase(),
      'x-user-email': auth?.email || ''
    }
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || 'Falha ao excluir usuário');
  return j;
}

export async function registrarMovimentacao(pecaId, { tipo, quantidade, descricao }, auth = {}) {
  const r = await fetch(`${BASE}/pecas/${encodeURIComponent(pecaId)}/movimentacoes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': auth.role || '',
      'x-user-email': auth.email || ''
    },
    body: JSON.stringify({ tipo, quantidade, descricao })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Falha ao registrar movimentação (${r.status})`);
  return data; // opcional: { ok: true, peca, movimentacao }
}

export async function listarMaquinas(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
  ).toString();

  const res = await fetch(`${BASE}/maquinas${qs ? `?${qs}` : ''}`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Erro ao listar máquinas (${res.status})`);
  }
  // suporta API que devolve {items:[...]} ou array direto
  return Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
}

export async function listarSubmissoesDiarias({ operadorEmail, date }) {
  const qs = new URLSearchParams({
    operadorEmail: operadorEmail || '',
    date: date || '',
  }).toString();

  const r = await fetch(`${BASE}/checklists/daily/submissoes?${qs}`);
  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(data?.error || `Erro ao listar submissões diárias (${r.status})`);
  }
  // backend pode devolver { items: [...] } ou array direto
  return Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
}

export async function obterMaquina(id) {
  const r = await fetch(`${BASE}/maquinas/${encodeURIComponent(id)}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Erro ao obter máquina (${r.status})`);
  // Esperado: { id, nome, tag, checklist_diario: [...] }
  return data;
}

export async function registrarSubmissaoDiaria({ operadorEmail, maquinaId, date, respostas }) {
  const r = await fetch(`${BASE}/checklists/daily/submissoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operadorEmail, maquinaId, date, respostas })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Erro ao registrar submissão (${r.status})`);
  return data;
}

export async function login({ userOrEmail, senha }) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: userOrEmail, senha })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Falha no login (${r.status})`);
  return data; // { id, nome, email, role, funcao, usuario }
}

export async function changePassword({ email, senhaAtual, novaSenha }) {
  const r = await fetch(`${BASE}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // cabeçalho útil se você já popula req.user pelo middleware
      'x-user-email': email || ''
    },
    body: JSON.stringify({ email, senhaAtual, novaSenha })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Falha ao alterar senha (${r.status})`);
  return data; // { ok: true }
}

export async function listarParetoCausas(params = {}, auth) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);   // se não usa período, pode remover
  if (params.to)   qs.set("to", params.to);

  const url = `${BASE}/analytics/pareto-causas${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: buildAuthHeaders(auth) });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Falha ao listar pareto (HTTP ${res.status})`);
  }
  return res.json(); // { total, items, from, to }
}

export async function enviarChecklistPreventiva(chamadoId, { respostas }) {
  const res = await fetch(`${BASE}/chamados/${chamadoId}/checklist/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ respostas })
  });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : { error: await res.text() };
  if (!res.ok) throw new Error(data?.error || `Erro ao enviar checklist (${res.status})`);
  return data;
}

export async function atualizarChecklistChamado(id, checklist, userEmail) {
  const res = await fetch(`${BASE}/chamados/${id}/checklist`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checklist, userEmail }), // <- ESSENCIAL
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : { error: await res.text() };
  if (!res.ok) throw new Error(data?.error || `Erro ao salvar checklist (${res.status})`);
  return data; // deve trazer { ok:true, corretivasGeradas: N }
}

export function connectSSE(handlers = {}) {
  const es = new EventSource(`${BASE}/events`);
  es.addEventListener('hello',       e => handlers.hello?.(JSON.parse(e.data)));
  es.addEventListener('chamados',    e => handlers.chamados?.(JSON.parse(e.data)));
  es.addEventListener('agendamentos',e => handlers.agendamentos?.(JSON.parse(e.data)));
  es.addEventListener('checklist',   e => handlers.checklist?.(JSON.parse(e.data)));
  es.addEventListener('pecas',       e => handlers.pecas?.(JSON.parse(e.data)));
  es.onerror = (err) => handlers.onError?.(err);
  es.onopen  = ()    => handlers.onOpen?.();
  return () => es.close();
}

export function subscribeSSE(onEvent, opts = {}) {
  // Se quiser passar algo (ex.: email) por querystring, habilite abaixo:
  const qs = new URLSearchParams();
  if (opts.email) qs.set('email', opts.email);

  const url = `${BASE}/events${qs.toString() ? `?${qs}` : ''}`;

  // Se o ambiente não suportar EventSource, apenas no-op
  if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
    console.warn('EventSource não disponível; subscribeSSE será no-op.');
    return () => {};
  }

  const es = new EventSource(url, { withCredentials: false });

  es.onmessage = (ev) => {
    if (!ev?.data) return;
    try {
      const data = JSON.parse(ev.data);
      // esperado algo como: { topic: "chamados", action: "created" | "picked" | "finished", id? ... }
      if (typeof onEvent === 'function') onEvent(data);
    } catch {
      // se não for JSON, ainda repassa como raw
      if (typeof onEvent === 'function') onEvent({ raw: ev.data });
    }
  };

  es.onerror = (err) => {
    // O EventSource tenta reconectar sozinho; só logamos
    console.warn('SSE error', err);
  };

  return () => {
    try { es.close(); } catch {}
  };
}