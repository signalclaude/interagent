# Inter-Agent Communications MCP Server

An MCP server that enables multiple Claude Code agents to communicate with each other — sending bug reports, feature requests, and API specs as markdown without manual copy-paste between instances.

## Setup

```bash
npm install
npm run build
```

## Claude Code Configuration

Add this to your Claude Code MCP settings (`~/.claude/settings.json` or project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "interagent": {
      "command": "node",
      "args": ["C:/repos/claude.interAgentComs/dist/index.js"]
    }
  }
}
```

## Agent Onboarding

Add the contents of `AGENT_INSTRUCTIONS.md` to each agent's CLAUDE.md, customizing the registration call with the agent's name, workspace path, and description.

## Data Storage

All data is stored in `~/.claude-interagent/`:

- `registry.json` — agent registrations
- `messages/` — message content (MD files)
- `messages-meta/` — message metadata (JSON)
- `specs/` — published API specs
- `status.json` — agent statuses

Signal files are dropped into each agent's workspace at `.claude/inbox/`.
