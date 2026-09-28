import { mkdir, readdir, rm, writeFile } from "node:fs/promises";

const tabs = await fetch("http://127.0.0.1:9223/json/list").then(r => r.json());
const tab = tabs.find(x => x.type === "page");
if (!tab) throw new Error("No Chrome page target");
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = event => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
};
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const callId = ++id; pending.set(callId, { resolve, reject });
  ws.send(JSON.stringify({ id: callId, method, params }));
});
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
const downloadPath = "/tmp/stack-doctor-download-test";
await rm(downloadPath, { recursive: true, force: true });
await mkdir(downloadPath, { recursive: true });
await send("Page.setDownloadBehavior", { behavior: "allow", downloadPath });
const targetUrl = process.env.STACK_DOCTOR_URL || "http://127.0.0.1:4173/stack-doctor/";
await send("Page.navigate", { url: targetUrl });
await new Promise(r => setTimeout(r, 1000));
const landingShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile("/tmp/stack-doctor-mobile-landing.png", Buffer.from(landingShot.data, "base64"));
const expression = `(() => {
  const q=s=>document.querySelector(s);
  const set=(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
  q('#start-button').click();
  q('[name=role]').value='team'; q('[name=goal]').value='Reduce costs'; q('[name=pain]').value='Too many overlapping tools'; q('#next-button').click();
  q('[name=tools]').value='10'; q('[name=activeTools]').value='3'; q('[name=spend]').value='300'; q('[name=repeatHours]').value='10'; q('[name=overlap][value=yes]').checked=true; q('[name=primary][value=no]').checked=true; q('#next-button').click();
  q('#back-button').click(); q('#add-inventory').click();
  set(q('.inventory-row [data-key=provider]'),'Anthropic'); set(q('.inventory-row [data-key=name]'),'Claude'); set(q('.inventory-row [data-key=access]'),'subscription'); set(q('.inventory-row [data-key=plan]'),'Pro'); set(q('.inventory-row [data-key=cost]'),'20'); set(q('.inventory-row [data-key=usage]'),'unused'); set(q('.inventory-row [data-key=purpose]'),'Writing'); q('#inventory-export').click(); q('#next-button').click();
  q('[name=taskTypes][value=research]').checked=true; q('[name=taskTypes][value=automation]').checked=true; q('[name=workflowName]').value='Weekly market intelligence'; q('[name=quality]').value='5'; q('[name=costSensitivity]').value='5'; q('[name=privacyPriority]').value='5'; q('[name=failureTolerance]').value='5'; q('[name=contextSize]').value='large'; q('[name=outputSize]').value='large'; q('[name=reasoningDepth]').value='frontier'; q('[name=runsPerMonth]').value='12'; q('[name=budgetCap]').value='150'; q('[name=capabilities][value=local]').checked=true; q('#next-button').click();
  q('[name=sensitive][value=customer]').checked=true; q('[name=sensitive][value=credentials]').checked=true; q('[name=privacyReview][value=no]').checked=true; q('[name=exports][value=no]').checked=true; q('#next-button').click();
  q('[name=renewals][value=no]').checked=true; q('[name=automation][value=no]').checked=true; q('[name=humanReview][value=no]').checked=true; q('.consent input').checked=true; q('#doctor-form').requestSubmit();
  q('#download-button').click();
  const externalRequests = performance.getEntriesByType('resource').map(x=>x.name).filter(x=>!x.startsWith(location.origin));
  const overflowing = [...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1}).map(el=>({tag:el.tagName,id:el.id,class:el.className,right:Math.round(el.getBoundingClientRect().right)})).slice(0,10);
  return { resultsVisible: !q('#results').classList.contains('hidden'), score:q('#score').textContent, savings:q('#savings').textContent, decisions:q('#decision-grid').children.length, inventory:q('#inventory-summary').children.length, profiles:q('#workload-summary').children.length, actions:q('#actions').children.length, warnings:q('#warnings').children.length, errors:q('#form-error').textContent, externalRequests, viewport:[innerWidth,innerHeight], scrollWidth:document.documentElement.scrollWidth, overflowing };
})()`;
const result = await send("Runtime.evaluate", { expression, returnByValue: true });
const value = result.result.value;
const resultsShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile("/tmp/stack-doctor-mobile-results.png", Buffer.from(resultsShot.data, "base64"));
await new Promise(r => setTimeout(r, 500));
const downloads = await readdir(downloadPath);
if (!value.resultsVisible || value.decisions < 3 || value.inventory !== 1 || value.profiles < 3 || value.actions < 1 || value.warnings < 1 || value.errors || value.externalRequests.length || value.scrollWidth > value.viewport[0] || !downloads.includes("ai-stack-doctor-report.html") || !downloads.includes("ai-stack-inventory.json")) throw new Error(`Browser flow failed: ${JSON.stringify({value,downloads})}`);
console.log(`PASS: browser assessment flow ${JSON.stringify(value)}`);
console.log(`PASS: report download ${downloads.join(",")}`);
ws.close();
