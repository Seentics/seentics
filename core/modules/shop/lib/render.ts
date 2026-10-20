import type { Page, Store, Template } from "../interfaces";
import { escapeHtml, escapeMultiline, safeUrl, scriptJson } from "./html";
import { taka } from "./pricing";

/**
 * The pages buyers see on the shop host: a store's product list, one product's landing page with
 * its cash-on-delivery form, and a not-found page. Plain HTML with inline CSS and one small inline
 * script: Facebook's in-app browser on a slow phone connection is the audience, so nothing waits
 * on a framework, the first photo loads eagerly and the rest lazily.
 *
 * Every value a seller wrote passes through `escapeHtml` (or `scriptJson` into the script), and
 * every URL through `safeUrl`. Nothing a seller types is ever markup.
 */

export type RenderContext = {
  /** The Seentics tracker, for the store's website: analytics, heatmaps, replays. */
  trackerScriptUrl: string;
};

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap">`;

const BASE_CSS = `
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:"Hind Siliguri","Noto Sans Bengali","Kalpurush","SolaimanLipi",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#18181b;background:#fff;line-height:1.6;font-size:16px}
img{max-width:100%;display:block}a{color:inherit}
.wrap{max-width:640px;margin:0 auto;padding:0 16px}
header.top{border-bottom:1px solid #eee;background:#fff}
header.top .wrap{display:flex;align-items:center;gap:10px;min-height:56px}
header.top img{width:36px;height:36px;border-radius:8px;object-fit:cover}
header.top b{font-size:17px}
.gallery{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:8px;margin:16px -16px 0;padding:0 16px;scrollbar-width:none}
.gallery::-webkit-scrollbar{display:none}
.gallery img{flex:0 0 100%;scroll-snap-align:center;aspect-ratio:1/1;object-fit:cover;border-radius:14px;background:#f4f4f5}
h1{font-size:26px;line-height:1.3;margin:18px 0 6px}
.name{color:#52525b;margin:0}
.price{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:12px 0}
.price .now{font-size:30px;font-weight:700;color:var(--a)}
.price s{color:#a1a1aa;font-size:18px}
.badge{background:var(--a);color:#fff;border-radius:999px;padding:2px 10px;font-size:14px;font-weight:600}
.btn{display:block;width:100%;border:0;border-radius:12px;background:var(--a);color:#fff;font:inherit;font-weight:700;font-size:19px;padding:14px;text-align:center;text-decoration:none;cursor:pointer}
.btn[disabled]{opacity:.6}
section{margin:28px 0}
h2{font-size:20px;margin:0 0 10px}
ul.hl{list-style:none;padding:0;margin:0}
ul.hl li{padding:8px 0 8px 30px;position:relative;border-bottom:1px dashed #eee}
ul.hl li:before{content:"✓";position:absolute;left:4px;top:8px;color:var(--a);font-weight:700}
.desc{color:#3f3f46}
details{border:1px solid #eee;border-radius:10px;padding:10px 14px;margin-bottom:8px}
summary{font-weight:600;cursor:pointer}
form.order{border:2px solid var(--a);border-radius:16px;padding:16px;background:#fff}
label{display:block;font-weight:600;margin:12px 0 4px}
input,textarea,select{width:100%;font:inherit;padding:12px;border:1px solid #d4d4d8;border-radius:10px;background:#fff;color:inherit}
input:focus,textarea:focus,select:focus{outline:2px solid var(--a);border-color:transparent}
.areas{display:grid;gap:8px}
.areas label{display:flex;justify-content:space-between;align-items:center;font-weight:500;border:1px solid #d4d4d8;border-radius:10px;padding:12px;margin:0}
.areas input{width:auto;margin-right:8px}
.qty{display:flex;align-items:center;gap:8px}.qty button{width:44px;height:44px;border-radius:10px;border:1px solid #d4d4d8;background:#fafafa;font-size:22px}
.qty input{text-align:center;width:70px}
.sum{background:#fafafa;border-radius:10px;padding:12px;margin:16px 0}
.sum div{display:flex;justify-content:space-between}.sum .t{font-weight:700;font-size:18px;border-top:1px solid #e4e4e7;margin-top:6px;padding-top:6px}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.msg{margin-top:12px;padding:12px;border-radius:10px;background:#fef2f2;color:#991b1b;display:none}
.done{text-align:center;padding:24px 8px;display:none}.done .tick{font-size:48px}
.cod{color:#52525b;font-size:14px;text-align:center;margin-top:10px}
.sticky{position:fixed;left:0;right:0;bottom:0;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid #eee;z-index:10}
.sticky .btn{max-width:608px;margin:0 auto}
footer{color:#71717a;font-size:14px;padding:24px 0 96px;text-align:center}
footer a{font-weight:600;color:var(--a)}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
.card{border:1px solid #eee;border-radius:14px;overflow:hidden;text-decoration:none}
.card img{aspect-ratio:1/1;object-fit:cover;width:100%;background:#f4f4f5}
.card div{padding:10px}.card b{display:block;font-size:15px;line-height:1.35}.card span{color:var(--a);font-weight:700}
`;

