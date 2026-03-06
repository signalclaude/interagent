# Interagent

An MCP server that lets multiple Claude Code agents talk to each other. Send bug reports, feature requests, API specs, and status updates between agent instances — no more manually copying markdown files between terminals.

## The Problem

When you're running multiple Claude Code agents on different components of the same project (e.g., a client, a server, and a nav mesh service), they can't talk to each other. If one agent finds a bug in another agent's domain, you have to copy the findings yourself. Agents forget where other repos live after context compaction. There's no coordination.

## The Solution

Interagent is an MCP server that gives your agents a shared communication layer:

- **Agent Registry** — Agents register with short names, workspace paths, and descriptions. No more forgetting where repos live.
- **Markdown Messaging** — Agents write up detailed bug reports and feature requests and send them directly to the responsible agent.
- **Signal Files** — A lightweight file is dropped in the target agent's workspace as a notification breadcrumb.
- **Inbox Polling** — Agents check for incoming messages between tasks (with you as the fallback to say "check your incoming").
- **Shared Specs** — Publish API contracts and schemas that any agent can reference. Single source of truth.
- **Status Board** — Agents broadcast what they're working on so others (and you) can see at a glance.
- **Escalation** — If an agent is stuck, it flags the message and notifies you to come take a look.

## How It Works

```
                    Interagent MCP Server
                    (~/.claude-interagent/)
                   /          |           \
          register         send_message    publish_spec
          check_inbox      reply_message   get_spec
          set_status       escalate        list_specs
                /             |              \
        [consumer]      [db-server]      [navmesh]
        Claude Code     Claude Code      Claude Code
        Instance 1      Instance 2       Instance 3
```

1. Each agent registers on startup via CLAUDE.md instructions
2. Agent A finds a bug in Agent B's domain, writes it up, sends via `send_message`
3. The server stores the message and drops a signal file in Agent B's workspace
4. Agent B picks it up on its next `check_inbox`, works on it, replies when done
5. If stuck, Agent B escalates — you get notified to hop over and help

## Quick Start

### Install

```bash
git clone https://github.com/signalclaude/interagent.git
cd interagent
npm install
npm run build
```

### Configure Claude Code

Add to your MCP settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "interagent": {
      "command": "node",
      "args": ["/path/to/interagent/dist/index.js"]
    }
  }
}
```

### Onboard Your Agents

Add the contents of [`AGENT_INSTRUCTIONS.md`](AGENT_INSTRUCTIONS.md) to each agent's `CLAUDE.md`, customizing the registration call:

```
register_agent("my-agent", "/path/to/workspace", "What this agent handles")
```

The instructions tell the agent to register on startup, poll its inbox between tasks, and use the full messaging toolkit.

## Tools

| Tool | Description |
|------|-------------|
| `register_agent` | Register with a short name, workspace path, and description |
| `list_agents` | List all registered agents |
| `get_agent` | Get details for a specific agent |
| `send_message` | Send a markdown message to another agent |
| `check_inbox` | Check for incoming messages |
| `read_message` | Read a message (auto-acknowledges receipt) |
| `reply_message` | Reply to a message, optionally mark the original complete |
| `escalate` | Flag a message as blocked — needs human attention |
| `publish_spec` | Publish an API contract or schema |
| `get_spec` | Retrieve a published spec |
| `list_specs` | List all published specs |
| `set_status` | Set your current working status |
| `get_status` | Check another agent's status |
| `get_all_statuses` | Dashboard view of all agent statuses |

## Data Storage

All data lives in `~/.claude-interagent/`:

```
~/.claude-interagent/
  registry.json          # agent registrations
  messages/              # message content (MD files)
  messages-meta/         # message metadata (JSON)
  specs/                 # published API specs/contracts
  status.json            # agent statuses
```

Signal files are dropped into each agent's workspace at `.claude/inbox/`.

## Notification Strategy

Agents are reactive — they don't have push listeners. Interagent uses a three-tier approach:

1. **Polling** — CLAUDE.md instructs agents to call `check_inbox` between tasks
2. **Signal files** — A file dropped in `.claude/inbox/` acts as a visible breadcrumb
3. **You** — If an agent is deep in a rabbit hole, hop over and say "check your incoming"

## License

MIT
