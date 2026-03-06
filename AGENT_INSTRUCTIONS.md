# Inter-Agent Communications — Agent Instructions

Add the contents below to your CLAUDE.md (or reference this file from it) to enable inter-agent communication.

---

## Inter-Agent Communication System

You are connected to an inter-agent MCP server that allows you to communicate with other Claude Code agents working on related components of the same project. Use this system to send bug reports, feature requests, API contract updates, and status information to other agents — instead of relying on the user to copy files between instances.

### On Startup

When you begin a session, immediately register yourself:

```
register_agent("<your-name>", "<your-workspace-path>", "<brief description of your area of concern>")
```

Replace the placeholders with your actual values. Example:

```
register_agent("navmesh", "C:/repos/navmesh-server", "Navigation mesh pathfinding, spatial queries, and route optimization")
```

Then set your status:

```
set_status("<your-name>", "online - ready for tasks")
```

### Inbox Polling

**You MUST check your inbox regularly.** Call `check_inbox` with your agent name:

- At the **start** of every new task or conversation
- **After completing** any significant unit of work
- **Before going idle** or asking the user what to do next
- When you see `.signal` files in your `.claude/inbox/` directory

If you have incoming messages, read them with `read_message` and prioritize accordingly.

### Sending Messages

When you discover a bug, need a feature, or have information relevant to another agent's domain:

1. Use `list_agents` to see who is registered and what they handle
2. Write up your findings in markdown
3. Send it: `send_message("<your-name>", "<target-agent>", "<subject>", "<markdown content>")`

Be detailed in your messages. Include:
- What you found or what you need
- Relevant code references (file paths, function names)
- Expected vs actual behavior (for bugs)
- Any suggested approach (for features)

### Responding to Messages

When you receive a message via `check_inbox`:

1. Read it with `read_message` (this auto-acknowledges receipt)
2. Work on the request
3. When done, use `reply_message` with `mark_complete: true`
4. If you're stuck and need the human, use `escalate` with a clear reason

### Shared Specs & Contracts

When you define or change an API, schema, or interface that other agents depend on:

1. Publish it: `publish_spec("<spec-name>", "<markdown content>", "<your-name>")`
2. Notify affected agents via `send_message`

Before implementing against another agent's API, check for published specs:

1. `list_specs` to see what's available
2. `get_spec("<spec-name>")` to read the contract

### Status Board

Keep your status updated so other agents (and the user) know what you're working on:

- `set_status("<your-name>", "implementing feature X")`
- `set_status("<your-name>", "idle")`
- `set_status("<your-name>", "blocked - waiting on navmesh API changes")`

Check other agents before sending requests: `get_status("<agent-name>")` or `get_all_statuses`.

### Available Tools Reference

| Tool | Purpose |
|------|---------|
| `register_agent` | Register yourself on startup |
| `list_agents` | See all registered agents |
| `get_agent` | Get details for one agent |
| `send_message` | Send an MD message to another agent |
| `check_inbox` | Check for incoming messages |
| `read_message` | Read a message (auto-acknowledges) |
| `reply_message` | Reply to a message, optionally mark complete |
| `escalate` | Flag a message as blocked, needs human |
| `publish_spec` | Publish an API spec/contract |
| `get_spec` | Read a published spec |
| `list_specs` | List all published specs |
| `set_status` | Update your working status |
| `get_status` | Check one agent's status |
| `get_all_statuses` | See all agent statuses |
