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
  for(const [width,name] of [[320,'mobile-320'],[768,'tablet-768'],[1024,'desktop-1024']]){await navigate('/',width);await evaluate(`document.querySelector('[data-more-toggle]').click()`);const image=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const path=join(screenshots,`${name}.png`);writeFileSync(path,Buffer.from(image.data,'base64'));console.log(`Screenshot: ${path}`)}
  console.log(`PASS: four-item navigation at ${exactWidths.join(', ')}px; ${routes.length} routes at ${siteWideWidths.join(', ')}px; More toggle, outside click, link selection, Escape, ARIA state, and viewport bounds verified.`);
} finally {
  client?.close(); processHandle.kill(); try{rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch{}
}
