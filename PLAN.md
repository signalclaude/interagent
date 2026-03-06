# Inter-Agent Communications MCP Server

## Overview
An MCP server that enables multiple Claude Code agents to communicate with each other — sending requests, bug reports, and feature specs as MD files without the user manually copying content between instances.

## Architecture
- **Runtime**: TypeScript (Node.js) — native MCP SDK support
- **Storage**: File-based (JSON for registry/state, MD files for messages)
- **Transport**: stdio (standard MCP server for Claude Code)

## MCP Tools (Phase 1)

### 1. Agent Registry
- **`register_agent`** — Register with a short name, workspace path, and area-of-concern description
- **`list_agents`** — List all registered agents and their metadata
- **`get_agent`** — Get details for a specific agent by name

### 2. Messaging
- **`send_message`** — Author and send an MD file to a named target agent. Stores the message on the server and drops a signal file in the target's workspace
- **`check_inbox`** — Check for pending incoming messages. Returns list of unread messages with summaries
- **`read_message`** — Read full content of a specific message. Auto-sends acknowledgment back to sender
- **`reply_message`** — Send a response back to the originating agent (completion notice, follow-up, etc.)

### 3. Escalation
- **`escalate`** — Flag a message as blocked/stuck with a reason. Notifies the sender agent that human attention is needed at the target agent's instance

### 4. Shared Specs/Contracts
- **`publish_spec`** — Publish an API contract, interface definition, or schema under a named key
- **`get_spec`** — Retrieve a published spec by name
- **`list_specs`** — List all published specs

### 5. Status Board
- **`set_status`** — Set agent's current status
- **`get_status`** — Check a specific agent's status
- **`get_all_statuses`** — Dashboard view of all agents

## Notification Strategy
- **Primary**: CLAUDE.md instruction tells agents to call `check_inbox` periodically during normal workflow
- **Signal file**: MCP server drops a lightweight file in target's `.claude/inbox/` as a visible breadcrumb
- **Fallback**: User hops to the agent instance, interrupts, says "check your incoming"

## Data Layout
```
~/.claude-interagent/
  registry.json          # agent registrations
  messages/
    <id>.md              # stored message content
  messages-meta/
    <id>.json            # metadata (from, to, status, timestamps)
  specs/
    <name>.md            # published specs/contracts
  status.json            # agent statuses
```

## Signal File Format
Dropped into target workspace:
```
.claude/inbox/<from>-<timestamp>.signal
```
Contains a one-liner: "Message from <agent>: <summary>. Run check_inbox to read."

## Message Lifecycle
1. Sender calls `send_message` -> stored + signal file dropped
2. Target calls `check_inbox` -> sees pending message
3. Target calls `read_message` -> auto-ack sent to sender
4. Target works on it, then calls `reply_message` -> completion/response stored + signal file to sender
5. If stuck -> `escalate` -> signal file to sender with "needs human" flag

## Agent Onboarding Document
A standard markdown file (`AGENT_INSTRUCTIONS.md`) distributed to each agent's CLAUDE.md covering:
1. What this system is
2. How to register on startup
3. All available MCP tools with usage examples
4. Inbox polling instructions (check on task start, after completing work, before going idle)
5. How to send messages
6. How to respond to messages
7. How to publish and consume shared specs
8. How to maintain status
