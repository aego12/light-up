/**
 * Browser checks for the local prototype.
 * 1. npm run dev
 * 2. Start Chrome --headless=new --remote-debugging-port=9231 --user-data-dir=<temporary-profile>
 * 3. npm test
 * Node 22+ supplies the WebSocket client; no browser-testing package is required.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const debug = process.env.CHROME_DEBUG_URL || 'http://localhost:9231';
const base = process.env.APP_URL || 'http://localhost:5173/';
const target = await (await fetch(debug + '/json/new?' + encodeURIComponent(base), { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
let seq = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', event => {
 const m = JSON.parse(event.data);
 if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ': ' + (m.params.exceptionDetails.exception?.description || ''));
 if (m.id) {
  const item = pending.get(m.id);
  if (!item) return;
  clearTimeout(item.timer); pending.delete(m.id);
  if (m.error) item.reject(new Error(JSON.stringify(m.error))); else item.resolve(m.result);
 }
});
function send(method, params = {}) {
 return new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject, timer: setTimeout(() => reject(new Error('CDP timeout: ' + method)), 15000) });
  ws.send(JSON.stringify({ id, method, params }));
 });
}
async function ev(expression) {
 const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
 if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
 return r.result.value;
}
const delay = ms => new Promise(r => setTimeout(r, ms));
async function ready() { for (let i = 0; i < 50; i++) { if (await ev("document.readyState==='complete' && !!document.querySelector('[data-screen]')")) break; await delay(100); } await ev('document.fonts.ready.then(()=>true)'); await delay(60); }
async function click(selector) {
 const hit = await ev('(()=>{const n=document.querySelector(' + JSON.stringify(selector) + ');if(!n)return false;n.click();return true})()');
 assert.ok(hit, 'Missing clickable ' + selector); await delay(50);
}
async function route(name) {
 await ev('(()=>{const s=document.querySelector("#screen-picker");s.value=' + JSON.stringify(name) + ';s.dispatchEvent(new Event("change",{bubbles:true}))})()'); await delay(50);
}
async function fill(name, value) { await ev('(()=>{const n=document.querySelector("[name=' + name + ']");n.value=' + JSON.stringify(value) + ';n.dispatchEvent(new Event("input",{bubbles:true}))})()'); }
const getScreen = () => ev('document.querySelector("[data-screen]").dataset.screen');
const savedState = () => ev('JSON.parse(localStorage.getItem("light-up.warm-living.v1"))');
async function screenshot(file, width = 1440, height = 1000, mobile = false) {
 await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
 await delay(150);
 if(await ev('document.querySelector("#toast").classList.contains("visible")')) await delay(2500);
 const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
 await writeFile(resolve('artifacts', file), Buffer.from(result.data, 'base64'));
}
try {
 await mkdir('artifacts', { recursive: true });
 await send('Runtime.enable'); await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
 await send('Page.navigate', { url: base }); await ready();
 
 await ev('sessionStorage.removeItem("light-up.brand-intro.v1")');
 await send('Page.reload'); await ready();
 assert.ok(await ev('!!document.querySelector("#brand-intro")'));
 assert.equal(await ev('document.querySelector(".screen-view").inert'),true,'Brand intro blocks only the phone view');
 await delay(1600);
 await screenshot('light-up-logo-intro.png');
 await delay(1600);
 assert.equal(await ev('document.querySelector("#brand-intro")'),null);
 assert.equal(await ev('document.querySelector(".screen-view").inert'),false);
 assert.equal(await getScreen(),'welcome');
 await send('Page.reload');await ready();
 assert.equal(await ev('document.querySelector("#brand-intro")'),null,'Intro plays once per session');
 await ev('sessionStorage.removeItem("light-up.brand-intro.v1")');
 await send('Page.reload');await ready();
 await click('.intro-skip');
 assert.equal(await ev('document.querySelector("#brand-intro")'),null);
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await ev('sessionStorage.removeItem("light-up.brand-intro.v1")');
 await send('Page.reload');await ready();await delay(850);
 assert.equal(await ev('document.querySelector("#brand-intro")'),null,'Reduced-motion intro completes without animation');
 await send('Emulation.setEmulatedMedia',{features:[]});
 await send('Page.navigate', { url: base + 'home' }); await ready();
 assert.equal(await getScreen(), 'home', 'Direct URL restored');
 await send('Page.reload'); await ready();
 assert.equal(await getScreen(), 'home', 'Refresh restored home');
 await click('#reset-demo');
 await screenshot('light-up-desktop.png');
 const keys = await ev('[...document.querySelector("#screen-picker").options].map(n=>n.value)');
 assert.equal(keys.length, 31);
 const boundsIssues = [], brokenImages = [], assetGeometryIssues = [];
 for (const key of keys) {
  await route(key);
  assert.equal(await getScreen(), key);
  await ev('Promise.all([...document.querySelectorAll("#app-screen img")].map(img=>img.decode().catch(()=>{})))');
  const findings = await ev(`(()=>{
   const f=document.querySelector("#app-screen").getBoundingClientRect();
   const nodes=[...document.querySelectorAll("#app-screen button,#app-screen input,#app-screen .page-heading,#app-screen .positioned")];
   const bounds=nodes.filter(n=>{const b=n.getBoundingClientRect();return b.width>0&&(b.left<f.left-1||b.right>f.right+1||b.top<f.top-1||b.bottom>f.bottom+1)}).map(n=>({tag:n.tagName,text:n.textContent.slice(0,60)}));
   const images=[...document.querySelectorAll("#app-screen img")].filter(n=>!n.complete||!n.naturalWidth).map(n=>n.src);
   const geometry=[...document.querySelectorAll('#app-screen img')].filter(n=>n.complete&&n.naturalWidth&&(n.width!==n.naturalWidth||n.height!==n.naturalHeight)).map(n=>({src:n.src,rendered:[n.width,n.height],native:[n.naturalWidth,n.naturalHeight]}));return {bounds,images,geometry};
  })()`);
  if (findings.bounds.length) boundsIssues.push({ key, findings: findings.bounds });
  if (findings.images.length) brokenImages.push({ key, images: findings.images });
  if (findings.geometry.length) assetGeometryIssues.push({key,geometry:findings.geometry});
 }
 await click('#reset-demo');
 await route('addDevice');
 await click('#app-screen [data-key="lightOn"]');
 assert.equal(await getScreen(),'addDevice','Discovery switch stays on the search screen');
 assert.equal((await savedState()).lightOn,false);
 assert.equal(await ev('document.querySelector("#app-screen [role=switch]").getAttribute("aria-checked")'),'false');
 assert.equal(await ev('document.querySelector("#app-screen .btn[data-route=wifi]").disabled'),true);
 await send('Page.reload');await ready();
 assert.equal(await getScreen(),'addDevice');
 assert.equal(await ev('document.querySelector("#app-screen [role=switch]").getAttribute("aria-checked")'),'false');
 await click('#app-screen [data-key="lightOn"]');
 assert.equal((await savedState()).lightOn,true);
 assert.equal(await ev('document.querySelector("#app-screen .btn[data-route=wifi]").disabled'),false);
 await click('#reset-demo');
 await click('#app-screen [data-route="onboardingLight"]');
 await click('#app-screen [data-route="onboardingClimate"]');
 await click('#app-screen [data-route="login"]');
 await click('#app-screen [type="submit"]');
 assert.equal(await getScreen(), 'login');
 assert.ok(await ev('document.querySelector("#form-error").textContent.length>0'));
 await click('#app-screen [data-route="signup"]');
 await fill('name', '희진'); await fill('email', 'demo@example.com'); await fill('password', 'demo12345');
 await ev('document.querySelector("[name=agree]").checked=true');
 await click('#app-screen [type="submit"]'); assert.equal(await getScreen(), 'permissions');
 await click('#app-screen [data-route="emptyHome"]');
 await click('#app-screen [data-route="addDevice"]');
 await click('#app-screen [data-route="wifi"]');
 await fill('wifiPassword', 'warmhome123');
 await click('#app-screen [type="submit"]'); await delay(750);
 assert.equal(await getScreen(), 'connected');
 await click('#app-screen [type="submit"]'); assert.equal(await getScreen(), 'home');
 await screenshot('light-up-home.png');
 await click('#app-screen [data-route="light"]');
 for (const brightness of [0,31,100]) {
  await ev('(()=>{const n=document.querySelector("#brightness");n.value="'+brightness+'";n.dispatchEvent(new Event("input",{bubbles:true}))})()');
  await delay(150);
  assert.equal(await ev('Number(document.querySelector("#brightness-value").textContent)'),brightness);
  assert.equal(await ev('Number(getComputedStyle(document.querySelector(".lamp-art")).opacity)'),brightness/100);
  assert.equal(await ev('getComputedStyle(document.querySelector(".lamp-base")).opacity'),'1');
  assert.equal((await savedState()).brightness,brightness);
  await ev('Promise.all([...document.querySelectorAll(".lamp-slot img")].map(img=>img.decode()))');
  const clip=await ev('(()=>{const r=document.querySelector("#app-screen").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');
  const shot=await send('Page.captureScreenshot',{format:'png',clip});
  await writeFile('artifacts/light-up-brightness-'+brightness+'.png',Buffer.from(shot.data,'base64'));
 }

 await ev('(()=>{const n=document.querySelector("#brightness");n.value="37";n.dispatchEvent(new Event("input",{bubbles:true}))})()');
 assert.equal((await savedState()).brightness, 37);
 await click('#app-screen [data-action="kelvin"][data-value="4000"]');
 assert.equal((await savedState()).kelvin, 4000);
 for (const kelvin of [2700,4000,6500]) {
  await click('#app-screen [data-action="kelvin"][data-value="'+kelvin+'"]');
  await ev('document.querySelector(".lamp-art").decode()');
  assert.equal((await savedState()).kelvin,kelvin);
  assert.ok(await ev('document.querySelector(".lamp-art").src.endsWith("lamp-'+kelvin+'.svg")'));
  assert.equal(await ev('document.querySelectorAll("[data-action=kelvin][aria-pressed=true]").length'),1);
  const clip=await ev('(()=>{const r=document.querySelector("#app-screen").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');
  const shot=await send('Page.captureScreenshot',{format:'png',clip});
  await writeFile('artifacts/light-up-color-'+kelvin+'.png',Buffer.from(shot.data,'base64'));
 }
 await click('#app-screen [data-action="kelvin"][data-value="4000"]');
 await click('#app-screen [data-action="power"]'); assert.equal(await getScreen(), 'lightOff');
 await click('#app-screen [data-action="power"]'); assert.equal(await getScreen(), 'light');
 await route('climate');
 const old = (await savedState()).temperature;
 await click('#app-screen [data-delta="1"]'); assert.equal((await savedState()).temperature, old + 1);
 await click('#app-screen [data-delta="-1"]'); assert.equal((await savedState()).temperature, old);
 await route('routines');
 const before = (await savedState()).routines.length;
 await click('#app-screen [data-action="new-routine"]');
 await fill('routineName', '테스트 예약'); await click('#app-screen [data-action="select-time"]');
 assert.ok(await ev('!!document.querySelector("[role=dialog]")'));
 await click('[data-time-part="period"][data-time-value="AM"]');
 await click('[data-time-part="hour"][data-time-value="12"]');
 await click('[data-time-part="minute"][data-time-value="00"]');
 await click('[data-time-confirm]');
 assert.equal(await ev('document.querySelector("[name=routineTime]").value'),'00:00');
 await click('[data-action="select-time"]');
 await click('[data-time-part="period"][data-time-value="PM"]');
 await click('[data-time-confirm]');
 assert.equal(await ev('document.querySelector("[name=routineTime]").value'),'12:00');
 await click('[data-action="select-time"]');
 await click('[data-time-part="hour"][data-time-value="05"]');
 await click('[data-time-dismiss]');
 assert.equal(await ev('document.querySelector("[name=routineTime]").value'),'12:00');
 await click('[data-action="select-time"]');
 await click('[data-time-part="period"][data-time-value="AM"]');
 await click('[data-time-part="hour"][data-time-value="08"]');
 await click('[data-time-part="minute"][data-time-value="30"]');
 await screenshot('light-up-time-popup.png');
 await click('[data-time-confirm]');
 assert.equal(await ev('document.querySelector("[name=routineTime]").value'),'08:30');
 assert.equal(await ev('document.querySelector("[role=dialog]")'),null);

 await click('#app-screen [data-action="repeat"][data-value="주말"]');
 await click('#app-screen [type="submit"]');
 assert.equal(await getScreen(), 'saved');
 assert.equal((await savedState()).routines.length, before + 1);
 assert.equal((await savedState()).routines.at(-1).repeat, '주말');
 await click('#app-screen [data-route="routines"]');
 const id = (await savedState()).routines.at(-1).id;
 await click('#app-screen [data-action="edit-routine"][data-id="' + id + '"]');
 await fill('routineName', '수정한 예약');
 await click('#app-screen [type="submit"]');
 assert.equal((await savedState()).routines.length, before + 1);
 assert.equal((await savedState()).routines.at(-1).name, '수정한 예약');
 await route('notifications');
 const notification = (await savedState()).notifications.news;
 await click('#app-screen [data-key="news"]');
 assert.equal((await savedState()).notifications.news, !notification);
 await route('settings'); await click('#app-screen [data-route="terms"]'); await click('#app-screen [data-action="back"]');
 assert.equal(await getScreen(), 'settings');
 const stored = await savedState();
 assert.equal('password' in stored, false); assert.equal('wifiPassword' in stored, false);
 await send('Page.reload'); await ready();
 assert.equal((await savedState()).brightness, 37);
 await route('home');
 await screenshot('light-up-mobile.png', 390, 1000, true);
 const mobileOverflow = await ev('document.documentElement.scrollWidth > innerWidth');
 assert.equal(mobileOverflow, false, 'Mobile horizontal overflow');
 await route('signup');
 await screenshot('light-up-signup.png');
 await click('#reset-demo');
 await route('home');
 await screenshot('light-up-result.png');
 const summary = { screenCount: keys.length, boundsIssues, brokenImages, assetGeometryIssues, consoleErrors: errors, tests: ['all screens', 'form validation', 'signup and connection', 'light brightness/color/power', 'temperature', 'routine create/edit', 'notifications', 'contextual back', 'reload persistence', 'mobile width'], passed: !boundsIssues.length && !brokenImages.length && !assetGeometryIssues.length && !errors.length };
 await writeFile('artifacts/verification.json', JSON.stringify(summary, null, 2));
 console.log(JSON.stringify(summary, null, 2));
 assert.ok(summary.passed, 'See artifacts/verification.json');
} finally {
 ws.close();
 await fetch(debug + '/json/close/' + target.id).catch(() => {});
}
