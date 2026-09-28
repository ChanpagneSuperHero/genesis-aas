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

  function evaluate(input) {
    const tools = number(input.tools);
    const activeTools = Math.min(tools, number(input.activeTools));
    const spend = number(input.spend);
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
    const monthlySavings = Math.round(spend * estimatedWasteRatio);
    const focus = clamp(100 - tools * 5 - unused * 12 - (overlap ? 14 : 0) + (primary ? 14 : 0));
    const cost = clamp(100 - estimatedWasteRatio * 100 - (spend + apiSpend > budgetCap && budgetCap > 0 ? 14 : 0) + (renewals ? 10 : 0));
    const privacy = clamp(82 - sensitive.length * 7 + (privacyReview ? 16 : -18) + (exports ? 8 : -8) + (localRequired ? 6 : 0));
    const leverage = clamp(40 + Math.min(repeatHours, 12) * 4 + (input.automation === "yes" ? 15 : -5));
    const fit = clamp(65 + (frontier ? quality * 3 : 5) + (heavyContext ? 5 : 0) - (tools > 8 ? 10 : 0) - (!humanReview && failureConsequence >= 4 ? 20 : 0));
    const score = clamp((focus + cost + privacy + leverage + fit) / 5);
    let band = "Needs attention";
    if (score >= 80) band = "Sovereign and focused";
    else if (score >= 65) band = "Healthy with clear upgrades";
    else if (score >= 50) band = "Useful but fragmented";

    const decisions = [];
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
      score, band, dimensions:{ focus, cost, privacy, leverage, fit },
      monthlySavings, annualSavings:monthlySavings * 12,
      actions:actions.slice(0, 6), stack, workflows, warnings,
      decisions:decisions.slice(0, 6), workloadSummary,
      summary:`Your stack scores ${score}/100. ${monthlySavings > 0 ? `About $${monthlySavings}/month appears avoidable. ` : ""}The goal is a blended stack: economical defaults with premium, local, or API capacity only where the workload requires it.`
    };
  }
  return { evaluate };
});
