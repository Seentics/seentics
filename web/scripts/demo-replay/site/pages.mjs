/**
 * Northbound — the made-up storefront the demo replay records.
 *
 * Product images are inline SVG rather than photos: the recording is a DOM, and an
 * <img src> would point at a host the replay iframe cannot reach. Inline art keeps
 * the whole session in one JSON file.
 */
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

/** Flat illustrations, one per product kind, in the given colour on the given ground. */
export function art(kind, color, ground = '#e9e2d5') {
  const shapes = {
    pack: `
      <rect x="62" y="58" width="76" height="104" rx="22" fill="${color}"/>
      <path d="M78 58c0-14 10-22 22-22s22 8 22 22" fill="none" stroke="#2b2925" stroke-width="7" stroke-linecap="round"/>
      <rect x="66" y="62" width="68" height="34" rx="16" fill="#000" opacity=".14"/>
      <rect x="76" y="112" width="48" height="36" rx="10" fill="#000" opacity=".12"/>
      <rect x="94" y="104" width="12" height="6" rx="3" fill="#2b2925"/>
      <rect x="56" y="96" width="8" height="46" rx="4" fill="#2b2925" opacity=".55"/>
      <rect x="136" y="96" width="8" height="46" rx="4" fill="#2b2925" opacity=".55"/>`,
    shell: `
      <path d="M70 52l30-10 30 10 26 20-10 28-14-6v70H68V94l-14 6-10-28z" fill="${color}"/>
      <path d="M100 42v122" stroke="#000" stroke-opacity=".18" stroke-width="4"/>
      <path d="M86 46c4 10 24 10 28 0" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="5"/>
      <rect x="76" y="112" width="16" height="4" rx="2" fill="#000" opacity=".2"/>
      <rect x="108" y="112" width="16" height="4" rx="2" fill="#000" opacity=".2"/>`,
    boot: `
      <path d="M70 46h40v64l40 18c10 5 14 12 14 22v10H62v-24c0-30 8-54 8-90z" fill="${color}"/>
      <rect x="58" y="152" width="110" height="14" rx="5" fill="#2b2925"/>
      <path d="M78 62h26M78 76h26M78 90h26" stroke="#f4efe6" stroke-width="4" stroke-linecap="round"/>`,
    vest: `
      <path d="M74 46h18l8 18 8-18h18l22 26-6 92H58l-6-92z" fill="${color}"/>
      <path d="M100 64v100" stroke="#000" stroke-opacity=".2" stroke-width="4"/>
      <path d="M64 92h72M62 120h76M60 146h80" stroke="#000" stroke-opacity=".12" stroke-width="5"/>`,
    cap: `
      <path d="M52 118c0-34 22-56 48-56s48 22 48 56z" fill="${color}"/>
      <path d="M100 118c22 0 50 4 62 12-10 8-40 10-62 6z" fill="#2b2925" opacity=".85"/>
      <circle cx="100" cy="62" r="6" fill="#000" opacity=".25"/>
      <path d="M100 66v50" stroke="#000" stroke-opacity=".14" stroke-width="3"/>`,
  };
  return `<svg viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${kind}">
    <rect width="200" height="200" fill="${ground}"/>
    <ellipse cx="100" cy="172" rx="58" ry="7" fill="#000" opacity=".08"/>
    ${shapes[kind]}
  </svg>`;
}

export const products = [
  { slug: 'trailhead-32l', name: 'Trailhead 32L', sub: 'Recycled ripstop · 3 colours', price: 168, kind: 'pack', color: '#c8743a', ground: '#ece3d3', badge: 'Bestseller' },
  { slug: 'fell-shell', name: 'Fell Shell', sub: '3-layer waterproof', price: 240, kind: 'shell', color: '#3f6b5c', ground: '#e3e8e2' },
  { slug: 'ridge-mid', name: 'Ridge Mid', sub: 'Resoleable leather boot', price: 185, kind: 'boot', color: '#7b5a3f', ground: '#efe6dc' },
  { slug: 'cairn-vest', name: 'Cairn Vest', sub: 'Recycled down fill', price: 120, kind: 'vest', color: '#2f4b6e', ground: '#e2e6ee' },
];

