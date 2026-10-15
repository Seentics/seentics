import Link from 'next/link';

/** Platforms with a setup guide in the docs, each linking to it. */
const PLATFORMS: Array<{ name: string; href: string }> = [
  { name: 'Next.js', href: '/docs/frameworks' },
  { name: 'React', href: '/docs/frameworks' },
  { name: 'Astro', href: '/docs/frameworks' },
  { name: 'Shopify', href: '/docs/shopify' },
  { name: 'WordPress', href: '/docs/wordpress' },
  { name: 'WooCommerce', href: '/docs/woocommerce' },
  { name: 'Webflow', href: '/docs/website-builders' },
  { name: 'Framer', href: '/docs/website-builders' },
];

export default function PlatformStrip() {
  return (
    <section aria-labelledby="platforms" className="lx-container pt-20 sm:pt-28">
      <p id="platforms" className="lx-dim text-center text-[15px]">
        One script tag on any site. <span style={{ color: 'var(--lx-text)' }}>Guides for the stack you already use.</span>
      </p>
      <ul className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-9 gap-y-4">
        {PLATFORMS.map((p) => (
          <li key={p.name}>
            <Link
              href={p.href}
              className="lx-faint text-lg font-semibold tracking-tight transition-colors hover:text-[color:var(--lx-text)]"
            >
              {p.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
