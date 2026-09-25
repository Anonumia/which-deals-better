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

const topLevelLinks = ['Compare', 'BOGO', 'Coupons', 'More'];
const moreLinks = ['Tip Calculator', 'Usage', 'Guides', 'Shopping Examples', 'Methodology', 'About', 'Contact'];
const exactWidths = [320, 360, 375, 390, 412, 430, 679, 680, 768, 1024, 1440];
const routes = ['/', '/404', '/about/', '/bogo-calculator/', '/contact/', '/coupon-comparator/', '/guides/', '/guides/bigger-vs-smaller-package/', '/guides/how-to-compare-unit-prices/', '/guides/mixed-unit-comparisons/', '/guides/multipacks-bogo-multibuy/', '/guides/sale-price-vs-unit-price/', '/guides/when-lowest-unit-price-isnt-enough/', '/how-we-calculate/', '/methodology/', '/privacy/', '/shopping-examples/', '/terms/', '/tip-calculator/', '/usage-tracker/'];
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

  for(const width of [320,768,1024]){
    await navigate('/coupon-comparator/',width);
    await evaluate(`(()=>{const input=document.querySelector('[data-field="regularPrice"]');input.focus();return true})()`);
    await client.send('Input.insertText',{text:'14.99'});
    const currencyState=await evaluate(`(()=>{const root=document.querySelector('[data-coupon-calculator]');const input=root.querySelector('[data-field="regularPrice"]');const typed=input.value;input.stepUp();const steppedUp=input.value;input.stepDown();const steppedDown=input.value;const type=root.querySelector('[data-field="couponType"]');type.value='fixed';type.dispatchEvent(new Event('change',{bubbles:true}));const visible=[...root.querySelectorAll('.input-prefix')].filter(wrapper=>{const prefix=wrapper.querySelector(':scope > span');return prefix&&!prefix.hidden}).map(wrapper=>{const field=wrapper.querySelector('input');const prefix=wrapper.querySelector(':scope > span');const fieldRect=field.getBoundingClientRect();const prefixRect=prefix.getBoundingClientRect();const wrapperRect=wrapper.getBoundingClientRect();const fieldStyle=getComputedStyle(field);return{widthDifference:Math.abs(wrapperRect.width-fieldRect.width),centerDifference:Math.abs((prefixRect.top+prefixRect.height/2)-(fieldRect.top+fieldRect.height/2)),prefixInset:prefixRect.left-fieldRect.left,textInset:parseFloat(fieldStyle.paddingLeft),gap:fieldRect.left+parseFloat(fieldStyle.paddingLeft)-prefixRect.right,rightPadding:parseFloat(fieldStyle.paddingRight)}});const couponPrefix=root.querySelector('[data-currency-prefix]');const fixedVisible=!couponPrefix.hidden;type.value='percent';type.dispatchEvent(new Event('change',{bubbles:true}));return{typed,steppedUp,steppedDown,visible,fixedVisible,percentHidden:couponPrefix.hidden,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
    assert.equal(currencyState.typed,'14.99',`${width}px: keyboard entry works`);
    assert.equal(currencyState.steppedUp,'15',`${width}px: native spinner increments currency`);
    assert.equal(currencyState.steppedDown,'14.99',`${width}px: native spinner decrements currency`);
    assert.equal(currencyState.visible.length,5,`${width}px: regular, sale, and selected dollar-coupon prefixes are visible`);
    assert.ok(currencyState.visible.every(item=>item.widthDifference<=.5),`${width}px: prefix wrappers match input widths`);
    assert.ok(currencyState.visible.every(item=>item.centerDifference<=.5),`${width}px: dollar prefixes are vertically centered; ${JSON.stringify(currencyState.visible)}`);
    assert.ok(currencyState.visible.every(item=>Math.abs(item.prefixInset-12)<=.5),`${width}px: dollar prefixes use a consistent inset`);
    assert.ok(currencyState.visible.every(item=>Math.abs(item.textInset-26.4)<=.5),`${width}px: currency values share a consistent text start`);
    assert.ok(currencyState.visible.every(item=>item.gap>=1&&item.gap<=6),`${width}px: prefix-to-value spacing is compact`);
    assert.ok(currencyState.visible.every(item=>item.rightPadding>=40),`${width}px: currency text reserves room for spinner controls`);
    assert.equal(currencyState.fixedVisible,true,`${width}px: dollar coupon shows a currency prefix`);
    assert.equal(currencyState.percentHidden,true,`${width}px: percentage coupon hides the currency prefix`);
    assert.equal(currencyState.overflow,false,`${width}px: currency inputs do not create overflow`);
    const image=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const path=join(screenshots,`coupon-${width}.png`);writeFileSync(path,Buffer.from(image.data,'base64'));console.log(`Screenshot: ${path}`);
  }

  await navigate('/tip-calculator/',375);
  let tipState=await evaluate(`(()=>{const root=document.querySelector('[data-tip-calculator]');const bill=root.querySelector('[data-bill]');const buttons=[...root.querySelectorAll('[data-tip]')];const initial={bill:bill.value,pressed:buttons.map(button=>button.getAttribute('aria-pressed')),text:root.querySelector('[data-results]').textContent.trim()};bill.value='42';bill.dispatchEvent(new Event('input',{bubbles:true}));const waiting=root.querySelector('[data-results]').textContent.trim();buttons.find(button=>button.dataset.tip==='20').click();const result=root.querySelector('[data-results]');const selected={headline:result.querySelector('h3')?.textContent,summary:result.querySelector('.tip-summary')?.textContent,metrics:[...result.querySelectorAll('.metric-grid li')].map(item=>item.innerText.replace(/\\s+/g,' ').trim()),pressed:buttons.map(button=>button.getAttribute('aria-pressed')),heights:buttons.map(button=>button.getBoundingClientRect().height),overflow:document.documentElement.scrollWidth>innerWidth};return{initial,waiting,selected}})()`);
  assert.deepEqual(tipState.initial.pressed,['false','false','false'],'No tip percentage is preselected');
  assert.equal(tipState.initial.bill,'');
  assert.match(tipState.initial.text,/Enter a bill amount/);
  assert.match(tipState.waiting,/Choose 15%, 18%, or 20%/);
  assert.equal(tipState.selected.headline,'Tip: $8.40');
  assert.equal(tipState.selected.summary,'Bill $42.00 · 20% selected');
  assert.deepEqual(tipState.selected.metrics,['Tip $8.40','Total including tip $50.40']);
  assert.deepEqual(tipState.selected.pressed,['false','false','true']);
  assert.ok(tipState.selected.heights.every(height=>height>=58),'Tip choices have mobile-friendly tap targets');
  assert.equal(tipState.selected.overflow,false,'Tip calculator fits a 375px viewport');
  { const image=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const path=join(screenshots,'tip-375.png');writeFileSync(path,Buffer.from(image.data,'base64'));console.log(`Screenshot: ${path}`); }

  tipState=await evaluate(`(()=>{const root=document.querySelector('[data-tip-calculator]');const bill=root.querySelector('[data-bill]');bill.value='0';bill.dispatchEvent(new Event('input',{bubbles:true}));const zero=root.querySelector('[data-results]').textContent.trim();bill.value='';bill.dispatchEvent(new Event('input',{bubbles:true}));const blank=root.querySelector('[data-results]').textContent.trim();root.querySelector('[data-reset]').click();return{zero,blank,reset:{bill:bill.value,pressed:[...root.querySelectorAll('[data-tip]')].map(button=>button.getAttribute('aria-pressed')),text:root.querySelector('[data-results]').textContent.trim()}}})()`);
  assert.match(tipState.zero,/Check the bill amount/);
  assert.doesNotMatch(tipState.zero,/NaN|Infinity/);
  assert.match(tipState.blank,/Enter the bill amount/);
  assert.doesNotMatch(tipState.blank,/NaN|Infinity/);
  assert.deepEqual(tipState.reset,{bill:'',pressed:['false','false','false'],text:'Enter a bill amount and choose 15%, 18%, or 20%.'});

  await navigate('/bogo-calculator/',375);
  let bogoState=await evaluate(`(()=>{const root=document.querySelector('[data-bogo-calculator]');const set=(selector,value)=>{const field=root.querySelector(selector);field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}))};set('[data-a="pricePerItem"]','8');set('[data-a="buyQuantity"]','2');set('[data-a="getQuantity"]','1');set('[data-a="quantity"]','5');set('[data-b="pricePerItem"]','7');set('[data-b="quantity"]','5');const result=root.querySelector('[data-results]');return{headline:result.querySelector('h3')?.textContent,summary:result.querySelector('.comparison-summary')?.textContent,cards:[...result.querySelectorAll('.offer-result')].map(card=>card.innerText.replace(/\\s+/g,' ').trim()),overflow:document.documentElement.scrollWidth>innerWidth}})()`);
  assert.equal(bogoState.headline,'Offer A costs $3.00 less');
  assert.equal(bogoState.summary,'You save $3.00 with Offer A.');
  assert.match(bogoState.cards[0],/Checkout total \$32\.00/);
  assert.match(bogoState.cards[0],/Effective price per item \$6\.40/);
  assert.match(bogoState.cards[0],/remaining 2 items cost full price/);
  assert.match(bogoState.cards[1],/Checkout total \$35\.00/);
  assert.equal(bogoState.overflow,false,'BOGO result fits a 375px viewport');
  { const image=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const path=join(screenshots,'bogo-375.png');writeFileSync(path,Buffer.from(image.data,'base64'));console.log(`Screenshot: ${path}`); }

  bogoState=await evaluate(`(()=>{const root=document.querySelector('[data-bogo-calculator]');const set=(selector,value)=>{const field=root.querySelector(selector);field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}))};set('[data-a="quantity"]','4');set('[data-b="pricePerItem"]','7');set('[data-b="quantity"]','2');const result=root.querySelector('[data-results]');const different={headline:result.querySelector('h3')?.textContent,summary:result.querySelector('.comparison-summary')?.textContent,detail:result.querySelector('.comparison-detail')?.innerText.replace(/\\s+/g,' ').trim()};const type=root.querySelector('[data-discount-type]');type.value='percent';type.dispatchEvent(new Event('change',{bubbles:true}));const percentVisible=!root.querySelector('[data-percent-wrap]').hidden;root.querySelector('[data-reset]').click();const reset={priceA:root.querySelector('[data-a="pricePerItem"]').value,priceB:root.querySelector('[data-b="pricePerItem"]').value,buy:root.querySelector('[data-a="buyQuantity"]').value,get:root.querySelector('[data-a="getQuantity"]').value,quantityA:root.querySelector('[data-a="quantity"]').value,quantityB:root.querySelector('[data-b="quantity"]').value,type:type.value,percentHidden:root.querySelector('[data-percent-wrap]').hidden,resultText:root.querySelector('[data-results]').textContent.trim()};set('[data-a="pricePerItem"]','-1');set('[data-b="pricePerItem"]','7');const invalid=root.querySelector('[data-results]').textContent.trim();return{different,percentVisible,reset,invalid}})()`);
  assert.equal(bogoState.different.headline,'Offer A has the lower price per item');
  assert.match(bogoState.different.summary,/checkout totals are not a like-for-like savings comparison/);
  assert.match(bogoState.different.detail,/Offer B has the lower checkout total by \$10\.00/);
  assert.match(bogoState.different.detail,/Offer A costs \$1\.00 less per item/);
  assert.equal(bogoState.percentVisible,true,'Percentage field appears for percentage-off promotions');
  assert.deepEqual(bogoState.reset,{priceA:'',priceB:'',buy:'1',get:'1',quantityA:'2',quantityB:'2',type:'free',percentHidden:true,resultText:'Enter a price per item for both offers to compare the promotion.'});
  assert.match(bogoState.invalid,/Check the details/);
  assert.doesNotMatch(bogoState.invalid,/NaN|Infinity/);

  for(const [width,name] of [[320,'mobile-320'],[768,'tablet-768'],[1024,'desktop-1024']]){await navigate('/',width);await evaluate(`document.querySelector('[data-more-toggle]').click()`);const image=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const path=join(screenshots,`${name}.png`);writeFileSync(path,Buffer.from(image.data,'base64'));console.log(`Screenshot: ${path}`)}
  console.log(`PASS: four-item navigation at ${exactWidths.join(', ')}px; ${routes.length} routes at ${siteWideWidths.join(', ')}px; More toggle, outside click, link selection, Escape, ARIA state, viewport bounds, currency input alignment, Tip interactions, and BOGO interactions verified.`);
} finally {
  client?.close(); processHandle.kill(); try{rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch{}
}
