import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4321';
const browserCandidates = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : process.platform === 'win32' ? [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
] : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const browser = browserCandidates.find(existsSync);
assert.ok(browser, 'Chrome or Edge was not found. Set CHROME_PATH to a Chromium browser.');

const topLevelLinks = ['Compare', 'Stock-Up', 'Coupons', 'More'];
const moreLinks = ['Usage', 'Guides', 'Shopping Examples', 'Methodology', 'About', 'Contact'];
const exactWidths = [320, 360, 375, 390, 412, 430, 679, 680, 768, 1024, 1440];
const routes = ['/', '/404', '/about/', '/contact/', '/coupon-comparator/', '/guides/', '/guides/bigger-vs-smaller-package/', '/guides/how-to-compare-unit-prices/', '/guides/mixed-unit-comparisons/', '/guides/multipacks-bogo-multibuy/', '/guides/sale-price-vs-unit-price/', '/guides/when-lowest-unit-price-isnt-enough/', '/how-we-calculate/', '/methodology/', '/privacy/', '/shopping-examples/', '/stock-up-calculator/', '/terms/', '/usage-tracker/'];
const siteWideWidths = [320, 430, 768, 1024, 1440];
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'wdb-responsive-'));
const screenshots = mkdtempSync(join(tmpdir(), 'wdb-responsive-shots-'));
const processHandle = spawn(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--disable-extensions', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio:'ignore' });

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function browserEndpoint() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json()); const page = targets.find((target) => target.type === 'page'); if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl; } catch {}
    await delay(100);
  }
  throw new Error('Chrome DevTools endpoint did not become ready.');
}

class CdpClient {
  constructor(url) { this.socket = new WebSocket(url); this.nextId = 1; this.pending = new Map(); this.listeners = new Map(); }
  async open() { await new Promise((resolve,reject) => { this.socket.addEventListener('open',resolve,{once:true}); this.socket.addEventListener('error',reject,{once:true}); }); this.socket.addEventListener('message',(event) => { const message=JSON.parse(String(event.data)); if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);return}const listeners=this.listeners.get(message.method)||[];this.listeners.delete(message.method);listeners.forEach((resolve)=>resolve(message.params)); }); }
  send(method, params={}) { const id=this.nextId++; return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.socket.send(JSON.stringify({id,method,params}))}); }
  once(method) { return new Promise((resolve)=>{const listeners=this.listeners.get(method)||[];listeners.push(resolve);this.listeners.set(method,listeners)}); }
  close() { this.socket.close(); }
}

