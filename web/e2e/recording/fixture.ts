import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/** A real HTTP website. The snippet is copied unchanged from the onboarding UI. */
export async function startTrackedWebsite(port: number) {
  let snippet = '';
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (req.url === '/done') {
      res.end('<!doctype html><title>Visit ended</title><h1>Visit ended</h1>');
      return;
    }
    if (req.url !== '/shop' && req.url !== '/checkout') {
      res.writeHead(404).end('Not found');
      return;
    }
    const checkout = req.url === '/checkout';
    res.end(`<!doctype html>
      <html><head><meta charset="utf-8"><title>Recording test store</title>
      <style>
        body { margin: 0; font: 20px sans-serif; color: #182032; background: #f4f6fb; }
        main { padding: 40px; } button, input, a { font: inherit; padding: 12px; }
        label { display: block; margin: 20px 0; } #footer { margin-top: 1200px; padding: 30px; }
      </style>${snippet}</head>
      <body><main>
        <h1 id="page-title">${checkout ? 'Checkout' : 'Recording test store'}</h1>
        <p id="status">${checkout ? 'Review your order' : 'Cart is empty'}</p>
        <button id="action">${checkout ? 'Place order' : 'Add to cart'}</button>
        <label>Email <input id="email" type="email"></label>
        <label>Password <input id="password" type="password"></label>
        <div data-seentics-mask id="private-note">Private customer note</div>
        <div data-seentics-block id="blocked">Blocked account details</div>
        ${checkout ? '' : '<a href="/checkout">Continue to checkout</a>'}
        <div id="footer">End of ${checkout ? 'checkout' : 'catalog'}</div>
      </main>
      <script>
        document.querySelector('#action').addEventListener('click', () => {
          document.querySelector('#status').textContent = ${JSON.stringify(checkout ? 'Order confirmed' : 'Cart contains 1 item')};
        });
      </script></body></html>`);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    installSnippet(value: string) { snippet = value; },
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
  };
}
