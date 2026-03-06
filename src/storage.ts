import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export interface AgentInfo {
  name: string;
  workspacePath: string;
  description: string;
  registeredAt: string;
}

export interface MessageMeta {
  id: string;
  from: string;
  to: string;
  subject: string;
  status: "pending" | "read" | "acknowledged" | "completed" | "escalated";
  createdAt: string;
  updatedAt: string;
  replyTo?: string;
  escalationReason?: string;
}

export interface AgentStatus {
  agent: string;
  status: string;
  updatedAt: string;
}

const DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".claude-interagent"
);
const REGISTRY_FILE = path.join(DATA_DIR, "registry.json");
const MESSAGES_DIR = path.join(DATA_DIR, "messages");
const META_DIR = path.join(DATA_DIR, "messages-meta");
const SPECS_DIR = path.join(DATA_DIR, "specs");
const STATUS_FILE = path.join(DATA_DIR, "status.json");

async function ensureDirs(): Promise<void> {
  for (const dir of [DATA_DIR, MESSAGES_DIR, META_DIR, SPECS_DIR]) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Registry

export async function loadRegistry(): Promise<Record<string, AgentInfo>> {
  await ensureDirs();
  if (!existsSync(REGISTRY_FILE)) return {};
  const data = await fs.readFile(REGISTRY_FILE, "utf-8");
  return JSON.parse(data);
}

async function saveRegistry(
  registry: Record<string, AgentInfo>
): Promise<void> {
  await fs.writeFile(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

export async function registerAgent(
  name: string,
  workspacePath: string,
  description: string
): Promise<AgentInfo> {
  const registry = await loadRegistry();
  const agent: AgentInfo = {
    name,
    workspacePath,
    description,
    registeredAt: new Date().toISOString(),
  };
  registry[name] = agent;
  await saveRegistry(registry);
  return agent;
}

export async function getAgent(name: string): Promise<AgentInfo | null> {
  const registry = await loadRegistry();
  return registry[name] || null;
}

export async function listAgents(): Promise<AgentInfo[]> {
  const registry = await loadRegistry();
  return Object.values(registry);
}

// Messages

export async function saveMessage(
  id: string,
  content: string,
  meta: MessageMeta
): Promise<void> {
  await ensureDirs();
  await fs.writeFile(path.join(MESSAGES_DIR, `${id}.md`), content);
  await fs.writeFile(
    path.join(META_DIR, `${id}.json`),
    JSON.stringify(meta, null, 2)
  );
}

export async function getMessage(
  id: string
): Promise<{ content: string; meta: MessageMeta } | null> {
  const metaPath = path.join(META_DIR, `${id}.json`);
  const contentPath = path.join(MESSAGES_DIR, `${id}.md`);
  if (!existsSync(metaPath)) return null;
  const meta: MessageMeta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
  const content = await fs.readFile(contentPath, "utf-8");
  return { content, meta };
}

export async function updateMessageMeta(
  id: string,
  updates: Partial<MessageMeta>
): Promise<MessageMeta | null> {
  const metaPath = path.join(META_DIR, `${id}.json`);
  if (!existsSync(metaPath)) return null;
  const meta: MessageMeta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
  const updated = { ...meta, ...updates, updatedAt: new Date().toISOString() };
  await fs.writeFile(metaPath, JSON.stringify(updated, null, 2));
  return updated;
}

export async function getMessagesForAgent(
  agentName: string
): Promise<MessageMeta[]> {
  await ensureDirs();
  const files = await fs.readdir(META_DIR);
  const messages: MessageMeta[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const meta: MessageMeta = JSON.parse(
      await fs.readFile(path.join(META_DIR, file), "utf-8")
    );
    if (meta.to === agentName) {
      messages.push(meta);
    }
  }
  return messages;
}

// Signal files

export async function dropSignalFile(
  targetWorkspace: string,
  fromAgent: string,
  summary: string
): Promise<string> {
  const inboxDir = path.join(targetWorkspace, ".claude", "inbox");
  await fs.mkdir(inboxDir, { recursive: true });
  const timestamp = Date.now();
  const filename = `${fromAgent}-${timestamp}.signal`;
  const filepath = path.join(inboxDir, filename);
  await fs.writeFile(
    filepath,
    `Message from ${fromAgent}: ${summary}. Run check_inbox to read.`
  );
  return filepath;
}

// Specs

export async function publishSpec(
  name: string,
  content: string
): Promise<void> {
  await ensureDirs();
  await fs.writeFile(path.join(SPECS_DIR, `${name}.md`), content);
}

export async function getSpec(name: string): Promise<string | null> {
  const specPath = path.join(SPECS_DIR, `${name}.md`);
  if (!existsSync(specPath)) return null;
  return fs.readFile(specPath, "utf-8");
}

export async function listSpecs(): Promise<string[]> {
  await ensureDirs();
  const files = await fs.readdir(SPECS_DIR);
  return files.filter((f) => f.endsWith(".md")).map((f) => f.replace(".md", ""));
}

// Status

async function loadStatuses(): Promise<Record<string, AgentStatus>> {
  await ensureDirs();
  if (!existsSync(STATUS_FILE)) return {};
  const data = await fs.readFile(STATUS_FILE, "utf-8");
  return JSON.parse(data);
}

async function saveStatuses(
  statuses: Record<string, AgentStatus>
): Promise<void> {
  await fs.writeFile(STATUS_FILE, JSON.stringify(statuses, null, 2));
}

export async function setStatus(
  agent: string,
  status: string
): Promise<AgentStatus> {
  const statuses = await loadStatuses();
  const entry: AgentStatus = {
    agent,
    status,
    updatedAt: new Date().toISOString(),
  };
  statuses[agent] = entry;
  await saveStatuses(statuses);
  return entry;
}

export async function getStatus(agent: string): Promise<AgentStatus | null> {
  const statuses = await loadStatuses();
  return statuses[agent] || null;
}

export async function getAllStatuses(): Promise<AgentStatus[]> {
  const statuses = await loadStatuses();
  return Object.values(statuses);
}
