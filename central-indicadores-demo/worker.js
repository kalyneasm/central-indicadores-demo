export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return json({ ok: true, mode: "demo" });
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    if (!env.DB) return json({ mensagem: "Banco demonstrativo não configurado." }, 503);
    const path = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
    const method = request.method.toUpperCase();
    const collectionMap = {
      indicators: "indicators", results: "results", actions: "actions", bi: "bi",
      raci: "raci", meetings: "meetings", deliberations: "deliberations",
      "bi-validations": "validations"
    };
    const collection = collectionMap[path[0]];
    try {
      if (path[0] === "departments" && method === "GET") {
        return json(["Operações", "Atendimento", "Qualidade", "Financeiro", "Recursos Humanos"]);
      }
      if (path[0] === "summary" && method === "GET") {
        const indicators = await all(env.DB, "indicators");
        const actions = await all(env.DB, "actions");
        const today = new Date().toISOString().slice(0,10);
        const statuses = {};
        actions.forEach(({data:a}) => { const s = a.status || "Não informado"; statuses[s]=(statuses[s]||0)+1; });
        return json({
          total: indicators.length,
          open_actions: actions.filter(({data:a}) => !/conclu|encerrad/i.test(a.status || "")).length,
          overdue_actions: actions.filter(({data:a}) => a.due_date && a.due_date < today && !/conclu|encerrad/i.test(a.status || "")).length,
          statuses: Object.entries(statuses).map(([status,c]) => ({status,c}))
        });
      }
      if (!collection) return json({ mensagem: "Rota não encontrada." }, 404);

      if (method === "GET" && path.length === 1) {
        const rows = await all(env.DB, collection);
        return json(rows.map(r => normalize(collection, r.data, r.id)));
      }
      if (method === "POST" && path.length === 1) {
        const body = await request.json();
        if (collection === "indicators" && !(body.codigo || body.code) ) return json({mensagem:"Informe o código do indicador."},400);
        if (collection === "actions" && !(body.titulo || body.title)) return json({mensagem:"Informe o título do plano."},400);
        if (collection === "bi" && !body.name) return json({mensagem:"Informe o nome do projeto."},400);
        if (collection === "meetings" && (!body.meeting_date || !body.title)) return json({mensagem:"Informe data e título da reunião."},400);
        if (collection === "deliberations" && !(body.descricao || body.description)) return json({mensagem:"Informe a descrição."},400);
        const id = Number(body.id) || await nextId(env.DB, collection);
        const data = {...body}; delete data.id;
        await env.DB.prepare("INSERT INTO records (collection,id,data,updated_at) VALUES (?1,?2,?3,datetime('now')) ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at")
          .bind(collection,id,JSON.stringify(data)).run();
        return json(normalize(collection, data, id), 201);
      }
      if (method === "PUT" && collection === "results" && path.length === 2) {
        const id = Number(path[1]); const body = await request.json();
        const old = await getOne(env.DB, collection, id);
        if (!old) return json({mensagem:"Resultado não encontrado."},404);
        const data = {...old.data,...body}; delete data.id;
        await put(env.DB,collection,id,data); return json(normalize(collection, data, id));
      }
      if ((method === "PATCH" || method === "POST") && path.length >= 2) {
        const body = await request.json();
        let id = Number(body.id || path[1]);
        if (path[1] === "status" || path[1] === "efficacy") {
          id = Number(body.id);
        }
        if (!id) return json({mensagem:"Identificador inválido."},400);
        const old = await getOne(env.DB, collection, id);
        if (!old) return json({mensagem:"Registro não encontrado."},404);
        const patch = {...body}; delete patch.id;
        const data = {...old.data,...patch}; delete data.id;
        await put(env.DB,collection,id,data); return json(normalize(collection, data, id));
      }
      return json({mensagem:"Método não permitido."},405);
    } catch (err) {
      return json({mensagem:"Erro na demonstração.", detalhe: String(err?.message || err)},500);
    }
  }
};
async function all(db, collection) {
  const result = await db.prepare("SELECT id, data FROM records WHERE collection=?1 ORDER BY id").bind(collection).all();
  return (result.results || []).map(r => ({id:r.id,data:JSON.parse(r.data)}));
}
async function getOne(db, collection, id) {
  const r = await db.prepare("SELECT id,data FROM records WHERE collection=?1 AND id=?2").bind(collection,id).first();
  return r ? {id:r.id,data:JSON.parse(r.data)} : null;
}
async function nextId(db, collection) {
  const r = await db.prepare("SELECT COALESCE(MAX(id),0)+1 AS id FROM records WHERE collection=?1").bind(collection).first();
  return r.id;
}
async function put(db, collection, id, data) {
  await db.prepare("INSERT INTO records (collection,id,data,updated_at) VALUES (?1,?2,?3,datetime('now')) ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at")
    .bind(collection,id,JSON.stringify(data)).run();
}
function json(value,status=200) {
  return new Response(JSON.stringify(value), {status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
}

function normalize(collection, data, id) {
  const x = {...data, id};
  if (collection === "indicators") {
    x.codigo = x.codigo ?? x.code ?? "";
    x.code = x.code ?? x.codigo;
    x.departamento = x.departamento ?? x.department ?? "";
    x.department = x.department ?? x.departamento;
    x.nome = x.nome ?? x.name ?? "";
    x.name = x.name ?? x.nome;
    x.objetivo = x.objetivo ?? x.objective ?? "";
  }
  if (collection === "results") {
    x.period = x.period ?? x.periodo ?? "";
    x.periodo = x.periodo ?? x.period;
    x.actual = x.actual ?? x.resultado ?? 0;
    x.resultado = x.resultado ?? x.actual;
    x.target = x.target ?? x.meta ?? 0;
    x.meta = x.meta ?? x.target;
    const indicatorId = Number(x.indicadorId ?? x.indicador_id ?? x.indicator_id);
    x.indicadorId = indicatorId;
    x.indicador_id = indicatorId;
    x.indicator_id = indicatorId;
  }
  if (collection === "actions") {
    x.title = x.title ?? x.titulo ?? "";
    x.titulo = x.titulo ?? x.title;
    x.metodo_gestao = x.metodo_gestao ?? x.metodo ?? "";
    x.owner_name = x.owner_name ?? x.responsavel ?? x.owner ?? "";
    x.due_date = x.due_date ?? x.prazo ?? null;
    x.dados_metodo = x.dados_metodo ?? x.dadosMetodo ?? {};
  }
  return x;
}
