import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, Ol, Oli, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'WordPress · Seentics docs',
  description: 'Install the Seentics plugin on WordPress: paste your website ID and tracking starts.',
};

export default function WordPressPage() {
  return (
    <DocPage
      eyebrow="Integration"
      title="WordPress"
      lead="The Seentics plugin adds the tracker to every page of your site. You paste one ID; there is no code to edit."
    >
      <DocSection title="Install the plugin">
        <Ol>
          <Oli>
            <a href="/downloads/seentics-wordpress.zip" className="font-medium text-primary hover:underline">
              Download seentics-wordpress.zip
            </a>
            .
          </Oli>
          <Oli>In WordPress: <C>Plugins → Add New → Upload Plugin</C>, choose the zip, then <C>Install Now</C> and <C>Activate</C>.</Oli>
          <Oli>
            Open <C>Settings → Seentics</C>, paste your website ID and save. You will find the ID in
            Seentics under <C>Settings → Tracking</C>; it looks like{' '}
            <C>123e4567-e89b-12d3-a456-426614174000</C>.
          </Oli>
        </Ol>
        <P>Nothing is tracked until the ID is saved. The plugin refuses anything that is not a website ID.</P>
      </DocSection>

      <DocSection title="Check that it works">
        <Ol>
          <Oli>Open your site in a private window. The plugin skips logged-in administrators, so your own visits in the normal window do not count.</Oli>
          <Oli>In Seentics, open the <C>Overview</C>. Your visit should appear in Live Visitors within a few seconds.</Oli>
        </Ol>
        <P>
          Nothing shows up? View the page source and search for <C>seentics-js</C>. If the tag is missing,
          the ID is not saved or a caching plugin is serving an old copy of the page: clear its cache. If
          the tag is there, see <Link href="/docs/quick-start" className="text-primary hover:underline">Quick start</Link>{' '}
          for the console and network checks.
        </P>
      </DocSection>

      <DocSection title="Settings">
        <Ul>
          <Li><strong className="font-medium text-foreground">Website ID</strong> — required.</Li>
          <Li><strong className="font-medium text-foreground">Track visits by logged-in administrators</strong> — off by default.</Li>
          <Li><strong className="font-medium text-foreground">WooCommerce</strong> — shown when WooCommerce is active; see <Link href="/docs/woocommerce" className="text-primary hover:underline">WooCommerce</Link>.</Li>
          <Li><strong className="font-medium text-foreground">Tracker script URL</strong> — change only if you host Seentics yourself. Must be https.</Li>
        </Ul>
      </DocSection>

      <DocSection title="Without the plugin">
        <P>
          If you cannot install plugins, paste the tag below into your theme&apos;s <C>&lt;head&gt;</C> —
          most themes and header-injection plugins offer a place for it. Use the plugin or the tag, not
          both: a second copy is ignored, but it logs a warning.
        </P>
        <CodeBlock
          filename="header.php"
          language="html"
          code={`<script defer data-website-id="YOUR_WEBSITE_ID" src="https://seentics.com/trackers/seentics.min.js"></script>`}
        />
      </DocSection>

      <DocSection title="Privacy and consent">
        <P>
          Seentics decides what to record from the consent settings of the site in the dashboard. If you
          use a cookie-consent plugin, pass the visitor&apos;s answer with <C>seentics.consent(true)</C> or{' '}
          <C>seentics.consent(false)</C>; see the{' '}
          <Link href="/docs/tracker" className="text-primary hover:underline">tracker reference</Link>.
        </P>
        <Callout kind="note" title="External script">
          The plugin loads the tracker from Seentics and the tracker sends visit data to Seentics. The
          plugin&apos;s readme says so, as WordPress.org requires.
        </Callout>
      </DocSection>
    </DocPage>
  );
}
