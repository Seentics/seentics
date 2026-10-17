import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, Ol, Oli, P, RefTable, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'AI assistants (MCP) · Seentics docs',
  description: 'Connect Claude, Cursor, VS Code or any MCP client to your Seentics data with a read-only API key.',
};

const URL = 'https://api.seentics.com/api/v1/mcp';

export default function McpPage() {
  return (
    <DocPage
      eyebrow="Integration"
      title="AI assistants (MCP)"
      lead="Seentics is a Model Context Protocol server. Connect Claude, Cursor, VS Code or any other MCP client and ask about your websites in plain English — across every site and client on your account."
    >
      <DocSection title="What you can ask">
        <Ul>
          <Li>“Which of my clients’ conversions dropped this week?”</Li>
          <Li>“Summarize why mobile checkout is losing visitors.”</Li>
          <Li>“Compare paid and organic traffic on the shop over the last 30 days.”</Li>
          <Li>“Show me the most frustrated sessions from yesterday and what went wrong.”</Li>
          <Li>“Which pages throw JavaScript errors, and how often?”</Li>
        </Ul>
        <P>
          The assistant picks the tools; Seentics answers with your numbers. It reads only — the server has no tool that
          creates, changes or deletes anything.
        </P>
      </DocSection>

      <DocSection title="Connect">
        <Ol>
          <Oli>
            Open any website&apos;s <C>Developers → AI assistants (MCP)</C> tab and choose <C>Create key</C>. The{' '}
            <strong>AI assistant (MCP)</strong> access holds <C>analytics:read</C>, <C>replays:read</C> and{' '}
            <C>heatmaps:read</C> and nothing else.
          </Oli>
          <Oli>Add the server to your assistant with the key as a Bearer token:</Oli>
        </Ol>
        <CodeBlock language="bash" filename="Claude Code" code={`claude mcp add --transport http seentics ${URL} \\
  --header "Authorization: Bearer $SEENTICS_API_KEY"`} />
        <CodeBlock
          language="json"
          filename="Claude Desktop — claude_desktop_config.json"
          code={JSON.stringify({ mcpServers: { seentics: { command: 'npx', args: ['-y', 'mcp-remote', URL, '--header', 'Authorization: Bearer YOUR_API_KEY'] } } }, null, 2)}
        />
        <CodeBlock
          language="json"
          filename="Cursor — ~/.cursor/mcp.json"
          code={JSON.stringify({ mcpServers: { seentics: { url: URL, headers: { Authorization: 'Bearer YOUR_API_KEY' } } } }, null, 2)}
        />
        <CodeBlock
          language="json"
          filename="VS Code — .vscode/mcp.json"
          code={JSON.stringify({ servers: { seentics: { type: 'http', url: URL, headers: { Authorization: 'Bearer YOUR_API_KEY' } } } }, null, 2)}
        />
        <P>
          Any other client: Streamable HTTP at <C>{URL}</C>, with <C>Authorization: Bearer …</C> (or <C>X-API-Key</C>).
          The server is stateless and answers JSON; there is no event stream.
        </P>
      </DocSection>

      <DocSection title="Tools">
        <RefTable
          columns={['Tool', 'What it answers']}
          rows={[
            ['list_websites', 'Your websites, their ids and the client each belongs to. Every other tool takes a website_id from here.'],
            ['compare_websites', 'Every site (or one client’s) over the last N complete days against the N before: visitors, pageviews, goal completions, revenue, leads, ad conversions, recordings — biggest drop first, with totals per client.'],
            ['explain_change', 'What moved on one site: traffic, each device, each channel, the pages that gained or lost most, the main conversion event.'],
            ['compare_segment', 'Sessions, bounce rate, conversions and conversion rate for a device, channel and/or entry page, against the previous period.'],
            ['get_goal_stats', 'Each goal’s completions and conversion rate.'],
            ['get_traffic_summary · get_top_pages · get_top_sources · get_audience_breakdown', 'Traffic and audience, as the dashboard shows them.'],
            ['list_funnels · get_funnel_performance · get_revenue_summary', 'Funnels step by step, and revenue.'],
            ['list_frustrated_sessions · get_session_summary · list_recent_sessions', 'Session recordings (needs replays:read).'],
            ['list_heatmap_pages · get_heatmap_insights', 'Heatmaps (needs heatmaps:read).'],
            ['list_error_groups · list_alerts · list_recommendations · get_impact_report', 'JavaScript errors, anomaly alerts, and what Seentics suggested and what it changed.'],
          ]}
        />
        <P>
          These are the same reads the dashboard&apos;s Seentics AI uses, so the two always agree. A key sees only the tools its
          scopes allow, and only its own account&apos;s websites.
        </P>
      </DocSection>

      <DocSection title="Good to know">
        <Ul>
          <Li>
            Comparisons cover complete UTC days, ending yesterday, so a half-finished today never reads as a drop.
          </Li>
          <Li>
            The data includes text your visitors wrote — page paths, titles, event names, error messages. The server tells the
            assistant to treat it as data, and since nothing it can call writes, a hostile page title cannot make it change
            anything.
          </Li>
          <Li>Requests count against the key&apos;s rate limit, like the REST API. Delete the key to disconnect the assistant.</Li>
        </Ul>
        <Callout kind="warning" title="Keep the key in the assistant's config">
          Anyone with the key can read your analytics. Don&apos;t paste it into a chat or commit a project&apos;s{' '}
          <C>mcp.json</C> with it — use an environment variable where the client supports one.
        </Callout>
        <P>
          See <Link href="/docs/api-keys" className="text-primary hover:underline">API keys</Link> for scopes and key hygiene.
        </P>
      </DocSection>
    </DocPage>
  );
}