const nav = (count) => `
  <nav class="nav">
    <a class="logo" href="/">NORTHBOUND</a>
    <div class="spacer"></div>
    <a class="link" href="/">Shop</a>
    <a class="link" href="/">Journal</a>
    <a class="link" href="/">Repairs</a>
    <a class="cart-pill" id="cart-pill" href="/cart">Cart <span class="count" id="cart-count">${count}</span></a>
  </nav>`;

const footer = `
  <footer>
    <div>
      <div class="logo" style="color:#1c1b19">NORTHBOUND</div>
      <p style="margin-top:10px;max-width:22rem;line-height:1.6">Repairs are free for the life of the product. Returns within 60 days, no questions.</p>
    </div>
    <div><h4>Shop</h4><p>Packs</p><p>Layers</p><p>Footwear</p></div>
    <div><h4>Company</h4><p>Our repairs</p><p>Stockists</p><p>Contact</p></div>
  </footer>`;

const doc = (title, body, script = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><style>${css}</style></head>
<body>${body}${script ? `<script>${script}</script>` : ''}</body></html>`;

export function home() {
  const [hero] = products;
  return doc('Northbound — Built for the long way round', `
    ${nav(2)}
    <main class="wrap">
      <section class="hero">
        <div>
          <p class="eyebrow">New season</p>
          <h1>Built for the<br>long way round.</h1>
          <p class="lede">Weatherproof packs and layers, made to be repaired rather than replaced.</p>
          <div class="btns">
            <a class="btn dark" href="/products/${hero.slug}">Shop the Trailhead</a>
            <a class="btn light" href="/">Size guide</a>
          </div>
        </div>
        <div class="hero-art">${art(hero.kind, hero.color, hero.ground)}</div>
      </section>
      <div class="section-head"><h2>Packed for autumn</h2><a href="/">View all</a></div>
      <section class="grid">
        ${products.map((p) => `
          <a class="card" href="/products/${p.slug}" data-product="${p.slug}">
            <div class="art">${art(p.kind, p.color, p.ground)}</div>
            <div class="meta">
              <div class="name">${p.name}${p.badge ? `<span class="badge">${p.badge}</span>` : ''}</div>
              <div class="sub">${p.sub}</div>
              <div class="price">$${p.price}</div>
            </div>
          </a>`).join('')}
      </section>
      <section class="promise">
        <div><h3>Free lifetime repairs</h3><p>Rips, zips and buckles fixed for as long as you own it.</p></div>
        <div><h3>Recycled materials</h3><p>Every shell and pack is made from recycled nylon and polyester.</p></div>
        <div><h3>60-day returns</h3><p>Take it out in the weather. If it isn't right, send it back.</p></div>
      </section>
    </main>
    ${footer}`);
}

export function product() {
  const p = products[0];
  const colours = [
    { name: 'Rust', color: '#c8743a', ground: '#ece3d3' },
    { name: 'Moss', color: '#4f6b3f', ground: '#e5e9dc' },
    { name: 'Slate', color: '#3d4b5c', ground: '#e2e6ec' },
  ];
  return doc(`${p.name} — Northbound`, `
    ${nav(2)}
    <main class="wrap">
      <p class="crumbs">Shop / Packs / ${p.name}</p>
      <section class="pdp">
        <div class="gallery">
          <div class="main" id="main-art">${art(p.kind, p.color, p.ground)}</div>
          <div class="thumbs">
            ${colours.map((c, i) => `<div class="${i === 0 ? 'on' : ''}">${art(p.kind, c.color, c.ground)}</div>`).join('')}
            <div>${art('pack', '#c8743a', '#d8cfbf')}</div>
          </div>
        </div>
        <div>
          <p class="eyebrow">Packs</p>
          <h1 style="margin-top:10px">${p.name}</h1>
          <p class="rating"><b>★★★★★</b> 4.8 · 312 reviews</p>
          <p class="price">$${p.price}</p>
          <p class="desc">A 32-litre day-and-a-half pack with a roll-top, a padded laptop sleeve and side pockets that fit a litre bottle. Recycled ripstop, PFC-free finish.</p>
          <div class="opt">
            <div class="label">Colour: <span id="colour-name">Rust</span></div>
            <div class="swatches">
              ${colours.map((c, i) => `<button class="swatch${i === 0 ? ' on' : ''}" style="background:${c.color}" data-name="${c.name}" data-color="${c.color}" data-ground="${c.ground}" aria-label="${c.name}"></button>`).join('')}
            </div>
          </div>
          <div class="opt">
            <div class="label">Back length</div>
            <div class="sizes">
              <button class="size">S/M</button><button class="size on">M/L</button><button class="size">L/XL</button>
            </div>
          </div>
          <button class="add" id="add">Add to cart · $${p.price}</button>
          <p class="ship">Free shipping over $150 · Ships in 1–2 days</p>
        </div>
      </section>
      <section class="details">
        <div><h3>Roll-top closure</h3><p>Expands from 28 to 32 litres and sheds rain without a cover.</p></div>
        <div><h3>Laptop sleeve</h3><p>Suspended, padded sleeve fits up to a 16" laptop.</p></div>
        <div><h3>Lifetime repairs</h3><p>Send it back when something breaks. We fix it for free.</p></div>
      </section>
    </main>
    ${footer}`, `
    const art = ${art.toString()};
    document.querySelectorAll('.swatch').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === b));
      document.getElementById('colour-name').textContent = b.dataset.name;
      document.getElementById('main-art').innerHTML = art('pack', b.dataset.color, b.dataset.ground);
    }));
    document.querySelectorAll('.size').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.size').forEach((x) => x.classList.toggle('on', x === b));
    }));
    document.getElementById('add').addEventListener('click', () => {
      const add = document.getElementById('add');
      add.classList.add('done');
      add.textContent = 'Added ✓';
      document.getElementById('cart-count').textContent = '3';
      document.getElementById('cart-pill').classList.add('bump');
      const colour = document.getElementById('colour-name').textContent;
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = '<div class="mini">' + document.getElementById('main-art').innerHTML + '</div>'
        + '<div><b>Added to cart</b><div style="color:#8a8478;font-size:13px;margin-top:2px">${p.name} · ' + colour + ' · M/L</div></div>'
        + '<a href="/cart">View cart</a>';
      document.body.appendChild(toast);
    });`);
}

export function cart() {
  const lines = [
    { name: 'Trailhead 32L', sub: 'Moss · M/L', price: 168, kind: 'pack', color: '#4f6b3f', ground: '#e5e9dc' },
    { name: 'Fell Shell', sub: 'Forest · M', price: 240, kind: 'shell', color: '#3f6b5c', ground: '#e3e8e2' },
    { name: 'Merino Beanie', sub: 'Charcoal', price: 45, kind: 'cap', color: '#4a4744', ground: '#ebe7e1' },
  ];
  const subtotal = lines.reduce((s, l) => s + l.price, 0);
  return doc('Your cart — Northbound', `
    ${nav(3)}
    <main class="wrap">
      <section class="cart">
        <div>
          <h1>Your cart</h1>
          ${lines.map((l) => `
            <div class="line">
              <div class="thumb">${art(l.kind, l.color, l.ground)}</div>
              <div><div class="name">${l.name}</div><div class="sub">${l.sub}</div><div class="qty">Qty 1 · Remove</div></div>
              <div class="amt">$${l.price}</div>
            </div>`).join('')}
        </div>
        <aside class="summary">
          <h2>Order summary</h2>
          <div class="row"><span>Subtotal</span><span>$${subtotal}</span></div>
          <div class="row"><span>Shipping</span><span>Free</span></div>
          <div class="row"><span>Discount</span><span id="discount">—</span></div>
          <div class="coupon">
            <input id="coupon" placeholder="Discount code" autocomplete="off">
            <button id="apply">Apply</button>
          </div>
          <div class="row total"><span>Total</span><span id="total">$${subtotal}</span></div>
          <button class="checkout">Checkout</button>
          <p class="secure">Secure checkout · 60-day returns</p>
        </aside>
      </section>
    </main>
    ${footer}`, `
    // The bug the replay is there to find: the coupon service returns 500 with an
    // error body, and the handler reads a discount it never got. Nothing on screen changes.
    document.getElementById('apply').addEventListener('click', async () => {
      const code = document.getElementById('coupon').value;
      const res = await fetch('/api/cart/coupon', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) console.error('[cart] coupon request failed', res.status);
      const body = await res.json();
      document.getElementById('discount').textContent = '-$' + body.discount.amount;
    });`);
}
