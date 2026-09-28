const assert = require("node:assert/strict");
const { evaluate } = require("./engine.js");
const catalog = require("./catalog.js");
assert.ok(catalog.plans.length >= 20);
assert.ok(catalog.plans.every(x => Number.isFinite(x.cost) && x.provider && x.name && x.access));

const healthy = evaluate({role:"founder",tools:2,activeTools:2,spend:40,apiSpend:0,repeatHours:6,overlap:"no",primary:"yes",renewals:"yes",privacyReview:"yes",exports:"yes",automation:"yes",humanReview:"yes",quality:3,costSensitivity:2,privacyPriority:2,failureTolerance:2,contextSize:"medium",reasoningDepth:"skilled",runsPerMonth:40,budgetCap:100,sensitive:[],taskTypes:["writing"],capabilities:[]});
assert.ok(healthy.score >= 75);
assert.ok(healthy.monthlySavings <= 5);
assert.ok(healthy.modelRecommendations.length >= 3);
assert.ok(healthy.modelRecommendations.every(x => /^https:\/\//.test(x.link) && /^https:\/\//.test(x.source)));
assert.equal(healthy.catalogAsOf, "2026-09-28");

const fragmented = evaluate({role:"team",tools:10,activeTools:3,spend:300,apiSpend:25,repeatHours:10,overlap:"yes",primary:"no",renewals:"no",privacyReview:"no",exports:"no",automation:"no",humanReview:"no",quality:3,costSensitivity:5,privacyPriority:5,failureTolerance:5,contextSize:"large",reasoningDepth:"frontier",runsPerMonth:12,budgetCap:150,sensitive:["customer","financial","credentials"],taskTypes:["research","automation"],capabilities:["local","tools"]});
assert.ok(fragmented.score < 55);
assert.ok(fragmented.monthlySavings >= 100);
assert.ok(fragmented.warnings.some(x => /credentials|passwords/i.test(x)));
assert.ok(fragmented.decisions.some(x => x.type === "cancel"));
assert.ok(fragmented.decisions.some(x => x.type === "local"));
assert.ok(fragmented.decisions.some(x => x.type === "api"));
assert.ok(fragmented.workloadSummary.some(x => /frontier/i.test(x)));
assert.ok(fragmented.modelRecommendations.some(x => x.tier === "local"));

const volume = evaluate({role:"operator",tools:3,activeTools:3,spend:90,apiSpend:20,repeatHours:12,overlap:"no",primary:"yes",renewals:"yes",privacyReview:"yes",exports:"yes",automation:"yes",humanReview:"yes",quality:2,costSensitivity:5,privacyPriority:2,failureTolerance:2,contextSize:"small",outputSize:"short",reasoningDepth:"routine",runsPerMonth:1000,budgetCap:120,sensitive:[],taskTypes:["automation"],capabilities:[]});
assert.ok(volume.decisions.some(x => x.type === "route"));
assert.ok(volume.decisions.some(x => x.type === "downgrade"));
assert.ok(volume.modelRecommendations.some(x => /Luna|Flash-Lite/i.test(x.name)));

const inventoried = evaluate({role:"consultant",tools:99,activeTools:99,spend:999,apiSpend:0,repeatHours:5,overlap:"yes",primary:"yes",renewals:"yes",privacyReview:"yes",exports:"yes",automation:"yes",humanReview:"yes",quality:4,costSensitivity:4,privacyPriority:3,failureTolerance:3,contextSize:"medium",outputSize:"medium",reasoningDepth:"skilled",runsPerMonth:30,budgetCap:100,sensitive:[],taskTypes:["research"],capabilities:[],inventory:[{provider:"Anthropic",name:"Claude",access:"subscription",plan:"Pro",cost:20,usage:"unused",purpose:"Writing"},{provider:"OpenAI",name:"GPT",access:"api",plan:"PAYG",cost:8,usage:"weekly",purpose:"Research"}]});
assert.equal(inventoried.inventorySummary.length, 2);
assert.equal(inventoried.monthlySavings, 20);
assert.ok(inventoried.decisions.some(x => x.type === "cancel" && /Claude/.test(x.title)));

const zero = evaluate({role:"creator",tools:0,activeTools:0,spend:0,apiSpend:0,repeatHours:0,overlap:"no",primary:"no",renewals:"no",privacyReview:"yes",exports:"yes",automation:"no",humanReview:"yes",sensitive:[]});
assert.equal(Number.isFinite(zero.score), true);
assert.equal(zero.annualSavings, 0);
assert.deepEqual(zero.inventorySummary, []);
console.log("PASS: AI Stack Doctor scoring engine");