let client;
try {
  client = new CdpClient(await browserEndpoint()); await client.open(); await client.send('Page.enable'); await client.send('Runtime.enable');
  const evaluate = async (expression) => (await client.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result.value;
  const navigate = async (route,width) => { await client.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false}); const loaded=client.once('Page.loadEventFired'); await client.send('Page.navigate',{url:new URL(route,baseUrl).toString()}); await loaded; await evaluate(`Promise.all([document.fonts?document.fonts.ready:Promise.resolve(),new Promise((resolve,reject)=>{const started=performance.now();const check=()=>{if(document.querySelector('[data-site-header]')?.dataset.navigationReady==='true')resolve(true);else if(performance.now()-started>2000)reject(new Error('Navigation script did not initialize'));else setTimeout(check,10)};check()})]).then(()=>true)`); };
  const layout = () => evaluate(`(()=>{const header=document.querySelector('[data-site-header]');const logo=header?.querySelector('.brand')?.getBoundingClientRect();const nav=header?.querySelector('.primary-nav')?.getBoundingClientRect();const labels=[...header.querySelectorAll('.primary-nav>a')].map(a=>a.textContent.trim());labels.push(header.querySelector('[data-more-toggle]').childNodes[0].textContent.trim());const overflowing=[...document.querySelectorAll('body *')].flatMap(element=>{const rect=element.getBoundingClientRect();return rect.right>innerWidth+.5||rect.left<-.5?[{tag:element.tagName,className:String(element.className||''),text:(element.textContent||'').trim().slice(0,60),left:Math.round(rect.left),right:Math.round(rect.right),width:Math.round(rect.width)}]:[]}).slice(0,12);return{innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,headerWidth:header?.scrollWidth,logoLeft:logo?.left,logoRight:logo?.right,logoBottom:logo?.bottom,navLeft:nav?.left,navRight:nav?.right,navTop:nav?.top,labels,overflowing}})()`);
  const assertNoOverflow = (result,label) => { assert.equal(result.documentWidth,result.innerWidth,`${label}: document overflow ${result.documentWidth} > ${result.innerWidth}; ${JSON.stringify(result.overflowing)}`); assert.ok(result.bodyWidth<=result.innerWidth,`${label}: body overflow`); assert.ok(result.headerWidth<=result.innerWidth,`${label}: header overflow`); assert.ok(result.logoLeft>=0&&result.logoRight<=result.innerWidth,`${label}: logo clipped`); assert.ok(result.navLeft>=0&&result.navRight<=result.innerWidth,`${label}: navigation clipped`); };

  for (const width of exactWidths) {
    await navigate('/',width); const initial=await layout(); assert.equal(initial.innerWidth,width,`Viewport width ${width}`); assertNoOverflow(initial,`Home ${width}px`); assert.deepEqual(initial.labels,topLevelLinks,`${width}px: top-level navigation`);
    if(width<=679) assert.ok(initial.navTop>=initial.logoBottom,`${width}px: mobile navigation overlaps logo`); else assert.ok(initial.navLeft>=initial.logoRight,`${width}px: desktop navigation overlaps logo`);
    let state=await evaluate(`(()=>{const button=document.querySelector('[data-more-toggle]');button.click();const menu=document.querySelector('[data-more-menu]');const rect=menu.getBoundingClientRect();return{expanded:button.getAttribute('aria-expanded'),hidden:menu.hidden,links:[...menu.querySelectorAll('a')].map(a=>a.textContent.trim()),left:rect.left,right:rect.right,width:document.documentElement.scrollWidth}})()`); assert.deepEqual(state.links,moreLinks,`${width}px: More destinations`); assert.equal(state.expanded,'true'); assert.equal(state.hidden,false); assert.ok(state.left>=0&&state.right<=width,`${width}px: More panel clipped`); assert.equal(state.width,width,`${width}px: More created overflow`);
    state=await evaluate(`(()=>{const button=document.querySelector('[data-more-toggle]');button.click();return{expanded:button.getAttribute('aria-expanded'),hidden:document.querySelector('[data-more-menu]').hidden}})()`); assert.deepEqual(state,{expanded:'false',hidden:true},`${width}px: second click closes`);
    state=await evaluate(`(()=>{const button=document.querySelector('[data-more-toggle]');button.click();document.body.click();return{expanded:button.getAttribute('aria-expanded'),hidden:document.querySelector('[data-more-menu]').hidden}})()`); assert.deepEqual(state,{expanded:'false',hidden:true},`${width}px: outside click closes`);
    state=await evaluate(`(()=>{const button=document.querySelector('[data-more-toggle]');button.click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return{expanded:button.getAttribute('aria-expanded'),hidden:document.querySelector('[data-more-menu]').hidden}})()`); assert.deepEqual(state,{expanded:'false',hidden:true},`${width}px: Escape closes`);
    state=await evaluate(`(()=>{const button=document.querySelector('[data-more-toggle]');button.click();const link=document.querySelector('[data-more-menu] a');link.addEventListener('click',event=>event.preventDefault(),{once:true});link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return{expanded:button.getAttribute('aria-expanded'),hidden:document.querySelector('[data-more-menu]').hidden}})()`); assert.deepEqual(state,{expanded:'false',hidden:true},`${width}px: link selection closes`);
  }

  for(const route of routes) for(const width of siteWideWidths){await navigate(route,width);assertNoOverflow(await layout(),`${route} ${width}px`)}

  await navigate('/stock-up-calculator/',375);
  let stockUpState=await evaluate(`(()=>{const usage=document.querySelector('[data-field="amountPerDay"]');const initial=usage.value;usage.stepUp();const stepped=usage.value;const fields={salePrice:'9.99',normalPrice:'14.99',amountPerPackage:'16',packageCount:'5',amountPerDay:'0.5'};for(const [name,value] of Object.entries(fields)){const input=document.querySelector('[data-field="'+name+'"]');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))}const result=document.querySelector('[data-results]');return{initial,stepped,headline:result.querySelector('h3')?.textContent,summary:result.querySelector('h3+p')?.textContent,metrics:[...result.querySelectorAll('.metric-grid li')].map(item=>item.textContent.trim()),overflow:document.documentElement.scrollWidth>innerWidth}})()`);
  assert.equal(stockUpState.initial,'','Daily usage starts blank');
  assert.equal(stockUpState.stepped,'1','Empty daily-usage spinner starts at 1');
  assert.equal(stockUpState.headline,'Save $25.00 and get about 160 days of supply');
  assert.equal(stockUpState.summary,'Buying 5 packages at $9.99 saves you $25.00 compared with the normal price of $14.99. You’ll spend $49.95 today instead of $74.95, and the 80 oz purchased may last about 160 days at your estimated usage.');
  assert.deepEqual(stockUpState.metrics,['You pay today$49.95','Normal cost for 5 packages$74.95','Total savings$25.00 (33.4%)','Estimated supplyabout 160 days']);
  assert.equal(stockUpState.overflow,false,'Stock-up result fits a 375px viewport');

  stockUpState=await evaluate(`(()=>{const root=document.querySelector('[data-stockup]');root.querySelector('[data-reset]').click();const resetValues=Object.fromEntries([...root.querySelectorAll('[data-field]')].map(item=>[item.dataset.field,item.value]));const resetText=root.querySelector('[data-results]').textContent.trim();const values={salePrice:'0',normalPrice:'14.99',amountPerPackage:'16',packageCount:'5',amountPerDay:'1'};for(const [name,value] of Object.entries(values)){const input=root.querySelector('[data-field="'+name+'"]');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))}const invalidText=root.querySelector('[data-results]').textContent.trim();return{resetValues,resetText,invalidText}})()`);
  assert.equal(stockUpState.resetValues.amountPerDay,'','Reset clears daily usage');
  assert.equal(stockUpState.resetValues.packageCount,'1','Reset restores one package');
  assert.match(stockUpState.resetText,/Enter prices/);
  assert.match(stockUpState.invalidText,/Check the details/);
  assert.doesNotMatch(stockUpState.invalidText,/NaN|Infinity/);

  await evaluate(`localStorage.setItem('whichdealsbetter.usage.v1',JSON.stringify([{id:'browser-check',name:'Paper Towels',amount:12,unit:'roll',startDate:'2026-01-01',completedDate:'2026-02-12',createdAt:'2026-01-01T00:00:00Z'}]))`);
  await navigate('/stock-up-calculator/',375);
  stockUpState=await evaluate(`(()=>{const history=document.querySelector('[data-history]');history.selectedIndex=1;history.dispatchEvent(new Event('change',{bubbles:true}));const state={rate:document.querySelector('[data-field="amountPerDay"]').value,name:document.querySelector('[data-field="name"]').value,unit:document.querySelector('[data-field="unit"]').value,source:document.querySelector('[data-source]').textContent};localStorage.removeItem('whichdealsbetter.usage.v1');return state})()`);
  assert.ok(Math.abs(Number(stockUpState.rate)-(12/42))<1e-12,'Tracker history fills the weighted daily rate');
  assert.equal(stockUpState.name,'Paper Towels');
  assert.equal(stockUpState.unit,'roll');
  assert.match(stockUpState.source,/weighted average from 1 completed tracker period/);

  for(const [width,name] of [[320,'mobile-320'],[768,'tablet-768'],[1024,'desktop-1024']]){await navigate('/',width);await evaluate(`document.querySelector('[data-more-toggle]').click()`);const image=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const path=join(screenshots,`${name}.png`);writeFileSync(path,Buffer.from(image.data,'base64'));console.log(`Screenshot: ${path}`)}
  console.log(`PASS: four-item navigation at ${exactWidths.join(', ')}px; ${routes.length} routes at ${siteWideWidths.join(', ')}px; More toggle, outside click, link selection, Escape, ARIA state, viewport bounds, and stock-up interactions verified.`);
} finally {
  client?.close(); processHandle.kill(); try{rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch{}
}