/** What each template changes on top of the base. */
const TEMPLATE_CSS: Record<Template, string> = {
  classic: ``,
  bold: `
body{background:#0b0b0f;color:#f4f4f5}header.top{background:#0b0b0f;border-color:#27272a}
.hero{background:var(--a);color:#fff;margin:0 -16px;padding:4px 16px 20px;border-radius:0 0 24px 24px}
.hero .price .now{color:#fff}.hero .name{color:rgba(255,255,255,.85)}.hero .badge{background:#fff;color:var(--a)}
.hero h1{font-size:30px}.desc{color:#d4d4d8}ul.hl li{border-color:#27272a}details{border-color:#27272a}
form.order{background:#18181b}input,textarea,select{background:#0b0b0f;border-color:#3f3f46}.areas label{border-color:#3f3f46}
.qty button{background:#27272a;border-color:#3f3f46;color:#fff}.sum{background:#27272a}.sticky{background:rgba(11,11,15,.96);border-color:#27272a}
.cod{color:#a1a1aa}.card{border-color:#27272a}`,
  minimal: `
h1{font-weight:600;font-size:24px}.price .now{color:#18181b}.badge{background:#18181b}
form.order{border:1px solid #e4e4e7}.btn{border-radius:999px;background:#18181b}
ul.hl li:before{color:#18181b}.gallery img{border-radius:4px}`,
  offer: `
.ribbon{background:#facc15;color:#422006;text-align:center;font-weight:700;padding:8px 12px;font-size:15px}
.price .now{font-size:36px}.badge{background:#dc2626;font-size:16px}
.stock{color:#dc2626;font-weight:600;margin:4px 0 12px}
form.order{border-color:#dc2626;box-shadow:0 0 0 4px rgba(220,38,38,.08)}`,
};

function shell(o: { title: string; description: string; image: string | null; accent: string; template: Template; body: string; trackerScript: string; canonical?: string }): string {
  return `<!doctype html><html lang="bn"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeHtml(o.title)}</title>
<meta name="description" content="${escapeHtml(o.description.slice(0, 200))}">
<meta property="og:title" content="${escapeHtml(o.title)}">
<meta property="og:description" content="${escapeHtml(o.description.slice(0, 200))}">
${o.image ? `<meta property="og:image" content="${escapeHtml(o.image)}">` : ""}
${o.canonical ? `<link rel="canonical" href="${escapeHtml(o.canonical)}">` : ""}
<meta name="theme-color" content="${escapeHtml(o.accent)}">
${FONTS}
<style>:root{--a:${/^#[0-9a-f]{6}$/i.test(o.accent) ? o.accent : "#e11d48"}}${BASE_CSS}${TEMPLATE_CSS[o.template]}</style>
${o.trackerScript}
</head><body class="t-${o.template}">${o.body}</body></html>`;
}

const trackerTag = (ctx: RenderContext, websiteId: string) =>
  `<script defer data-website-id="${escapeHtml(websiteId)}" src="${escapeHtml(ctx.trackerScriptUrl)}"></script>`;

function header(store: Store): string {
  const logo = safeUrl(store.logoUrl);
  return `<header class="top"><div class="wrap">${logo ? `<img src="${escapeHtml(logo)}" alt="">` : ""}<a href="/${escapeHtml(store.slug)}" style="text-decoration:none"><b>${escapeHtml(store.name)}</b></a></div></header>`;
}

