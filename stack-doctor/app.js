const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let step = 1;
let latest = null;
let inventory = [];

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
  return Object.fromEntries([...data.entries()].filter(([key]) => !["sensitive","taskTypes","capabilities"].includes(key)).concat([["sensitive", data.getAll("sensitive")],["taskTypes", data.getAll("taskTypes")],["capabilities", data.getAll("capabilities")],["inventory", inventory.map((item) => ({...item}))]]));
}

function render(report) {
  $("#score").textContent = report.score;
  $(".score-ring").style.background = `conic-gradient(var(--green) 0 ${report.score}%, #193126 ${report.score}% 100%)`;
  $("#band").textContent = report.band;
  $("#summary").textContent = report.summary;
  $("#savings").textContent = `$${report.annualSavings.toLocaleString()}/year`;
  $("#workload-summary").innerHTML = report.workloadSummary.map((x) => `<span class="profile-chip">${escapeHtml(x)}</span>`).join("");
  $("#inventory-summary").innerHTML = report.inventorySummary.length ? report.inventorySummary.map((x) => `<div class="inventory-result"><strong>${escapeHtml(x.name)}</strong><span>${escapeHtml(x.detail)}</span></div>`).join("") : "<p class=\"helper\">No itemized inventory supplied; recommendations use your aggregate totals.</p>";
  $("#decision-grid").innerHTML = report.decisions.map((x) => `<article class="decision ${escapeHtml(x.type)}"><span>${escapeHtml(x.type)}</span><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.reason)}</p><small>${escapeHtml(x.confidence)} confidence · ${escapeHtml(x.assumption)}</small></article>`).join("");
  $("#metric-grid").innerHTML = Object.entries(report.dimensions).map(([name, score]) => `<div class="metric"><span>${name[0].toUpperCase()+name.slice(1)}</span><strong>${score}</strong></div>`).join("");
  $("#actions").innerHTML = report.actions.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
  $("#stack").innerHTML = report.stack.map((x) => `<div class="stack-item"><strong>${escapeHtml(x.label)}</strong><span>${escapeHtml(x.advice)}</span></div>`).join("");
  $("#workflows").innerHTML = report.workflows.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
  $("#warnings").innerHTML = report.warnings.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

function inventoryRow(item, index) {
  const option = (value, label, selected) => `<option value="${value}"${selected === value ? " selected" : ""}>${label}</option>`;
  return `<div class="inventory-row" data-index="${index}">
    <label>Provider<input data-key="provider" maxlength="60" value="${escapeHtml(item.provider || "")}" placeholder="Anthropic, OpenAI, Google..."></label>
    <label>Model or tool<input data-key="name" maxlength="80" value="${escapeHtml(item.name || "")}" placeholder="Claude, ChatGPT, Gemini..."></label>
    <label>Access<select data-key="access">${option("subscription","Subscription",item.access)}${option("oauth","OAuth / bundled login",item.access)}${option("api","Metered API",item.access)}${option("local","Local model",item.access)}</select></label>
    <label>Plan<input data-key="plan" maxlength="60" value="${escapeHtml(item.plan || "")}" placeholder="Free, Pro, Team, pay-as-you-go"></label>
    <label>Monthly cost ($)<input data-key="cost" type="number" min="0" max="100000" step="0.01" value="${Number(item.cost || 0)}"></label>
    <label>Use<select data-key="usage">${option("daily","Daily",item.usage)}${option("weekly","Weekly",item.usage)}${option("monthly","Monthly",item.usage)}${option("rare","Rarely",item.usage)}${option("unused","Not in 30 days",item.usage)}</select></label>
    <label class="purpose">Primary purpose<input data-key="purpose" maxlength="100" value="${escapeHtml(item.purpose || "")}" placeholder="Coding, research, image generation..."></label>
    <button type="button" class="remove-inventory" aria-label="Remove ${escapeHtml(item.name || "item")}">×</button>
  </div>`;
}

function renderInventory() {
  $("#inventory-rows").innerHTML = inventory.map(inventoryRow).join("");
}

function addInventoryItem(item = {}) {
  inventory.push({ provider:"", name:"", access:"subscription", plan:"", cost:0, usage:"weekly", purpose:"", ...item });
  renderInventory();
}

function downloadInventory() {
  const blob = new Blob([JSON.stringify({ version:1, exportedAt:new Date().toISOString(), items:inventory }, null, 2)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "ai-stack-inventory.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function downloadReport() {
  if (!latest) return;
  const date = new Date().toLocaleDateString();
  const body = `<!doctype html><meta charset="utf-8"><title>AI Stack Doctor Report</title><style>body{font:16px system-ui;max-width:760px;margin:48px auto;padding:0 20px;line-height:1.5;color:#17211b}h1{font-size:42px}.score{font-size:64px;font-weight:800;color:#08794a}.box{border:1px solid #ccd8d0;border-radius:12px;padding:18px;margin:16px 0}li{margin:9px 0}small{color:#64736a}</style><h1>AI Stack Doctor</h1><p>Genesis AAS · ${date}</p><div class="score">${latest.score}/100</div><h2>${escapeHtml(latest.band)}</h2><p>${escapeHtml(latest.summary)}</p><div class="box"><h2>Estimated avoidable spend</h2><strong>$${latest.annualSavings.toLocaleString()}/year</strong><small><br>Directional estimate, not a guarantee.</small></div><h2>Declared model footprint</h2>${latest.inventorySummary.length ? `<ul>${latest.inventorySummary.map(x=>`<li><strong>${escapeHtml(x.name)}</strong> — ${escapeHtml(x.detail)}</li>`).join("")}</ul>` : "<p>No itemized inventory supplied.</p>"}<h2>Workload profile</h2><ul>${latest.workloadSummary.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul><h2>Keep / change plan</h2>${latest.decisions.map(x=>`<div class="box"><strong>${escapeHtml(x.type.toUpperCase())}: ${escapeHtml(x.title)}</strong><p>${escapeHtml(x.reason)}</p><small>${escapeHtml(x.confidence)} confidence · ${escapeHtml(x.assumption)}</small></div>`).join("")}<h2>Next moves</h2><ol>${latest.actions.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ol><h2>Workflows to automate</h2><ol>${latest.workflows.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ol><h2>Data-boundary watchlist</h2><ul>${latest.warnings.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul><hr><small>Educational diagnostic only. Your answers were processed locally in your browser.</small>`;
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
$("#inventory-rows").addEventListener("input", (event) => {
  const row = event.target.closest(".inventory-row");
  if (!row || !event.target.dataset.key) return;
  inventory[Number(row.dataset.index)][event.target.dataset.key] = event.target.value;
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
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items) || parsed.items.length > 100) throw new Error("Use a Stack Doctor inventory v1 JSON file with no more than 100 items.");
    inventory = parsed.items.map((item) => ({ provider:String(item.provider || "").slice(0,60), name:String(item.name || "").slice(0,80), access:["subscription","oauth","api","local"].includes(item.access) ? item.access : "subscription", plan:String(item.plan || "").slice(0,60), cost:Math.max(0, Number(item.cost || 0)), usage:["daily","weekly","monthly","rare","unused"].includes(item.usage) ? item.usage : "weekly", purpose:String(item.purpose || "").slice(0,100) }));
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
$("#restart-button").addEventListener("click", () => { results.classList.add("hidden"); hero.classList.remove("hidden"); form.reset(); inventory=[]; renderInventory(); showStep(1); latest = null; window.scrollTo({top:0,behavior:"smooth"}); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
