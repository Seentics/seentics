import { C, Callout, CodeBlock, DocPage, DocSection, Li, Ol, Oli, P, RefTable, Ul } from '@/components/docs/DocsKit';
import { A, B, ComingSoon } from '@/components/docs/agency/AgencyDocs';

export const metadata = {
  title: 'Branding & custom domain · Seentics docs',
  description:
    'White-label the Seentics agency workspace with your brand, and connect your own domain with step-by-step DNS for Cloudflare, GoDaddy, Namecheap and others.',
};

export default function AgencyBrandingPage() {
  return (
    <DocPage
      eyebrow="Agency"
      title="Branding & domain"
      lead="Put your agency’s name, logo and colour on what clients see, and connect a domain of your own, such as reports.youragency.com."
    >
      <DocSection title="White label">
        <P>
          Open <B>Branding &amp; domain</B> in the workspace. The preview beside the form shows what
          clients will see as you type.
        </P>
        <RefTable
          columns={['Setting', 'What it does']}
          rows={[
            [<B key="1">Brand name</B>, 'Shown in place of Seentics.'],
            [<B key="2">Sign-in name</B>, <>A short name for your sign-in page, such as <C>meridian</C>: 3–40 lowercase letters, digits and hyphens.</>],
            [<B key="3">Logo URL</B>, <>The address of your logo image. It must start with <C>https://</C>.</>],
            [<B key="4">Primary colour</B>, <>Your brand colour, as a hex value such as <C>#7c3aed</C>.</>],
            [<B key="5">Support email</B>, 'Where clients write to for help.'],
            [<B key="6">Footer text</B>, 'A line at the bottom of every page, such as “Reports by Meridian Digital”.'],
            [<B key="7">Hide Seentics branding</B>, 'Drops “Powered by Seentics” from client pages and emails.'],
          ]}
        />
        <P>
          Choose <B>Save branding</B> when you&apos;re done.
        </P>
        <ComingSoon title="Where clients see it">
          Your branding is saved now. Clients see it once{' '}
          <A href="/docs/agency/client-sign-in">client sign-in</A> and dashboards on your own domain go
          live. The sign-in name is for that sign-in page.
        </ComingSoon>
      </DocSection>

      <DocSection id="custom-domain" title="Custom domain">
        <P>
          A custom domain puts client dashboards on an address you own, such as{' '}
          <C>reports.youragency.com</C>, instead of seentics.com.
        </P>
        <ComingSoon title="Connect it now, serving comes soon">
          You can connect and verify your domain today, and it gets its HTTPS certificate. Serving client
          dashboards on it is coming soon — until then, opening the domain shows a “not found” page. Once
          that ships, a connected domain starts working with nothing more to do.
        </ComingSoon>
        <Callout kind="tip" title="Use a subdomain">
          Pick a subdomain of a domain you own — <C>reports.youragency.com</C>, <C>analytics.youragency.com</C>.
          Not your main site: most DNS providers can&apos;t put the record this needs (a CNAME) on a bare
          domain like <C>youragency.com</C>, and it would replace your website.
        </Callout>
      </DocSection>

      <DocSection title="Connect your domain">
        <Ol>
          <Oli>
            Under <B>Custom domain</B>, enter the hostname — just the name, no <C>https://</C> or path —
            and choose <B>Add domain</B>.
          </Oli>
          <Oli>
            The workspace shows the DNS records to add. Always a <B>CNAME</B>, and sometimes a{' '}
            <B>TXT</B> record too:
          </Oli>
        </Ol>
        <RefTable
          columns={['Type', 'Name', 'Value']}
          rows={[
            [<C key="t">CNAME</C>, <C key="n">reports.youragency.com</C>, <C key="v">portal.seentics.com</C>],
            [<C key="t">TXT</C>, <C key="n">_cf-custom-hostname.reports.youragency.com</C>, 'The value shown in the workspace (only if a TXT record is shown)'],
          ]}
        />
        <Ol>
          <Oli>
            Add them at the company that runs your DNS — the steps for common providers are below. Use
            the copy buttons in the workspace so nothing is mistyped.
          </Oli>
          <Oli>
            Wait. The domain is checked automatically: every 15 seconds while the page is open, and in the
            background every 5 minutes for the first day, then hourly. Choose <B>Check now</B> to check
            straight away.
          </Oli>
        </Ol>
        <P>The domain goes through these states:</P>
        <RefTable
          columns={['State', 'In the API', 'Means']}
          rows={[
            [<B key="1">Waiting for DNS</B>, <C key="a">pending_dns</C>, 'The CNAME record has not been seen yet.'],
            [<B key="2">Issuing certificate</B>, <C key="a">pending_certificate</C>, 'DNS is right. The HTTPS certificate usually takes a few minutes.'],
            [<B key="3">Active</B>, <C key="a">active</C>, 'Connected, with a valid certificate. Keep the records in place.'],
            [<B key="4">Failed</B>, <C key="a">failed</C>, 'Something needs fixing — the reason is shown. Fix the records and check again, or remove the domain and start over.'],
          ]}
        />
        <P>
          One domain per account. To change it, choose <B>Remove</B>, then add the new one. Removing a
          domain doesn&apos;t touch your branding.
        </P>
      </DocSection>

      <DocSection title="DNS steps by provider">
        <P>
          In these steps your domain is <C>youragency.com</C> and the hostname is{' '}
          <C>reports.youragency.com</C>. Most providers want only the part before your domain in the{' '}
          <B>Name</B> or <B>Host</B> field — <C>reports</C>, not the whole hostname.
        </P>

        <h3 className="pt-2 text-lg font-semibold text-foreground">Cloudflare</h3>
        <Ol>
          <Oli>Open your domain in the Cloudflare dashboard, then <B>DNS → Records</B>.</Oli>
          <Oli>
            <B>Add record</B>: type <C>CNAME</C>, name <C>reports</C>, target <C>portal.seentics.com</C>.
          </Oli>
          <Oli>
            Turn the orange cloud off so <B>Proxy status</B> reads <B>DNS only</B> (grey cloud). Then{' '}
            <B>Save</B>.
          </Oli>
          <Oli>
            If a TXT record is shown: <B>Add record</B>, type <C>TXT</C>, name{' '}
            <C>_cf-custom-hostname.reports</C>, content the value from the workspace, <B>Save</B>.
          </Oli>
        </Ol>
        <Callout kind="warning" title="DNS only, not proxied">
          A proxied (orange cloud) record answers with Cloudflare&apos;s own addresses instead of pointing
          at <C>portal.seentics.com</C>, so the domain can&apos;t be verified and stays in{' '}
          <B>Waiting for DNS</B> or fails.
        </Callout>

        <h3 className="pt-2 text-lg font-semibold text-foreground">GoDaddy</h3>
        <Ol>
          <Oli>Sign in, open <B>My Products</B>, and choose <B>DNS</B> next to your domain.</Oli>
          <Oli>
            <B>Add New Record</B>: type <C>CNAME</C>, name <C>reports</C>, value <C>portal.seentics.com</C>,
            TTL the default. <B>Save</B>.
          </Oli>
          <Oli>
            If a TXT record is shown: <B>Add New Record</B>, type <C>TXT</C>, name{' '}
            <C>_cf-custom-hostname.reports</C>, value from the workspace. <B>Save</B>.
          </Oli>
        </Ol>

        <h3 className="pt-2 text-lg font-semibold text-foreground">Namecheap</h3>
        <Ol>
          <Oli>
            Open <B>Domain List</B>, choose <B>Manage</B> next to your domain, then the <B>Advanced DNS</B>{' '}
            tab.
          </Oli>
          <Oli>
            <B>Add New Record</B>: <C>CNAME Record</C>, host <C>reports</C>, value <C>portal.seentics.com</C>,
            TTL <C>Automatic</C>. Save it with the tick.
          </Oli>
          <Oli>
            If a TXT record is shown: <B>Add New Record</B>, <C>TXT Record</C>, host{' '}
            <C>_cf-custom-hostname.reports</C>, value from the workspace. Save it.
          </Oli>
        </Ol>
        <P>
          Advanced DNS is there only while the domain uses Namecheap&apos;s own nameservers. If it uses
          another provider&apos;s, add the records there.
        </P>

        <h3 className="pt-2 text-lg font-semibold text-foreground">Any other provider</h3>
        <Ol>
          <Oli>Find the DNS settings for your domain (sometimes “DNS zone”, “DNS records” or “Name servers”).</Oli>
          <Oli>
            Add a <C>CNAME</C> record with the name <C>reports</C> (or the full hostname, if the form asks for
            it) pointing to <C>portal.seentics.com</C>.
          </Oli>
          <Oli>Add the TXT record if the workspace shows one.</Oli>
          <Oli>Save, then come back to the workspace and choose <B>Check now</B>.</Oli>
        </Ol>
        <P>
          Your registrar is not always your DNS provider. If changes there make no difference, look up
          which company your domain&apos;s nameservers belong to and add the records there.
        </P>
      </DocSection>

      <DocSection title="Troubleshooting">
        <P>Check what the world sees with a terminal, or any online DNS lookup tool:</P>
        <CodeBlock language="bash" code={`dig +short CNAME reports.youragency.com
# should print: portal.seentics.com.`} />
        <Ul>
          <Li>
            <B>Still waiting after adding the record.</B> DNS changes usually show within minutes, but can
            take a few hours (up to 48 at worst), depending on your provider and the record&apos;s TTL.
          </Li>
          <Li>
            <B>An A or AAAA record on the same name.</B> A name with a CNAME can&apos;t have any other
            record. Delete existing A, AAAA or other records for <C>reports</C> first.
          </Li>
          <Li>
            <B>Proxied record.</B> On Cloudflare, or any provider with a proxy or “CDN” switch, set the
            CNAME to DNS only.
          </Li>
          <Li>
            <B>Stuck at Issuing certificate, or failed for the certificate.</B> If your domain has CAA
            records, they must allow the certificate authorities used for it: add CAA records for{' '}
            <C>letsencrypt.org</C> and <C>pki.goog</C>, or remove the CAA records.
          </Li>
          <Li>
            <B>A bare domain.</B> Use a subdomain. A few providers can put a CNAME on a bare domain
            (“CNAME flattening”), but most can&apos;t.
          </Li>
          <Li>
            <B>“Another account already uses this hostname”.</B> The hostname is connected to a
            different Seentics account. Remove it there first.
          </Li>
          <Li>
            <B>Too many changes.</B> You can add or replace a domain up to 10 times an hour.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="From your own code">
        <P>
          <C>GET</C> and <C>PUT /api/v1/agency/branding</C> read and save the white label;{' '}
          <C>PUT /api/v1/agency/domain</C> adds the domain and <C>POST /api/v1/agency/domain/refresh</C>{' '}
          checks it now. See the <A href="/docs/agency/api/reference#branding">API reference</A>.
        </P>
      </DocSection>
    </DocPage>
  );
}