function footer(store: Store): string {
  const links: string[] = [];
  if (store.phone) links.push(`কল করুন: <a href="tel:${escapeHtml(store.phone)}">${escapeHtml(store.phone)}</a>`);
  if (store.whatsapp) links.push(`<a href="https://wa.me/88${escapeHtml(store.whatsapp)}" rel="noopener">WhatsApp</a>`);
  const fb = safeUrl(store.facebookUrl);
  if (fb) links.push(`<a href="${escapeHtml(fb)}" rel="noopener">Facebook পেজ</a>`);
  return `<footer><div class="wrap">${links.join(" · ")}${links.length ? "<br>" : ""}© ${escapeHtml(store.name)} · <span style="opacity:.7">Powered by Seentics</span></div></footer>`;
}

/** One product's landing page, with the order form. */
export function renderProductPage(store: Store, page: Page, ctx: RenderContext): string {
  const images = page.images.map((u) => safeUrl(u)).filter((u): u is string => u !== null);
  const discount = page.comparePrice && page.comparePrice > page.price ? Math.round((1 - page.price / page.comparePrice) * 100) : 0;
  const gallery = images.length
    ? `<div class="gallery">${images.map((u, i) => `<img src="${escapeHtml(u)}" alt="${escapeHtml(page.productName)}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'} width="608" height="608">`).join("")}</div>`
    : "";
  const priceRow = `<div class="price"><span class="now">${taka(page.price)}</span>${page.comparePrice && page.comparePrice > page.price ? `<s>${taka(page.comparePrice)}</s>` : ""}${discount ? `<span class="badge">${discount}% ছাড়</span>` : ""}</div>`;
  const hero = `<div class="hero">${gallery}<h1>${escapeHtml(page.title)}</h1><p class="name">${escapeHtml(page.productName)}</p>${priceRow}${page.template === "offer" ? `<p class="stock">⚡ স্টক সীমিত, আজই অর্ডার করুন</p>` : ""}<a class="btn" href="#order">অর্ডার করুন</a></div>`;
  const highlights = page.highlights.length ? `<section><h2>কেন নেবেন</h2><ul class="hl">${page.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul></section>` : "";
  const description = page.description.trim() ? `<section><h2>বিস্তারিত</h2><div class="desc">${escapeMultiline(page.description)}</div></section>` : "";
  const faq = page.faq.length ? `<section><h2>সাধারণ প্রশ্ন</h2>${page.faq.map((f) => `<details><summary>${escapeHtml(f.q)}</summary><p>${escapeMultiline(f.a)}</p></details>`).join("")}</section>` : "";
  const insideCharge = page.freeDelivery ? 0 : store.deliveryInsideDhaka;
  const outsideCharge = page.freeDelivery ? 0 : store.deliveryOutsideDhaka;
  const charge = (n: number) => (n === 0 ? "ফ্রি" : taka(n));
  const option = page.options && page.options.values.length
    ? `<label for="o">${escapeHtml(page.options.label)}</label><select id="o" name="option" required><option value="">বেছে নিন</option>${page.options.values.map((v) => `<option>${escapeHtml(v)}</option>`).join("")}</select>`
    : "";

  const form = `<section id="order"><h2>অর্ডার করতে নিচের তথ্য দিন</h2>
<form class="order" id="f" novalidate>
<label for="n">আপনার নাম</label><input id="n" name="name" autocomplete="name" required maxlength="80">
<label for="p">মোবাইল নম্বর</label><input id="p" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" required maxlength="20">
<label for="ad">সম্পূর্ণ ঠিকানা</label><textarea id="ad" name="address" rows="3" required maxlength="300" placeholder="বাসা/রোড, এলাকা, থানা, জেলা"></textarea>
<label>ডেলিভারি এলাকা</label><div class="areas">
<label><span><input type="radio" name="area" value="inside_dhaka" checked>ঢাকার ভিতরে</span><span>${charge(insideCharge)}</span></label>
<label><span><input type="radio" name="area" value="outside_dhaka">ঢাকার বাইরে</span><span>${charge(outsideCharge)}</span></label></div>
<label for="d">জেলা (ঐচ্ছিক)</label><input id="d" name="district" maxlength="40">
${option}
<label for="q">পরিমাণ</label><div class="qty"><button type="button" data-q="-1" aria-label="কমান">−</button><input id="q" name="quantity" type="number" inputmode="numeric" min="1" max="${page.maxQuantity}" value="1"><button type="button" data-q="1" aria-label="বাড়ান">+</button></div>
<label for="nt">কিছু বলার থাকলে (ঐচ্ছিক)</label><input id="nt" name="note" maxlength="300">
<div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
<div class="sum"><div><span>পণ্যের দাম</span><span id="s1"></span></div><div><span>ডেলিভারি চার্জ</span><span id="s2"></span></div><div class="t"><span>মোট</span><span id="s3"></span></div></div>
<button class="btn" id="b" type="submit">অর্ডার কনফার্ম করুন</button>
<p class="cod">💵 ক্যাশ অন ডেলিভারি: পণ্য হাতে পেয়ে টাকা দিন</p>
<div class="msg" id="m" role="alert"></div>
</form>
<div class="done" id="ok"><div class="tick">✅</div><h2>অর্ডার সম্পন্ন হয়েছে!</h2><p id="okn"></p><p>${escapeMultiline(page.thankYouMessage || "আমাদের প্রতিনিধি শীঘ্রই আপনাকে কল করে অর্ডারটি নিশ্চিত করবেন।")}</p></div>
</section>`;

  const config = {
    pageId: page.id,
    price: page.price,
    inside: insideCharge,
    outside: outsideCharge,
    max: page.maxQuantity,
    phone: store.phone,
  };
  const script = `<script>(function(){var C=${scriptJson(config)};
var f=document.getElementById('f'),q=document.getElementById('q'),m=document.getElementById('m'),b=document.getElementById('b');
function tk(n){return '৳'+n.toLocaleString('en-IN')}
function area(){var r=f.querySelector('input[name=area]:checked');return r?r.value:'inside_dhaka'}
function qty(){var n=parseInt(q.value,10);if(!(n>=1))n=1;if(n>C.max)n=C.max;return n}
function sum(){var n=qty(),d=area()==='inside_dhaka'?C.inside:C.outside;document.getElementById('s1').textContent=tk(C.price*n);document.getElementById('s2').textContent=d?tk(d):'ফ্রি';document.getElementById('s3').textContent=tk(C.price*n+d)}
f.addEventListener('change',sum);q.addEventListener('input',sum);
f.querySelectorAll('[data-q]').forEach(function(x){x.addEventListener('click',function(){q.value=Math.min(C.max,Math.max(1,qty()+parseInt(x.getAttribute('data-q'),10)));sum()})});
sum();
function show(t){m.innerHTML=t;m.style.display='block'}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function ls(k){try{return localStorage.getItem(k)}catch(e){return null}}
function ck(n){try{var h=document.cookie.split('; ').find(function(c){return c.indexOf(n+'=')===0});return h?decodeURIComponent(h.slice(n.length+1)).slice(0,300):null}catch(e){return null}}
function ad(){var a={};try{var c=JSON.parse(ls('snc_clk')||'null');if(c&&typeof c==='object')a.clk=c}catch(e){}
var u=new URLSearchParams(location.search).get('fbclid');if(u&&!(a.clk&&a.clk.fbclid)){a.clk=a.clk||{};a.clk.fbclid={v:u.slice(0,500),ts:Date.now()}}
var p=ck('_fbp'),c2=ck('_fbc');if(p)a.fbp=p;if(c2)a.fbc=c2;return Object.keys(a).length?a:null}
var call=C.phone?' <a href="tel:'+esc(C.phone)+'">'+esc(C.phone)+'</a>':'';
var ERR={RATE_LIMITED:'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',LIMIT_REACHED:'এই মুহূর্তে অনলাইনে অর্ডার নেওয়া যাচ্ছে না।'+(call?' অর্ডার করতে কল করুন:'+call:''),SERVICE_UNAVAILABLE:'সাময়িক সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করুন।'+(call?' অথবা কল করুন:'+call:''),invalid_phone:'সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)।',invalid_order:'সব তথ্য ঠিকভাবে দিন।',not_found:'এই পণ্যটি এখন পাওয়া যাচ্ছে না।'};
f.addEventListener('submit',function(e){e.preventDefault();m.style.display='none';
var d=new FormData(f),ph=String(d.get('phone')||'').trim(),nm=String(d.get('name')||'').trim(),adr=String(d.get('address')||'').trim();
if(nm.length<2){show('আপনার নাম লিখুন।');return}
if(!/^(\\+?88)?0?1[3-9]\\d{8}$/.test(ph.replace(/[\\s-]/g,'').replace(/[০-৯]/g,function(x){return '০১২৩৪৫৬৭৮৯'.indexOf(x)}))){show(ERR.invalid_phone);return}
if(adr.length<8){show('সম্পূর্ণ ঠিকানা লিখুন।');return}
if(f.option&&!f.option.value){show('একটি অপশন বেছে নিন।');return}
var body={pageId:C.pageId,name:nm,phone:ph,address:adr,area:area(),district:String(d.get('district')||'').trim()||null,quantity:qty(),option:f.option?f.option.value:null,note:String(d.get('note')||'').trim()||null,hp:String(d.get('website')||''),anonymous_id:ls('snc_vid'),session_id:ls('snc_sid'),ad:ad(),page_url:location.href.slice(0,2000)};
b.disabled=true;b.textContent='অপেক্ষা করুন…';
fetch('/api/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().catch(function(){return {ok:false,error:'SERVICE_UNAVAILABLE'}})}).then(function(r){
if(r&&r.ok){f.style.display='none';document.getElementById('ok').style.display='block';document.getElementById('okn').textContent='অর্ডার নম্বর: #'+r.orderNumber;var s=document.querySelector('.sticky');if(s)s.style.display='none';
try{window.seentics&&window.seentics.track&&window.seentics.track('cod_order',{order:r.orderNumber})}catch(e){}
document.getElementById('ok').scrollIntoView({behavior:'smooth'});return}
show(ERR[r&&r.error]||ERR.SERVICE_UNAVAILABLE);b.disabled=false;b.textContent='অর্ডার কনফার্ম করুন'}).catch(function(){show(ERR.SERVICE_UNAVAILABLE);b.disabled=false;b.textContent='অর্ডার কনফার্ম করুন'})});
var st=document.querySelector('.sticky'),od=document.getElementById('order');
if(st&&'IntersectionObserver' in window){new IntersectionObserver(function(es){st.style.display=es[0].isIntersecting?'none':'block'}).observe(od)}
})();</script>`;

  const body = `${page.template === "offer" && discount ? `<div class="ribbon">🔥 বিশেষ অফার: ${discount}% ছাড়!</div>` : ""}${header(store)}
<main class="wrap">${hero}${highlights}${description}${faq}${form}</main>
${footer(store)}
<div class="sticky"><a class="btn" href="#order">অর্ডার করুন · ${taka(page.price)}</a></div>
${script}`;

  return shell({
    title: `${page.title} | ${store.name}`,
    description: page.description || page.productName,
    image: images[0] ?? null,
    accent: page.accent,
    template: page.template,
    body,
    trackerScript: trackerTag(ctx, store.websiteId),
    canonical: page.url,
  });
}

