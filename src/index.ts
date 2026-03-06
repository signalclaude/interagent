#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  registerAgent,
  getAgent,
  listAgents,
  saveMessage,
  getMessage,
  updateMessageMeta,
  getMessagesForAgent,
  dropSignalFile,
  publishSpec,
  getSpec,
  listSpecs,
  setStatus,
  getStatus,
  getAllStatuses,
  loadRegistry,
} from "./storage.js";
import type { MessageMeta } from "./storage.js";

const server = new McpServer({
  name: "interagent-comms",
  version: "1.0.0",
});

// --- Agent Registry ---

server.tool(
  "register_agent",
  "Register this agent with the inter-agent communication server. Call this on startup.",
  {
    name: z.string().describe("Short name for this agent (e.g. 'consumer', 'navmesh', 'db-server')"),
    workspace_path: z.string().describe("Absolute path to this agent's workspace/repo"),
    description: z.string().describe("Brief description of this agent's area of concern"),
  },
  async ({ name, workspace_path, description }) => {
    const agent = await registerAgent(name, workspace_path, description);
    await setStatus(name, "online");
    return {
      content: [
        {
          type: "text" as const,
          text: `Agent "${name}" registered successfully.\nWorkspace: ${agent.workspacePath}\nDescription: ${agent.description}`,
        },
      ],
    };
  }
);

server.tool(
  "list_agents",
  "List all registered agents and their metadata.",
  {},
  async () => {
    const agents = await listAgents();
    if (agents.length === 0) {
      return { content: [{ type: "text" as const, text: "No agents registered." }] };
    }
    const lines = agents.map(
      (a) => `- **${a.name}**: ${a.description}\n  Workspace: ${a.workspacePath}\n  Registered: ${a.registeredAt}`
    );
    return { content: [{ type: "text" as const, text: lines.join("\n\n") }] };
  }
);

server.tool(
  "get_agent",
  "Get details for a specific registered agent.",
  {
    name: z.string().describe("Agent name to look up"),
  },
  async ({ name }) => {
    const agent = await getAgent(name);
    if (!agent) {
      return { content: [{ type: "text" as const, text: `Agent "${name}" not found.` }] };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: `**${agent.name}**\nDescription: ${agent.description}\nWorkspace: ${agent.workspacePath}\nRegistered: ${agent.registeredAt}`,
        },
      ],
    };
  }
);

// --- Messaging ---

server.tool(
  "send_message",
  "Send a markdown message to another agent. Stores the message and drops a signal file in the target's workspace.",
  {
    from: z.string().describe("Your agent name (the sender)"),
    to: z.string().describe("Target agent name"),
    subject: z.string().describe("Brief subject line for the message"),
    content: z.string().describe("Full markdown content of the message (bug report, feature request, etc.)"),
  },
  async ({ from, to, subject, content }) => {
    const targetAgent = await getAgent(to);
    if (!targetAgent) {
      return { content: [{ type: "text" as const, text: `Target agent "${to}" is not registered. Use list_agents to see available agents.` }] };
    }

    const id = uuidv4();
    const meta: MessageMeta = {
      id,
      from,
      to,
      subject,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveMessage(id, content, meta);

    try {
      await dropSignalFile(targetAgent.workspacePath, from, subject);
    } catch {
      // Signal file drop is best-effort
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Message sent to "${to}".\nID: ${id}\nSubject: ${subject}\nSignal file dropped in ${targetAgent.workspacePath}/.claude/inbox/`,
        },
      ],
    };
  }
);

server.tool(
  "check_inbox",
  "Check for incoming messages. Call this periodically to see if other agents have sent you requests.",
  {
    agent_name: z.string().describe("Your agent name"),
  },
  async ({ agent_name }) => {
    const messages = await getMessagesForAgent(agent_name);
    const pending = messages.filter((m) => m.status === "pending");
    const unread = messages.filter((m) => m.status === "pending" || m.status === "acknowledged");

    if (unread.length === 0) {
      return { content: [{ type: "text" as const, text: "No new messages." }] };
    }

    const lines = unread.map(
      (m) =>
        `- [${m.status.toUpperCase()}] **${m.subject}** (from: ${m.from}, id: ${m.id})\n  Sent: ${m.createdAt}`
    );

    return {
      content: [
        {
          type: "text" as const,
          text: `You have ${unread.length} message(s) (${pending.length} unread):\n\n${lines.join("\n\n")}\n\nUse read_message with the message ID to read the full content.`,
        },
      ],
    };
  }
);

server.tool(
  "read_message",
  "Read the full content of a message. Automatically acknowledges receipt to the sender.",
  {
    message_id: z.string().describe("The message ID to read"),
    reader: z.string().describe("Your agent name (for acknowledgment)"),
  },
  async ({ message_id, reader }) => {
    const msg = await getMessage(message_id);
    if (!msg) {
      return { content: [{ type: "text" as const, text: `Message "${message_id}" not found.` }] };
    }

    // Mark as read/acknowledged
    if (msg.meta.status === "pending") {
      await updateMessageMeta(message_id, { status: "acknowledged" });

      // Drop ack signal to sender
      const sender = await getAgent(msg.meta.from);
      if (sender) {
        try {
          await dropSignalFile(
            sender.workspacePath,
            reader,
            `Acknowledged: ${msg.meta.subject}`
          );
        } catch {
          // Best effort
        }
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `**From**: ${msg.meta.from}\n**Subject**: ${msg.meta.subject}\n**Sent**: ${msg.meta.createdAt}\n**Status**: acknowledged\n\n---\n\n${msg.content}`,
        },
      ],
    };
  }
);

server.tool(
  "reply_message",
  "Reply to a message. Use this to report completion, send follow-up info, or answer questions.",
  {
    original_message_id: z.string().describe("ID of the message you're replying to"),
    from: z.string().describe("Your agent name"),
    subject: z.string().describe("Reply subject"),
    content: z.string().describe("Full markdown reply content"),
    mark_complete: z.boolean().optional().describe("Set to true if the original request is now complete"),
  },
  async ({ original_message_id, from, subject, content, mark_complete }) => {
    const original = await getMessage(original_message_id);
    if (!original) {
      return { content: [{ type: "text" as const, text: `Original message "${original_message_id}" not found.` }] };
    }

    // Update original message status
    if (mark_complete) {
      await updateMessageMeta(original_message_id, { status: "completed" });
    }

    // Save reply as new message
    const replyId = uuidv4();
    const meta: MessageMeta = {
      id: replyId,
      from,
      to: original.meta.from,
      subject,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replyTo: original_message_id,
    };

    await saveMessage(replyId, content, meta);

    // Signal the original sender
    const sender = await getAgent(original.meta.from);
    if (sender) {
      try {
        await dropSignalFile(sender.workspacePath, from, subject);
      } catch {
        // Best effort
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Reply sent to "${original.meta.from}".\nReply ID: ${replyId}\nOriginal message ${mark_complete ? "marked complete" : "still open"}.`,
        },
      ],
    };
  }
);

