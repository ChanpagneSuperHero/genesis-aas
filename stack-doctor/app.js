const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let step = 1;
let latest = null;
let inventory = [];
let agentFootprint = [];
const inventoryCatalog = globalThis.StackDoctorCatalog || { models:[], plans:[] };
const agentComponentCatalog = {
  bot:["Engineering Lead bot","QA bot","Research bot","Project manager bot","Custom / unknown bot"],
  template:["Official marketplace template","Internal team template","Community template","Custom / unknown template"],
  mcp:["GitHub MCP","Filesystem MCP","Browser MCP","Slack MCP","Database MCP","Custom / unknown MCP"],
  plugin:["GitHub plugin","Cursor / coding plugin","Slack plugin","Browser plugin","Data / analytics plugin","Custom / unknown plugin"],
  routine:["Code review routine","Research routine","Publishing routine","Inbox / communications routine","Custom / unknown routine"],
  repository:["Production repository","Staging repository","Documentation repository","Multiple repositories","Unknown repository scope"],
  credential:["OAuth connection","API key","Browser session","Service account","Shared team secret","Unknown credential"],
  permission:["Read permission","Read/write permission","Administrative permission","External communication permission","Unknown permission"],
  job:["Nightly audit job","Scheduled research job","Issue triage job","Publishing job","Recurring external-action job","Custom / unknown job"]
};

const assessment = $("#assessment");
const hero = $("#hero");
const results = $("#results");
const form = $("#doctor-form");
const error = $("#form-error");

function showStep(next) {
  step = next;
  $$(".step").forEach((el) => el.classList.toggle("active", Number(el.dataset.step) === step));
  $("#progress-label").textContent = `Step ${step} of 5`;
  $("#progress-bar").style.width = `${step * 20}%`;
  $("#back-button").disabled = step === 1;
  $("#next-button").classList.toggle("hidden", step === 5);
  $("#submit-button").classList.toggle("hidden", step !== 5);
  error.textContent = "";
}

function currentStepValid() {
  const fields = [...document.querySelector(`.step[data-step="${step}"]`).querySelectorAll("input,select,textarea")];
  for (const field of fields) {
    if (!field.checkValidity()) { field.reportValidity(); return false; }
  }
  return true;
}

function values() {
  const data = new FormData(form);
  const result = Object.fromEntries([...data.entries()].filter(([key]) => !["sensitive","taskTypes","capabilities"].includes(key)).concat([["sensitive", data.getAll("sensitive")],["taskTypes", data.getAll("taskTypes")],["capabilities", data.getAll("capabilities")],["inventory", inventory.map((item) => ({...item}))],["agentFootprint", agentFootprint.map((item)=>({...item}))]]));
  result.tools = inventory.filter(item => item.cost > 0).length;
  result.activeTools = inventory.filter(item => item.usage !== "unused").length;
  result.spend = inventory.filter(item => item.access !== "api").reduce((sum,item)=>sum+Number(item.cost||0),0);
  result.apiSpend = inventory.filter(item => item.access === "api").reduce((sum,item)=>sum+Number(item.cost||0),0);
  return result;
}

