(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.StackDoctorEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

  const roleWorkflows = {
    founder: ["Weekly decision brief from email, calendar, and project notes", "Customer-interview synthesis with evidence links", "Draft-and-review pipeline for proposals and follow-ups"],
    operator: ["Turn recurring requests into a triaged operating queue", "Convert meetings into owners, deadlines, and follow-up drafts", "Generate SOP drafts from completed work, then human-review them"],
    creator: ["Repurpose one source into platform-specific drafts", "Research and claim-check content before publishing", "Maintain a reusable idea, hook, and proof library"],
    consultant: ["Convert discovery notes into scoped proposals", "Create client-ready summaries with assumptions and exclusions", "Produce repeatable audit reports from a standard intake"],
    developer: ["Turn issue descriptions into testable implementation plans", "Automate regression-test and release-note drafting", "Route coding tasks by complexity instead of one-model-for-everything"],
    team: ["Create a governed internal AI request desk", "Detect duplicate subscriptions and inactive seats quarterly", "Require human approval for external, financial, or destructive actions"]
  };

  function evaluate(input) {
    const tools = Number(input.tools || 0);
    const activeTools = Math.min(tools, Number(input.activeTools || 0));
    const spend = Number(input.spend || 0);
    const repeatHours = Number(input.repeatHours || 0);
    const overlap = input.overlap === "yes";
    const primary = input.primary === "yes";
    const renewals = input.renewals === "yes";
    const privacyReview = input.privacyReview === "yes";
    const exports = input.exports === "yes";
    const sensitive = Array.isArray(input.sensitive) ? input.sensitive : [];

    const unused = Math.max(0, tools - activeTools);
    const unusedRatio = tools ? unused / tools : 0;
    const overlapRatio = overlap ? 0.18 : 0;
    const estimatedWasteRatio = Math.min(0.55, unusedRatio * 0.7 + overlapRatio + (!renewals ? 0.05 : 0));
    const monthlySavings = Math.round(spend * estimatedWasteRatio);

    const focus = clamp(100 - tools * 5 - unused * 12 - (overlap ? 14 : 0) + (primary ? 14 : 0));
    const cost = clamp(100 - estimatedWasteRatio * 100 - (spend > 150 ? 12 : 0) + (renewals ? 10 : 0));
    const privacy = clamp(88 - sensitive.length * 8 + (privacyReview ? 16 : -18) + (exports ? 8 : -8));
    const leverage = clamp(42 + Math.min(repeatHours, 12) * 4 + (input.automation === "yes" ? 15 : -5));
    const score = clamp((focus + cost + privacy + leverage) / 4);

    let band = "Needs attention";
    if (score >= 80) band = "Sovereign and focused";
    else if (score >= 65) band = "Healthy with clear upgrades";
    else if (score >= 50) band = "Useful but fragmented";

    const actions = [];
    if (unused > 0) actions.push(`Pause or cancel ${unused} tool${unused === 1 ? "" : "s"} you have not used this month.`);
    if (overlap) actions.push("Choose one primary assistant for everyday work; keep specialists only for a documented weekly job.");
    if (!renewals) actions.push("Create a renewal register with price, owner, next charge, and last-use date.");
    if (!privacyReview || sensitive.length) actions.push("Review retention, training, export, and deletion terms before sending sensitive information.");
    if (!exports) actions.push("Export critical prompts, project context, and outputs so one vendor cannot trap your operating memory.");
    if (repeatHours >= 3 && input.automation !== "yes") actions.push("Automate one repetitive workflow this week, with a human approval gate before external action.");
    if (!actions.length) actions.push("Keep the stack stable for 30 days and measure outcomes before adding another tool.");

    const stack = [
      { label: "Primary assistant", advice: primary ? "Keep your current primary and define what it owns." : "Pick one assistant for daily thinking, writing, and synthesis." },
      { label: "Specialist", advice: "Keep at most one specialist for a job your primary cannot do reliably." },
      { label: "Control layer", advice: "Track permissions, sensitive data, renewals, exports, and evidence in one register." }
    ];

    const workflows = roleWorkflows[input.role] || roleWorkflows.founder;
    const warnings = [];
    if (sensitive.includes("health")) warnings.push("Health information may require stronger privacy and retention controls.");
    if (sensitive.includes("financial")) warnings.push("Financial data should not enter consumer AI tools without verified terms and authorization.");
    if (sensitive.includes("customer")) warnings.push("Customer data needs a named owner, approved purpose, and deletion path.");
    if (sensitive.includes("credentials")) warnings.push("Never paste passwords, API keys, recovery codes, or private keys into an AI prompt.");
    if (!warnings.length) warnings.push("Even low-risk work should have a clear export and account-revocation path.");

    return {
      score,
      band,
      dimensions: { focus, cost, privacy, leverage },
      monthlySavings,
      annualSavings: monthlySavings * 12,
      actions: actions.slice(0, 5),
      stack,
      workflows,
      warnings,
      summary: `Your stack scores ${score}/100. The clearest opportunity is to ${monthlySavings > 0 ? `recover about $${monthlySavings}/month and ` : ""}reduce tool switching while strengthening data control.`
    };
  }

  return { evaluate };
});
