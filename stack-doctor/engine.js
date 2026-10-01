(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.StackDoctorEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
  const list = (value) => Array.isArray(value) ? value : [];
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const roleWorkflows = {
    founder: ["Weekly decision brief from email, calendar, and project notes", "Customer-interview synthesis with evidence links", "Draft-and-review pipeline for proposals and follow-ups"],
    operator: ["Turn recurring requests into a triaged operating queue", "Convert meetings into owners, deadlines, and follow-up drafts", "Generate SOP drafts from completed work, then human-review them"],
    creator: ["Repurpose one source into platform-specific drafts", "Research and claim-check content before publishing", "Maintain a reusable idea, hook, and proof library"],
    consultant: ["Convert discovery notes into scoped proposals", "Create client-ready summaries with assumptions and exclusions", "Produce repeatable audit reports from a standard intake"],
    developer: ["Turn issue descriptions into testable implementation plans", "Automate regression-test and release-note drafting", "Route coding tasks by complexity instead of one-model-for-everything"],
    team: ["Create a governed internal AI request desk", "Detect duplicate subscriptions and inactive seats quarterly", "Require human approval for external, financial, or destructive actions"]
  };
  const taskLabels = { writing:"Writing", coding:"Coding", research:"Research", analysis:"Strategy", media:"Media", automation:"Automation" };
  const sizeLabels = { small:"small context", medium:"medium context", large:"large context", maximum:"maximum context" };
  const catalog = typeof module === "object" && module.exports ? require("./catalog.js") : (globalThis.StackDoctorCatalog || {asOf:"unknown",models:[]});
  const contextRank = {small:1,medium:2,large:3,maximum:4};

  function estimatedApiCost(model, input) {
    if (model.input === null || model.output === null) return null;
    if (model.tier === "local") return 0;
    const inputTokens = {small:4000,medium:25000,large:150000,maximum:500000}[input.contextSize] || 25000;
    const outputTokens = {short:1000,medium:5000,large:20000}[input.outputSize] || 5000;
    const reasoningMultiplier = input.reasoningDepth === "frontier" ? 1.5 : input.reasoningDepth === "routine" ? .75 : 1;
    return ((inputTokens * model.input + outputTokens * model.output * reasoningMultiplier) / 1000000) * number(input.runsPerMonth,40);
  }

  function recommendModels(input) {
    const tasks = list(input.taskTypes).length ? list(input.taskTypes) : ["writing"];
    const requiredContext = contextRank[input.contextSize] || 2;
    const quality = number(input.quality,3);
    const speed = number(input.speedPriority,3);
    const privacy = number(input.privacyPriority,3);
    const requiresMedia = tasks.includes("media") || list(input.capabilities).includes("multimodal");
    const localRequired = list(input.capabilities).includes("local") || privacy >= 5;
    const scored = catalog.models.map(model => {
      let score = tasks.filter(task => model.tasks.includes(task)).length * 8;
      score += model.quality * quality + model.speed * speed;
      score += contextRank[model.context] >= requiredContext ? 12 : -25;
      if (requiresMedia) score += model.modalities.length > 2 ? 14 : model.modalities.includes("image") ? 5 : -25;
      if (localRequired) score += model.tier === "local" ? 35 : -8;
      else if (privacy >= 4 && model.tier === "local") score += 12;
      if (number(input.costSensitivity,3) >= 4) score += model.tier === "economy" || model.tier === "local" ? 15 : model.tier === "frontier" ? -8 : 4;
      if (input.reasoningDepth === "frontier") score += model.tier === "frontier" ? 22 : model.tier === "economy" || model.tier === "local" ? -15 : 5;
      if (number(input.runsPerMonth,40) >= 250) score += model.tier === "economy" ? 20 : model.tier === "frontier" ? -10 : 5;
      return {...model,score,cost:estimatedApiCost(model,input)};
    }).sort((a,b)=>b.score-a.score);
    const picks = [];
    const add = (role, model, why) => {
      if (!model || picks.some(item => item.id === model.id)) return;
      const taskCoverage = tasks.filter(task=>model.tasks.includes(task)).length / tasks.length;
      const contextCoverage = contextRank[model.context] >= requiredContext ? 1 : .35;
      const modalityCoverage = !requiresMedia ? 1 : model.modalities.length > 2 ? 1 : model.modalities.includes("image") ? .55 : 0;
      const workFit = clamp(model.score);
      const coverage = clamp(taskCoverage * 70 + contextCoverage * 20 + modalityCoverage * 10);
      const costPenalty = model.cost === null ? 18 : Math.log10(model.cost + 1) * 18;
      const value = clamp(workFit - costPenalty + number(input.costSensitivity,3) * 5);
      picks.push({...model,role,why,workFit,value,coverage,estimatedMonthlyCost:model.cost,confidence:model.score >= 65 ? "high" : model.score >= 45 ? "medium" : "low"});
    };
    add("Best fit",scored[0],"Highest fit across your tasks, quality, context, speed, privacy, and cost priorities.");
    const economy = scored.filter(x=>["economy","local"].includes(x.tier)).sort((a,b)=>(a.cost??999999)-(b.cost??999999) || b.score-a.score)[0];
    add("Lower-cost option",economy,"Use for bounded or high-volume work, escalating exceptions to the best-fit model.");
    const premium = scored.filter(x=>x.tier==="frontier").sort((a,b)=>b.score-a.score)[0];
    add("Premium escalation",premium,"Reserve for difficult judgment, maximum-context work, or costly failure modes.");
    if (privacy >= 4 || localRequired) add("Private/local option",scored.filter(x=>x.tier==="local").sort((a,b)=>b.score-a.score)[0],"Use where data should remain on controlled hardware and the quality threshold permits it.");
    add("Strong alternative",scored.find(x=>!picks.some(item=>item.id===x.id)),"A credible second provider for resilience, price checks, or side-by-side quality testing.");
    return picks.slice(0,4);
  }

  function analyzeAgentFootprint(input) {
    const items = list(input.agentFootprint).filter(item => item && item.category);
    const findings = [];
    const add = (type, severity, title, reason, remediation) => findings.push({type,severity,title,reason,remediation});
    const label = item => item.name || item.category;
    items.forEach(item => {
      if (item.usage === "unused") add("unused","medium",label(item),"This component has not been used in 30 days but may still retain access, sessions, files, or recurring work.","Disable its jobs, revoke access, archive required outputs, and remove retained sessions only after export verification.");
      if (item.overlap === "yes") add("overlap","medium",label(item),"Another agent or component performs substantially the same role, increasing cost and ambiguity about ownership.","Choose one owner for the role and retire or narrow the duplicate.");
      if (["readwrite","admin"].includes(item.access) && ["unknown","none"].includes(item.approval)) add("access","high",label(item),`${item.access === "admin" ? "Administrative" : "Read/write"} access is not paired with a clear approval boundary.`,"Reduce to read-only where possible and require explicit approval for external, financial, destructive, merge, publish, or credential actions.");
      if (["community","unknown"].includes(item.provenance)) add("provenance",item.provenance === "unknown" ? "high" : "medium",label(item),"The template, plugin, skill, or automation does not have verified first-party or internally reviewed provenance.","Freeze source URL/version/hash, inspect instructions and requested integrations, and record the reviewer before activation.");
      if (["durable","unknown"].includes(item.persistence)) add("persistence","high",label(item),"Credentials, browser sessions, files, or tokens may persist beyond the task or after the visible agent is deleted.","Document the storage location, revoke at the source, sign out sessions, remove durable files, and verify deletion independently.");
      if (["none","unknown"].includes(item.approval) && item.external === "yes") add("approval","high",label(item),"The component can affect an external system without a dependable human-approval boundary.","Add an ask-first gate showing the target, current value, proposed change, and expected impact.");
      if (["none","unknown"].includes(item.audit)) add("audit","high",label(item),"There is no reliable action log or attribution trail for this component.","Record actor, tool, target, inputs, result, model/route, timestamp, and receipt hash for consequential actions.");
      if (["none","unknown"].includes(item.recovery)) add("recovery","high",label(item),"Recovery or offboarding is missing or untested.","Create and test disable, revoke, export, rollback, and retained-state cleanup steps.");
    });
    const high = findings.filter(x=>x.severity === "high").length;
    const medium = findings.filter(x=>x.severity === "medium").length;
    const score = clamp(100 - high * 12 - medium * 6);
    const counts = items.reduce((acc,item)=>{ acc[item.category]=(acc[item.category]||0)+1; return acc; },{});
    const summary = items.map(item=>({
      name:label(item),
      detail:`${item.category} · ${item.usage || "usage unknown"} · ${item.access || "access unknown"} · ${item.provenance || "provenance unknown"}`
    }));
    return {items,findings,score,counts,summary,high,medium};
  }

  function evaluate(input) {
    const inventory = list(input.inventory).filter(item => item && (item.name || item.provider));
    const declaredInventorySpend = inventory.reduce((sum, item) => sum + number(item.cost), 0);
    const tools = inventory.length || number(input.tools);
    const activeTools = inventory.length ? inventory.filter(item => item.usage !== "unused").length : Math.min(tools, number(input.activeTools));
    const spend = inventory.length ? declaredInventorySpend : number(input.spend);
    const apiSpend = number(input.apiSpend);
    const repeatHours = number(input.repeatHours);
    const runs = number(input.runsPerMonth, 40);
    const budgetCap = number(input.budgetCap, spend + apiSpend);
    const quality = number(input.quality, 3);
    const costSensitivity = number(input.costSensitivity, 3);
    const speedPriority = number(input.speedPriority, 3);
    const privacyPriority = number(input.privacyPriority, 3);
    const failureConsequence = number(input.failureTolerance, 3);
    const overlap = input.overlap === "yes";
    const primary = input.primary === "yes";
    const renewals = input.renewals === "yes";
    const privacyReview = input.privacyReview === "yes";
    const exports = input.exports === "yes";
    const humanReview = input.humanReview === "yes";
    const sensitive = list(input.sensitive).filter(x => x !== "none");
    const taskTypes = list(input.taskTypes);
    const capabilities = list(input.capabilities);
    const localRequired = capabilities.includes("local") || privacyPriority >= 5;
    const frontier = input.reasoningDepth === "frontier" || quality >= 5 || failureConsequence >= 5;
    const heavyContext = ["large", "maximum"].includes(input.contextSize);
    const highVolume = runs >= 250;
    const sporadic = runs <= 20;
    const unused = Math.max(0, tools - activeTools);
    const unusedRatio = tools ? unused / tools : 0;
    const tierMismatch = !frontier && !heavyContext && quality <= 3 ? 0.08 + costSensitivity * 0.025 : 0;
    const budgetPressure = budgetCap > 0 && spend + apiSpend > budgetCap ? 0.08 : 0;
    const estimatedWasteRatio = Math.min(0.65, unusedRatio * 0.7 + (overlap ? 0.18 : 0) + (!renewals ? 0.05 : 0) + tierMismatch + budgetPressure);
    const exactInventoryWaste = inventory.reduce((sum, item) => {
      const cost = number(item.cost);
      if (item.usage === "unused") return sum + cost;
      if (["rare","monthly"].includes(item.usage) && item.access === "subscription") return sum + cost * 0.5;
      return sum;
    }, 0);
    const monthlySavings = Math.round(inventory.length ? Math.min(spend, Math.max(exactInventoryWaste, spend * Math.min(estimatedWasteRatio, 0.35))) : spend * estimatedWasteRatio);
    const focus = clamp(100 - tools * 5 - unused * 12 - (overlap ? 14 : 0) + (primary ? 14 : 0));
    const cost = clamp(100 - estimatedWasteRatio * 100 - (spend + apiSpend > budgetCap && budgetCap > 0 ? 14 : 0) + (renewals ? 10 : 0));
    const privacy = clamp(82 - sensitive.length * 7 + (privacyReview ? 16 : -18) + (exports ? 8 : -8) + (localRequired ? 6 : 0));
    const leverage = clamp(40 + Math.min(repeatHours, 12) * 4 + (input.automation === "yes" ? 15 : -5));
    const fit = clamp(65 + (frontier ? quality * 3 : 5) + (heavyContext ? 5 : 0) - (tools > 8 ? 10 : 0) - (!humanReview && failureConsequence >= 4 ? 20 : 0));
    const agentFootprint = analyzeAgentFootprint(input);
    const agentControl = agentFootprint.items.length ? agentFootprint.score : 100;
    const score = clamp((focus + cost + privacy + leverage + fit + agentControl) / 6);
    let band = "Needs attention";
    if (score >= 80) band = "Sovereign and focused";
    else if (score >= 65) band = "Healthy with clear upgrades";
    else if (score >= 50) band = "Useful but fragmented";

    const decisions = [];
    inventory.forEach((item) => {
      const label = [item.provider, item.name].filter(Boolean).join(" ");
      if (item.usage === "unused" && number(item.cost) > 0) decisions.push({ type:"cancel", title:label, reason:`No use in 30 days; cancel or pause the ${item.plan || "current"} plan before its next renewal.`, confidence:"high", assumption:"the reported usage is complete" });
      else if (["rare","monthly"].includes(item.usage) && item.access === "subscription" && number(item.cost) > 0) decisions.push({ type:"api", title:label, reason:"Usage is intermittent; compare pay-as-you-go cost with the recurring plan.", confidence:"medium", assumption:"this provider offers equivalent metered access" });
      else if (item.access === "local") decisions.push({ type:"keep", title:label, reason:"Local access supports privacy and resilience without another recurring model fee.", confidence:"medium", assumption:"quality and hardware performance remain adequate" });
      else if (item.access === "oauth") decisions.push({ type:"keep", title:label, reason:"Bundled OAuth access can be economical, but verify permissions, account ownership, and portability.", confidence:"medium", assumption:"the access is included in an existing plan" });
    });
    if (unused > 0) decisions.push({ type:"cancel", title:`${unused} inactive tool${unused === 1 ? "" : "s"}`, reason:"No use in the last 30 days means these subscriptions need explicit proof before renewal.", confidence:"high", assumption:"last-30-day use predicts near-term value" });
    if (overlap) decisions.push({ type:"consolidate", title:"Overlapping general assistants", reason:"Choose one primary assistant and retain specialists only for a named workflow they win.", confidence:"high", assumption:"the overlapping tools perform substantially similar jobs" });
    if (localRequired) decisions.push({ type:"local", title:"Private or sensitive workflows", reason:"Route the most sensitive work to a capable local model or a provider with verified no-retention controls.", confidence:"medium", assumption:"local hardware can meet the minimum quality requirement" });
    if (sporadic && (frontier || heavyContext)) decisions.push({ type:"api", title:"Occasional premium work", reason:"Metered API use may cost less than another premium subscription for infrequent demanding tasks.", confidence:"medium", assumption:"the workflow can run through an API-compatible interface" });
    if (!frontier && !heavyContext && costSensitivity >= 3) decisions.push({ type:"downgrade", title:"Routine daily work", reason:"Your requirements do not justify premium reasoning or maximum-context pricing on every task.", confidence:"medium", assumption:"a lower tier passes a representative quality test" });
    if (frontier || heavyContext) decisions.push({ type:"keep", title:"One premium capability", reason:"Retain premium access for the workflows requiring maximum context, judgment, or failure resistance.", confidence:"medium", assumption:"those demanding workflows occur often enough to justify access" });
    if (highVolume) decisions.push({ type:"route", title:"High-volume repetitive work", reason:"Use a cheaper fast model with structured outputs; escalate only uncertain cases.", confidence:"high", assumption:"the workload can be evaluated against labeled examples" });
    if (!decisions.length) decisions.push({ type:"keep", title:"Current minimal stack", reason:"Your stack is already compact; measure outcomes for 30 days before adding another plan.", confidence:"medium", assumption:"reported usage and costs are representative" });

    const actions = [];
    if (unused > 0) actions.push(`Pause or cancel ${unused} tool${unused === 1 ? "" : "s"} not used this month.`);
    if (overlap) actions.push("Run the same three real tasks through overlapping tools and keep the cheapest reliable winner.");
    if (!renewals) actions.push("Create a renewal register with price, owner, next charge, and last-use date.");
    if (!privacyReview || sensitive.length) actions.push("Review retention, training, export, and deletion terms before sending sensitive information.");
    if (!humanReview && failureConsequence >= 4) actions.push("Require human review for costly, external, financial, destructive, or safety-relevant outputs.");
    if (spend + apiSpend > budgetCap && budgetCap > 0) actions.push(`Bring monthly AI cost below the stated $${budgetCap} ceiling.`);
    if (!actions.length) actions.push("Keep the stack stable for 30 days and measure outcomes before adding another tool.");

    const workloadSummary = [
      taskTypes.length ? taskTypes.map(x => taskLabels[x] || x).join(", ") : "General knowledge work",
      `${sizeLabels[input.contextSize] || "medium context"}; ${input.outputSize || "medium"} output`,
      `${input.reasoningDepth || "skilled"} reasoning; ${runs} runs/month`,
      `quality ${quality}/5 · cost sensitivity ${costSensitivity}/5 · speed ${speedPriority}/5 · privacy ${privacyPriority}/5`,
      budgetCap ? `$${budgetCap}/month hard ceiling` : "No hard monthly ceiling"
    ];
    const inventorySummary = inventory.map((item) => ({
      name:[item.provider, item.name].filter(Boolean).join(" ") || "Unnamed item",
      detail:`${item.access || "subscription"} · ${item.plan || "plan not stated"} · $${number(item.cost).toFixed(2)}/month · ${item.usage || "usage not stated"}${item.purpose ? ` · ${item.purpose}` : ""}`
    }));
    const modelRecommendations = recommendModels(input);
    const best = modelRecommendations[0];
    const economy = modelRecommendations.find(x=>/Lower-cost/.test(x.role));
    const privateOption = modelRecommendations.find(x=>x.tier==="local");
    const keptInventory = inventory.find(x=>x.usage==="daily" || x.usage==="weekly");
    const cancelled = decisions.filter(x=>x.type==="cancel");
    const prescription = {
      keep:keptInventory ? `${keptInventory.provider} ${keptInventory.name}` : "No existing plan has earned a keep decision yet",
      add:best ? `${best.provider} ${best.name} only if your current stack cannot cover its assigned work` : "No addition recommended",
      cancel:cancelled.length ? cancelled.map(x=>x.title).join(", ") : "No immediate cancellation identified",
      route:[economy ? `${economy.name} for routine or high-volume work` : null,best ? `${best.name} for best-fit work` : null,privateOption ? `${privateOption.name} for sensitive work` : null].filter(Boolean).join("; ")
    };
    const stack = [
      { label:"Primary assistant", advice:primary ? "Keep it for everyday work and define what it owns." : "Pick one assistant for daily thinking, writing, and synthesis." },
      { label:"Premium lane", advice:frontier || heavyContext ? "Reserve one premium model for demanding work; do not use it by default." : "Add premium access only when a real workflow fails the standard tier." },
      { label:"Economy lane", advice:highVolume ? "Use a low-cost fast model for repeated bounded work." : "Use a standard model for routine work and evaluate before upgrading." },
      { label:"Control layer", advice:"Track permissions, data boundaries, renewals, exports, evidence, and fallback ownership in one register." }
    ];
    const workflows = roleWorkflows[input.role] || roleWorkflows.founder;
    const warnings = [];
    if (sensitive.includes("health")) warnings.push("Health information may require stronger privacy and retention controls.");
    if (sensitive.includes("financial")) warnings.push("Financial data should not enter consumer AI tools without verified terms and authorization.");
    if (sensitive.includes("customer")) warnings.push("Customer data needs a named owner, approved purpose, and deletion path.");
    if (sensitive.includes("credentials")) warnings.push("Never paste passwords, API keys, recovery codes, or private keys into an AI prompt.");
    if (!humanReview && failureConsequence >= 4) warnings.push("High-consequence work lacks a stated human-review gate.");
    if (!warnings.length) warnings.push("Even low-risk work should have a clear export and account-revocation path.");
    return {
      score, band, dimensions:{ focus, cost, privacy, leverage, fit, agentControl },
      monthlySavings, annualSavings:monthlySavings * 12,
      actions:actions.slice(0, 6), stack, workflows, warnings,
      decisions:decisions.slice(0, 10), workloadSummary, inventorySummary,
      modelRecommendations, prescription, catalogAsOf:catalog.asOf,
      agentFootprintSummary:agentFootprint.summary,
      agentRiskFindings:agentFootprint.findings,
      agentFootprintScore:agentFootprint.score,
      agentFootprintCounts:agentFootprint.counts,
      summary:`Your stack scores ${score}/100. ${monthlySavings > 0 ? `About $${monthlySavings}/month appears avoidable. ` : ""}The goal is a blended stack: economical defaults with premium, local, or API capacity only where the workload requires it.`
    };
  }
  return { evaluate };
});