function render(report) {
  $("#score").textContent = report.score;
  $(".score-ring").style.background = `conic-gradient(var(--green) 0 ${report.score}%, #193126 ${report.score}% 100%)`;
  $("#band").textContent = report.band;
  $("#summary").textContent = report.summary;
  $("#savings").textContent = `$${report.annualSavings.toLocaleString()}/year`;
  $("#workload-summary").innerHTML = report.workloadSummary.map((x) => `<span class="profile-chip">${escapeHtml(x)}</span>`).join("");
  $("#inventory-summary").innerHTML = report.inventorySummary.length ? report.inventorySummary.map((x) => `<div class="inventory-result"><strong>${escapeHtml(x.name)}</strong><span>${escapeHtml(x.detail)}</span></div>`).join("") : "<p class=\"helper\">No itemized inventory supplied; recommendations use your aggregate totals.</p>";
  $("#agent-footprint-score").textContent = report.agentFootprintSummary.length ? `Control score ${report.agentFootprintScore}/100 · ${report.agentRiskFindings.length} finding${report.agentRiskFindings.length === 1 ? "" : "s"}` : "No agent components declared. Add them during the assessment for a permissions and recovery review.";
  $("#agent-footprint-summary").innerHTML = report.agentFootprintSummary.length ? report.agentFootprintSummary.map((x)=>`<div class="inventory-result"><strong>${escapeHtml(x.name)}</strong><span>${escapeHtml(x.detail)}</span></div>`).join("") : "";
  $("#agent-risk-grid").innerHTML = report.agentRiskFindings.length ? report.agentRiskFindings.map((x)=>`<article class="decision ${x.severity === "high" ? "cancel" : "downgrade"}"><span>${escapeHtml(x.severity)} · ${escapeHtml(x.type)}</span><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.reason)}</p><small>Next: ${escapeHtml(x.remediation)}</small></article>`).join("") : "<article class=\"decision keep\"><span>clear</span><h3>No declared Agent Footprint finding</h3><p>Add every active agent component before treating this as a clean result.</p></article>";
  $("#catalog-freshness").textContent = `Catalog checked ${report.catalogAsOf}. Estimates use your workload assumptions and published API prices.`;
  $("#model-grid").innerHTML = report.modelRecommendations.map(modelCard).join("");
  $("#prescription-grid").innerHTML = Object.entries(report.prescription).map(([action,text])=>`<article class="prescription-card ${escapeHtml(action)}"><span>${escapeHtml(action)}</span><p>${escapeHtml(text)}</p></article>`).join("");
  $("#decision-grid").innerHTML = report.decisions.map((x) => `<article class="decision ${escapeHtml(x.type)}"><span>${escapeHtml(x.type)}</span><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.reason)}</p><small>${escapeHtml(x.confidence)} confidence · ${escapeHtml(x.assumption)}</small></article>`).join("");
  $("#metric-grid").innerHTML = Object.entries(report.dimensions).map(([name, score]) => `<div class="metric"><span>${name[0].toUpperCase()+name.slice(1)}</span><strong>${score}</strong></div>`).join("");
  $("#actions").innerHTML = report.actions.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
  $("#stack").innerHTML = report.stack.map((x) => `<div class="stack-item"><strong>${escapeHtml(x.label)}</strong><span>${escapeHtml(x.advice)}</span></div>`).join("");
  $("#workflows").innerHTML = report.workflows.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
  $("#warnings").innerHTML = report.warnings.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
}

function money(value) {
  if (value === null || value === undefined) return "Variable pricing";
  if (value === 0) return "$0 API usage + local hardware";
  return `~$${Number(value).toLocaleString(undefined, {maximumFractionDigits:2})}/month API usage`;
}

function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : "#"; }
  catch { return "#"; }
}

function modelCard(model) {
  return `<article class="model-card">
    <span class="model-role">${escapeHtml(model.role)}</span>
    <h3>${escapeHtml(model.provider)} · ${escapeHtml(model.name)}</h3>
    <p class="model-price">${escapeHtml(money(model.estimatedMonthlyCost))}</p>
    <dl><div><dt>Access</dt><dd>${escapeHtml(model.plan)}</dd></div><div><dt>Mode</dt><dd>${escapeHtml(model.mode)}</dd></div></dl>
    <div class="score-bars" aria-label="Comparison scores">
      ${scoreBar("Work Fit",model.workFit)}${scoreBar("Value",model.value)}${scoreBar("Coverage",model.coverage)}
    </div>
    <p>${escapeHtml(model.why)}</p>
    ${model.note ? `<small>${escapeHtml(model.note)}</small>` : ""}
    <div class="model-links"><a href="${safeUrl(model.link)}" target="_blank" rel="noopener noreferrer">Official access</a><a href="${safeUrl(model.source)}" target="_blank" rel="noopener noreferrer">Pricing/source</a></div>
    <small>${escapeHtml(model.confidence)} confidence</small>
  </article>`;
}