/** The store's published products. */
export function renderStorePage(store: Store, pages: Page[], ctx: RenderContext): string {
  const cards = pages.length
    ? `<div class="cards">${pages.map((p) => {
      const img = safeUrl(p.images[0]);
      return `<a class="card" href="/${escapeHtml(store.slug)}/${escapeHtml(p.slug)}">${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy">` : `<img alt="">`}<div><b>${escapeHtml(p.productName)}</b><span>${taka(p.price)}</span></div></a>`;
    }).join("")}</div>`
    : `<p style="margin:32px 0;color:#71717a">এখনো কোনো পণ্য নেই।</p>`;
  const body = `${header(store)}<main class="wrap"><h1>${escapeHtml(store.name)}</h1>${cards}</main>${footer(store)}`;
  return shell({ title: store.name, description: `${store.name}: অনলাইনে অর্ডার করুন, ক্যাশ অন ডেলিভারি`, image: safeUrl(pages[0]?.images[0]), accent: "#e11d48", template: "classic", body, trackerScript: trackerTag(ctx, store.websiteId), canonical: store.url });
}

/** Nothing here: an unknown store, or a page that is a draft or gone. Never says which. */
export function renderNotFound(): string {
  return shell({
    title: "পাওয়া যায়নি",
    description: "এই পেজটি পাওয়া যায়নি।",
    image: null,
    accent: "#e11d48",
    template: "minimal",
    body: `<main class="wrap" style="text-align:center;padding:80px 16px"><div style="font-size:56px">🔍</div><h1>পেজটি পাওয়া যায়নি</h1><p class="name">লিংকটি ভুল অথবা পণ্যটি এখন আর নেই।</p></main>`,
    trackerScript: "",
  });
}
