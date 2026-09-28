const assert = require("node:assert/strict");
const { evaluate } = require("./engine.js");

const healthy = evaluate({role:"founder",tools:2,activeTools:2,spend:40,repeatHours:6,overlap:"no",primary:"yes",renewals:"yes",privacyReview:"yes",exports:"yes",automation:"yes",sensitive:[]});
assert.ok(healthy.score >= 75);
assert.equal(healthy.monthlySavings, 0);

const fragmented = evaluate({role:"team",tools:10,activeTools:3,spend:300,repeatHours:10,overlap:"yes",primary:"no",renewals:"no",privacyReview:"no",exports:"no",automation:"no",sensitive:["customer","financial","credentials"]});
assert.ok(fragmented.score < 55);
assert.ok(fragmented.monthlySavings >= 100);
assert.ok(fragmented.warnings.some(x => /credentials|passwords/i.test(x)));

const zero = evaluate({role:"creator",tools:0,activeTools:0,spend:0,repeatHours:0,overlap:"no",primary:"no",renewals:"no",privacyReview:"yes",exports:"yes",automation:"no",sensitive:[]});
assert.equal(Number.isFinite(zero.score), true);
assert.equal(zero.annualSavings, 0);
console.log("PASS: AI Stack Doctor scoring engine");