function scoreBar(label, value) {
  const score = Math.max(0,Math.min(100,Number(value)||0));
  return `<div class="score-bar"><span>${escapeHtml(label)}</span><div><i style="width:${score}%"></i></div><strong>${score}</strong></div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}"${selected === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function providers() {
  return [...new Set([...inventoryCatalog.models.map(x=>x.provider), ...inventoryCatalog.plans.map(x=>x.provider)])];
}

function modelsFor(provider) {
  const rows = inventoryCatalog.models.filter(x=>x.provider===provider);
  return rows.length ? rows : [{id:"other-unknown-model",name:"Not listed / unsure"}];
}

function plansFor(provider) {
  const rows = inventoryCatalog.plans.filter(x=>x.provider===provider);
  return rows.length ? rows : inventoryCatalog.plans.filter(x=>x.id==="other-unknown");
}

function normalizeInventoryItem(item={}) {
  const provider = providers().includes(item.provider) ? item.provider : "Other / not listed";
  const models = modelsFor(provider);
  const plans = plansFor(provider);
  const model = models.find(x=>x.id===item.modelId) || models.find(x=>x.name===item.name) || models[0];
  const plan = plans.find(x=>x.id===item.planId) || plans.find(x=>x.name===item.plan) || plans[0];
  return {provider,modelId:model.id,name:model.name,planId:plan.id,plan:plan.name,access:plan.access,cost:plan.cost,usage:["daily","weekly","monthly","rare","unused"].includes(item.usage)?item.usage:"weekly",purpose:item.purpose||"general",metered:Boolean(plan.metered),source:plan.source};
}

function inventoryRow(rawItem, index) {
  const item = normalizeInventoryItem(rawItem);
  inventory[index] = item;
  const price = item.metered ? "Metered usage · no fixed monthly fee" : `$${Number(item.cost).toFixed(2)}/month catalog price`;
  return `<div class="inventory-row" data-index="${index}">
    <label>Provider<select data-key="provider">${providers().map(x=>option(x,x,item.provider)).join("")}</select></label>
    <label>Model<select data-key="modelId">${modelsFor(item.provider).map(x=>option(x.id,x.name,item.modelId)).join("")}</select></label>
    <label>Plan / access<select data-key="planId">${plansFor(item.provider).map(x=>option(x.id,x.name,item.planId)).join("")}</select></label>
    <label>Use<select data-key="usage">${option("daily","Daily",item.usage)}${option("weekly","Weekly",item.usage)}${option("monthly","Monthly",item.usage)}${option("rare","Rarely",item.usage)}${option("unused","Not in 30 days",item.usage)}</select></label>
    <label>Primary purpose<select data-key="purpose">${option("general","General assistant",item.purpose)}${option("writing","Writing",item.purpose)}${option("coding","Coding",item.purpose)}${option("research","Research",item.purpose)}${option("analysis","Analysis",item.purpose)}${option("media","Media creation",item.purpose)}${option("automation","Automation",item.purpose)}</select></label>
    <div class="catalog-price"><span>${escapeHtml(price)}</span><small>${escapeHtml(item.access)} · checked ${escapeHtml(inventoryCatalog.asOf)} · <a href="${safeUrl(item.source)}" target="_blank" rel="noopener noreferrer">pricing source</a></small></div>
    <button type="button" class="remove-inventory" aria-label="Remove ${escapeHtml(item.name || "item")}">×</button>
  </div>`;
}

function renderInventory() {
  $("#inventory-rows").innerHTML = inventory.map(inventoryRow).join("");
}

function addInventoryItem(item = {}) {
  inventory.push(normalizeInventoryItem({ provider:"OpenAI", usage:"weekly", purpose:"general", ...item }));
  renderInventory();
}

function normalizeAgentComponent(item={}) {
  const category = Object.keys(agentComponentCatalog).includes(item.category) ? item.category : "bot";
  const names = agentComponentCatalog[category];
  const name = names.includes(item.name) ? item.name : names[0];
  return {
    category,name,
    usage:["active","occasional","unused","unknown"].includes(item.usage)?item.usage:"active",
    provenance:["official","internal","community","unknown"].includes(item.provenance)?item.provenance:"unknown",
    access:["none","read","readwrite","admin","unknown"].includes(item.access)?item.access:"unknown",
    persistence:["none","session","durable","unknown"].includes(item.persistence)?item.persistence:"unknown",
    approval:["required","partial","none","unknown"].includes(item.approval)?item.approval:"unknown",
    audit:["full","partial","none","unknown"].includes(item.audit)?item.audit:"unknown",
    recovery:["tested","documented","none","unknown"].includes(item.recovery)?item.recovery:"unknown",
    external:["yes","no","unknown"].includes(item.external)?item.external:"unknown",
    overlap:["yes","no","unknown"].includes(item.overlap)?item.overlap:"unknown"
  };
}

function agentComponentRow(rawItem,index) {
  const item=normalizeAgentComponent(rawItem); agentFootprint[index]=item;
  const opts=(values,labels,key)=>values.map((value,i)=>option(value,labels?.[i]||value,item[key])).join("");
  return `<div class="inventory-row agent-component-row" data-index="${index}">
    <label>Component<select data-agent-key="category">${Object.keys(agentComponentCatalog).map(x=>option(x,x === "mcp" ? "MCP server" : x === "job" ? "Recurring job" : x[0].toUpperCase()+x.slice(1),item.category)).join("")}</select></label>
    <label>Name / role<select data-agent-key="name">${agentComponentCatalog[item.category].map(x=>option(x,x,item.name)).join("")}</select></label>
    <label>Use<select data-agent-key="usage">${opts(["active","occasional","unused","unknown"],["Active","Occasional","Not in 30 days","Unknown"],"usage")}</select></label>
    <label>Provenance<select data-agent-key="provenance">${opts(["official","internal","community","unknown"],["Official / first-party","Internally reviewed","Community / third-party","Unknown"],"provenance")}</select></label>
    <label>Access<select data-agent-key="access">${opts(["none","read","readwrite","admin","unknown"],["None","Read only","Read / write","Administrative","Unknown"],"access")}</select></label>
    <label>Persistence<select data-agent-key="persistence">${opts(["none","session","durable","unknown"],["None","Session only","Durable sessions / credentials","Unknown"],"persistence")}</select></label>
    <label>Approval<select data-agent-key="approval">${opts(["required","partial","none","unknown"],["Required for consequential actions","Partial / some actions","No approval gate","Unknown"],"approval")}</select></label>
    <label>Audit<select data-agent-key="audit">${opts(["full","partial","none","unknown"],["Full attributable action log","Partial log","No dependable log","Unknown"],"audit")}</select></label>
    <label>Recovery<select data-agent-key="recovery">${opts(["tested","documented","none","unknown"],["Tested rollback / offboarding","Documented, not tested","Missing","Unknown"],"recovery")}</select></label>
    <label>External actions<select data-agent-key="external">${opts(["yes","no","unknown"],["Yes","No","Unknown"],"external")}</select></label>
    <label>Overlaps another<select data-agent-key="overlap">${opts(["yes","no","unknown"],["Yes","No","Unknown"],"overlap")}</select></label>
    <button type="button" class="remove-inventory remove-agent-component" aria-label="Remove ${escapeHtml(item.name)}">×</button>
  </div>`;
}

function renderAgentFootprint(){ $("#agent-footprint-rows").innerHTML=agentFootprint.map(agentComponentRow).join(""); }
function addAgentComponent(item={}){ agentFootprint.push(normalizeAgentComponent(item)); renderAgentFootprint(); }
function downloadAgentFootprint(){
  const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),components:agentFootprint},null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="ai-stack-doctor-agent-footprint.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function downloadInventory() {
  const blob = new Blob([JSON.stringify({ version:2, catalogAsOf:inventoryCatalog.asOf, exportedAt:new Date().toISOString(), items:inventory }, null, 2)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "ai-stack-inventory.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function downloadReport() {
  if (!latest) return;
  const date = new Date().toLocaleDateString();
  const body = `<!doctype html><meta charset="utf-8"><title>AI Stack Doctor Report</title><style>body{font:16px system-ui;max-width:760px;margin:48px auto;padding:0 20px;line-height:1.5;color:#17211b}h1{font-size:42px}.score{font-size:64px;font-weight:800;color:#08794a}.box{border:1px solid #ccd8d0;border-radius:12px;padding:18px;margin:16px 0}li{margin:9px 0}small{color:#64736a}</style><h1>AI Stack Doctor</h1><p>Genesis AAS · ${date}</p><div class="score">${latest.score}/100</div><h2>${escapeHtml(latest.band)}</h2><p>${escapeHtml(latest.summary)}</p><div class="box"><h2>Estimated avoidable spend</h2><strong>$${latest.annualSavings.toLocaleString()}/year</strong><small><br>Directional estimate, not a guarantee.</small></div><h2>Declared model footprint</h2>${latest.inventorySummary.length ? `<ul>${latest.inventorySummary.map(x=>`<li><strong>${escapeHtml(x.name)}</strong> — ${escapeHtml(x.detail)}</li>`).join("")}</ul>` : "<p>No itemized inventory supplied.</p>"}<h2>Agent Footprint</h2><p>Control score ${latest.agentFootprintScore}/100</p>${latest.agentFootprintSummary.length ? `<ul>${latest.agentFootprintSummary.map(x=>`<li><strong>${escapeHtml(x.name)}</strong> — ${escapeHtml(x.detail)}</li>`).join("")}</ul>` : "<p>No agent components declared.</p>"}${latest.agentRiskFindings.map(x=>`<div class="box"><strong>${escapeHtml(x.severity.toUpperCase())} · ${escapeHtml(x.type)} · ${escapeHtml(x.title)}</strong><p>${escapeHtml(x.reason)}</p><small>Next: ${escapeHtml(x.remediation)}</small></div>`).join("")}<h2>Workload profile</h2><ul>${latest.workloadSummary.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul><h2>Recommended stack comparison</h2><p><small>Catalog checked ${escapeHtml(latest.catalogAsOf)}. Ranked before monetization; official links only.</small></p>${latest.modelRecommendations.map(x=>`<div class="box"><strong>${escapeHtml(x.role)}: ${escapeHtml(x.provider)} · ${escapeHtml(x.name)}</strong><p>Work Fit ${x.workFit} · Value ${x.value} · Coverage ${x.coverage}</p><p>${escapeHtml(x.why)}</p><p>${escapeHtml(x.plan)} · ${escapeHtml(x.mode)} · ${escapeHtml(money(x.estimatedMonthlyCost))}</p><small>${escapeHtml(x.confidence)} confidence${x.note ? ` · ${escapeHtml(x.note)}` : ""}</small><p><a href="${safeUrl(x.link)}">Official access</a> · <a href="${safeUrl(x.source)}">Pricing/source</a></p></div>`).join("")}<h2>Your prescription</h2>${Object.entries(latest.prescription).map(([action,text])=>`<div class="box"><strong>${escapeHtml(action.toUpperCase())}</strong><p>${escapeHtml(text)}</p></div>`).join("")}<h2>Keep / change plan</h2>${latest.decisions.map(x=>`<div class="box"><strong>${escapeHtml(x.type.toUpperCase())}: ${escapeHtml(x.title)}</strong><p>${escapeHtml(x.reason)}</p><small>${escapeHtml(x.confidence)} confidence · ${escapeHtml(x.assumption)}</small></div>`).join("")}<h2>Next moves</h2><ol>${latest.actions.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ol><h2>Workflows to automate</h2><ol>${latest.workflows.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ol><h2>Data-boundary watchlist</h2><ul>${latest.warnings.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul><hr><small>Educational diagnostic only. Your answers were processed locally in your browser.</small>`;
  const blob = new Blob([body], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "ai-stack-doctor-report.html"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$("#start-button").addEventListener("click", () => { hero.classList.add("hidden"); assessment.classList.remove("hidden"); assessment.scrollIntoView(); });
$("#next-button").addEventListener("click", () => { if (currentStepValid()) showStep(step + 1); });
$("#back-button").addEventListener("click", () => showStep(step - 1));
$("#add-inventory").addEventListener("click", () => addInventoryItem());
$("#inventory-export").addEventListener("click", downloadInventory);
$("#add-agent-component").addEventListener("click",()=>addAgentComponent());
$("#agent-footprint-export").addEventListener("click",downloadAgentFootprint);
$("#agent-footprint-rows").addEventListener("change",event=>{
  const row=event.target.closest(".agent-component-row"); if(!row||!event.target.dataset.agentKey)return;
  const index=Number(row.dataset.index), key=event.target.dataset.agentKey;
  if(key==="category") agentFootprint[index]=normalizeAgentComponent({category:event.target.value});
  else agentFootprint[index][key]=event.target.value;
  renderAgentFootprint();
});
$("#agent-footprint-rows").addEventListener("click",event=>{const button=event.target.closest(".remove-agent-component");if(!button)return;agentFootprint.splice(Number(button.closest(".agent-component-row").dataset.index),1);renderAgentFootprint();});
$("#inventory-rows").addEventListener("change", (event) => {
  const row = event.target.closest(".inventory-row");
  if (!row || !event.target.dataset.key) return;
  const index = Number(row.dataset.index);
  const key = event.target.dataset.key;
  if (key === "provider") inventory[index] = normalizeInventoryItem({provider:event.target.value,usage:inventory[index].usage,purpose:inventory[index].purpose});
  else if (key === "modelId") inventory[index] = normalizeInventoryItem({...inventory[index],modelId:event.target.value});
  else if (key === "planId") inventory[index] = normalizeInventoryItem({...inventory[index],planId:event.target.value});
  else inventory[index][key] = event.target.value;
  renderInventory();
});
$("#inventory-rows").addEventListener("click", (event) => {
  const button = event.target.closest(".remove-inventory");
  if (!button) return;
  inventory.splice(Number(button.closest(".inventory-row").dataset.index), 1);
  renderInventory();
});
$("#inventory-import").addEventListener("change", async (event) => {
  try {
    const parsed = JSON.parse(await event.target.files[0].text());
    if (!parsed || ![1,2].includes(parsed.version) || !Array.isArray(parsed.items) || parsed.items.length > 100) throw new Error("Use a Stack Doctor inventory v1 or v2 JSON file with no more than 100 items.");
    inventory = parsed.items.map(normalizeInventoryItem);
    renderInventory(); error.textContent = "Inventory imported locally.";
  } catch (err) { error.textContent = err.message || "Could not import that inventory."; }
  event.target.value = "";
});
$$('[name="sensitive"]').forEach((box) => box.addEventListener("change", () => {
  const none = $('[name="sensitive"][value="none"]');
  if (box.value === "none" && box.checked) {
    $$('[name="sensitive"]').filter((item) => item !== none).forEach((item) => { item.checked = false; });
  } else if (box.checked) {
    none.checked = false;
  }
}));
$$('input[type="range"]').forEach((slider) => slider.addEventListener("input", () => {
  const output = document.querySelector(`output[data-for="${slider.name}"]`);
  if (output) output.value = slider.value;
}));
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentStepValid()) return;
  latest = StackDoctorEngine.evaluate(values());
  render(latest);
  assessment.classList.add("hidden"); results.classList.remove("hidden"); results.scrollIntoView();
});
$("#download-button").addEventListener("click", downloadReport);
$("#restart-button").addEventListener("click", () => { results.classList.add("hidden"); hero.classList.remove("hidden"); form.reset(); inventory=[]; agentFootprint=[]; renderInventory(); renderAgentFootprint(); showStep(1); latest = null; window.scrollTo({top:0,behavior:"smooth"}); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
