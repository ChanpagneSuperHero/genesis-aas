const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let step = 1;
let latest = null;

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
  return Object.fromEntries([...data.entries()].filter(([key]) => !["sensitive","taskTypes","capabilities"].includes(key)).concat([["sensitive", data.getAll("sensitive")],["taskTypes", data.getAll("taskTypes")],["capabilities", data.getAll("capabilities")]]));
}

function render(report) {
  $("#score").textContent = report.score;
  $(".score-ring").style.background = `conic-gradient(var(--green) 0 ${report.score}%, #193126 ${report.score}% 100%)`;
  $("#band").textContent = report.band;
  $("#summary").textContent = report.summary;
  $("#savings").textContent = `$${report.annualSavings.toLocaleString()}/year`;
  $("#workload-summary").innerHTML = report.workloadSummary.map((x) => `<span class="profile-chip">${escapeHtml(x)}</span>`).join("");
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

function downloadReport() {
  if (!latest) return;
  const date = new Date().toLocaleDateString();
  const body = `<!doctype html><meta charset="utf-8"><title>AI Stack Doctor Report</title><style>body{font:16px system-ui;max-width:760px;margin:48px auto;padding:0 20px;line-height:1.5;color:#17211b}h1{font-size:42px}.score{font-size:64px;font-weight:800;color:#08794a}.box{border:1px solid #ccd8d0;border-radius:12px;padding:18px;margin:16px 0}li{margin:9px 0}small{color:#64736a}</style><h1>AI Stack Doctor</h1><p>Genesis AAS · ${date}</p><div class="score">${latest.score}/100</div><h2>${escapeHtml(latest.band)}</h2><p>${escapeHtml(latest.summary)}</p><div class="box"><h2>Estimated avoidable spend</h2><strong>$${latest.annualSavings.toLocaleString()}/year</strong><small><br>Directional estimate, not a guarantee.</small></div><h2>Workload profile</h2><ul>${latest.workloadSummary.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul><h2>Keep / change plan</h2>${latest.decisions.map(x=>`<div class="box"><strong>${escapeHtml(x.type.toUpperCase())}: ${escapeHtml(x.title)}</strong><p>${escapeHtml(x.reason)}</p><small>${escapeHtml(x.confidence)} confidence · ${escapeHtml(x.assumption)}</small></div>`).join("")}<h2>Next moves</h2><ol>${latest.actions.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ol><h2>Workflows to automate</h2><ol>${latest.workflows.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ol><h2>Data-boundary watchlist</h2><ul>${latest.warnings.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul><hr><small>Educational diagnostic only. Your answers were processed locally in your browser.</small>`;
  const blob = new Blob([body], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "ai-stack-doctor-report.html"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$("#start-button").addEventListener("click", () => { hero.classList.add("hidden"); assessment.classList.remove("hidden"); assessment.scrollIntoView(); });
$("#next-button").addEventListener("click", () => { if (currentStepValid()) showStep(step + 1); });
$("#back-button").addEventListener("click", () => showStep(step - 1));
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
$("#restart-button").addEventListener("click", () => { results.classList.add("hidden"); hero.classList.remove("hidden"); form.reset(); showStep(1); latest = null; window.scrollTo({top:0,behavior:"smooth"}); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