// --- Escalation ---

server.tool(
  "escalate",
  "Flag a message as blocked. Notifies the sender that human attention is needed at your instance.",
  {
    message_id: z.string().describe("The message ID that is blocked"),
    agent_name: z.string().describe("Your agent name"),
    reason: z.string().describe("Why you are stuck and what you need from the human"),
  },
  async ({ message_id, agent_name, reason }) => {
    const msg = await getMessage(message_id);
    if (!msg) {
      return { content: [{ type: "text" as const, text: `Message "${message_id}" not found.` }] };
    }

    await updateMessageMeta(message_id, {
      status: "escalated",
      escalationReason: reason,
    });

    // Signal the sender about escalation
    const sender = await getAgent(msg.meta.from);
    if (sender) {
      try {
        await dropSignalFile(
          sender.workspacePath,
          agent_name,
          `ESCALATED: ${msg.meta.subject} - needs human attention at ${agent_name}`
        );
      } catch {
        // Best effort
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Message escalated. Sender "${msg.meta.from}" has been notified that human attention is needed at your instance.\nReason: ${reason}`,
        },
      ],
    };
  }
);

// --- Shared Specs ---

server.tool(
  "publish_spec",
  "Publish an API contract, interface definition, or schema that other agents can reference.",
  {
    name: z.string().describe("Name/key for this spec (e.g. 'navmesh-api', 'db-schema')"),
    content: z.string().describe("Full markdown content of the spec"),
    publisher: z.string().describe("Your agent name"),
  },
  async ({ name, content, publisher }) => {
    const header = `<!-- Published by: ${publisher} at ${new Date().toISOString()} -->\n\n`;
    await publishSpec(name, header + content);
    return {
      content: [
        {
          type: "text" as const,
          text: `Spec "${name}" published successfully. Other agents can retrieve it with get_spec.`,
        },
      ],
    };
  }
);

server.tool(
  "get_spec",
  "Retrieve a published spec/contract by name.",
  {
    name: z.string().describe("Name of the spec to retrieve"),
  },
  async ({ name }) => {
    const content = await getSpec(name);
    if (!content) {
      return { content: [{ type: "text" as const, text: `Spec "${name}" not found. Use list_specs to see available specs.` }] };
    }
    return { content: [{ type: "text" as const, text: content }] };
  }
);

server.tool(
  "list_specs",
  "List all published specs/contracts.",
  {},
  async () => {
    const specs = await listSpecs();
    if (specs.length === 0) {
      return { content: [{ type: "text" as const, text: "No specs published." }] };
    }
    return {
      content: [{ type: "text" as const, text: `Published specs:\n${specs.map((s) => `- ${s}`).join("\n")}` }],
    };
  }
);

// --- Status Board ---

server.tool(
  "set_status",
  "Set your current working status so other agents can see what you're doing.",
  {
    agent_name: z.string().describe("Your agent name"),
    status: z.string().describe("Current status (e.g. 'implementing pathfinding refactor', 'idle', 'blocked on API changes')"),
  },
  async ({ agent_name, status }) => {
    const entry = await setStatus(agent_name, status);
    return {
      content: [
        { type: "text" as const, text: `Status updated: ${agent_name} → "${status}"` },
      ],
    };
  }
);

server.tool(
  "get_status",
  "Check what a specific agent is currently working on.",
  {
    agent_name: z.string().describe("Agent name to check"),
  },
  async ({ agent_name }) => {
    const entry = await getStatus(agent_name);
    if (!entry) {
      return { content: [{ type: "text" as const, text: `No status set for "${agent_name}".` }] };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: `**${entry.agent}**: ${entry.status}\nLast updated: ${entry.updatedAt}`,
        },
      ],
    };
  }
);

server.tool(
  "get_all_statuses",
  "Dashboard view of all agent statuses.",
  {},
  async () => {
    const statuses = await getAllStatuses();
    if (statuses.length === 0) {
      return { content: [{ type: "text" as const, text: "No agent statuses set." }] };
    }
    const lines = statuses.map(
      (s) => `- **${s.agent}**: ${s.status} (updated: ${s.updatedAt})`
    );
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// --- Start Server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
