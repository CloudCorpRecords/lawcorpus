import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import {
  LawcorpusClient,
  callTool,
  createClient,
  DEFAULT_ENDPOINT_URL,
  isKnownTool,
  parseRpcBody,
  PROTOCOL_VERSION,
  TOOL_DEFS,
  TOOL_NAMES,
  VERSION,
} from "../src/forward.js";
import { createServer, handleCallTool } from "../src/mcp.js";
import type {
  FetchFn,
  FetchResponseLike,
  ToolDef,
  ToolResult,
} from "../src/types.js";

/**
 * Every test runs against a stubbed JSON-RPC upstream that
 * implements the streamable-HTTP session flow
 * (initialize -> notifications/initialized -> tools/call):
 * no live network, and the real Lawstronaut endpoint is
 * never contacted.
 */

const FIXTURE_URL = new URL(
  "../../../harness/fixtures/lawstronaut-mcp-tools-original.json",
  import.meta.url,
);
const FIXTURE_AVAILABLE = existsSync(FIXTURE_URL);
const fixture = (
  FIXTURE_AVAILABLE
    ? JSON.parse(readFileSync(FIXTURE_URL, "utf-8"))
    : { tools: [] }
) as {
  tools: ToolDef[];
};
/**
 * Publish-survival guard (Wave 29 P1 preflight, proven Wave 24 pattern):
 * the parity fixture lives in the build harness, outside the published
 * repo tree, so fixture-dependent tests skip cleanly when it is absent;
 * with the fixture present they run in full, with no skips.
 */
function skipWithoutFixture(t: {
  skip: (message: string) => void;
}): boolean {
  if (FIXTURE_AVAILABLE) return false;
  t.skip("parity fixture lives in the build harness, not the repo tree");
  return true;
}


const JURISDICTIONS = "list_jurisdictions";
const DOMAINS = "list_domains";
const SUBDOMAINS = "list_subdomains";
const CATEGORIES = "list_categories";
const SUBCATEGORIES = "list_subcategories";
const LAW_TYPES = "list_law_types";
const PORTALS = "list_portals";
const AUTH_TYPES = "list_authority_types";
const ISSUING = "list_issuing_authorities";
const DOCUMENTS = "list_documents";
const DOC_TEXT = "get_document_text";
const MARKDOWN = "get_markdown";
const SOURCE_URL = "get_source_url";
const DOC_VERSION = "get_document_with_version";
const HORIZON = "horizon_scan";
const EVIDENCE = "evidence_pull";
const ALL_TOOLS = [
  JURISDICTIONS,
  DOMAINS,
  SUBDOMAINS,
  CATEGORIES,
  SUBCATEGORIES,
  LAW_TYPES,
  PORTALS,
  AUTH_TYPES,
  ISSUING,
  DOCUMENTS,
  DOC_TEXT,
  MARKDOWN,
  SOURCE_URL,
  DOC_VERSION,
  HORIZON,
  EVIDENCE,
];

const SAMPLE_RESULT = {
  content: [
    { type: "text", text: "{\"data\":[{\"name\":\"Belgium\",\"iso\":\"BE\"}]}" },
  ],
  structuredContent: { data: [{ name: "Belgium", iso: "BE" }] },
};

const SAMPLE_ARGS = { iso: "US", limit: 5, offset: 0 };

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

interface FakeOptions {
  callResult?: Record<string, unknown>;
  callBodyText?: string;
  callError?: Record<string, unknown>;
  callStatus?: number;
  initError?: Record<string, unknown>;
  throwOn?: "initialize" | "tools/call";
  sessionId?: string | null;
  hangOnCall?: boolean;
  sse?: boolean;
}

function makeResponse(
  status: number,
  bodyText: string,
  headers: Record<string, string> = {},
): FetchResponseLike {
  const lowered = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => lowered.get(name.toLowerCase()) ?? null },
    text: async () => bodyText,
  };
}

function jsonResponse(
  status: number,
  payload: unknown,
  headers: Record<string, string> = {},
) {
  return makeResponse(status, JSON.stringify(payload), headers);
}

function makeUpstream(options: FakeOptions = {}): {
  fetchFn: FetchFn;
  calls: Captured[];
} {
  const calls: Captured[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    const body = JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
    calls.push({ url, headers: init?.headers ?? {}, body });
    const method = body.method as string;
    if (options.throwOn === method) throw new Error("socket hang up");
    if (method === "initialize") {
      if (options.initError !== undefined) {
        return jsonResponse(200, {
          jsonrpc: "2.0",
          id: body.id,
          error: options.initError,
        });
      }
      const headers: Record<string, string> = {};
      const sessionId =
        options.sessionId === undefined ? "sess-abc" : options.sessionId;
      if (sessionId !== null) headers["mcp-session-id"] = sessionId;
      return jsonResponse(
        200,
        {
          jsonrpc: "2.0",
          id: body.id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {},
            serverInfo: { name: "lawstronaut", version: "1.1.1" },
          },
        },
        headers,
      );
    }
    if (method === "notifications/initialized") {
      return makeResponse(202, "");
    }
    if (method === "tools/call") {
      if (options.hangOnCall) {
        return new Promise<FetchResponseLike>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            if (signal.aborted) {
              reject(new Error("aborted"));
              return;
            }
            signal.addEventListener("abort", () => reject(new Error("aborted")));
          }
        });
      }
      if (options.callBodyText !== undefined) {
        return makeResponse(options.callStatus ?? 200, options.callBodyText);
      }
      if (options.callError !== undefined) {
        return jsonResponse(200, {
          jsonrpc: "2.0",
          id: body.id,
          error: options.callError,
        });
      }
      const result = options.callResult ?? SAMPLE_RESULT;
      const payload = { jsonrpc: "2.0", id: body.id, result };
      if (options.sse) {
        return makeResponse(
          200,
          `event: message\ndata: ${JSON.stringify(payload)}\n\n`,
        );
      }
      return jsonResponse(options.callStatus ?? 200, payload);
    }
    return jsonResponse(200, {});
  };
  return { fetchFn, calls };
}

function stubClient(options: FakeOptions = {}, extra: Record<string, unknown> = {}) {
  const upstream = makeUpstream(options);
  const c = new LawcorpusClient({
    fetchFn: upstream.fetchFn,
    env: {},
    ...extra,
  });
  return { client: c, calls: upstream.calls };
}

function textOf(result: ToolResult): string {
  const content = result.content as Array<{ type: string; text: string }>;
  return content[0].text;
}

function methods(calls: Captured[]): string[] {
  return calls.map((c) => c.body.method as string);
}

function schemaOf(tool: ToolDef): Record<string, any> {
  return tool.inputSchema as Record<string, any>;
}

function defOf(name: string): ToolDef {
  const def = TOOL_DEFS.find((t) => t.name === name);
  assert.ok(def !== undefined, `missing tool def ${name}`);
  return def;
}

/* CLI helpers. */

const CLI_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI_PATH = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

function runCli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", CLI_PATH, ...args], {
    cwd: CLI_ROOT,
    encoding: "utf8",
    timeout: 30000,
  });
}

/* MCP client over an in-memory transport, for tools/list and
 * tools/call assertions at the MCP layer itself. */
async function withMcpClient<T>(
  upstream: { fetchFn: FetchFn },
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const server = createServer({ fetchFn: upstream.fetchFn, env: {} });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "lawcorpus-test", version: "0.0.0" },
    { capabilities: {} },
  );
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    return await fn(client);
  } finally {
    await client.close();
    await server.close();
  }
}

/* ------------------------------------------------------------------ */

describe("registration integrity (captured surface)", () => {
  it("serves exactly the fixture's 16 tools, deep-equal, in order", (t) => {
    if (skipWithoutFixture(t)) return;
    assert.equal(fixture.tools.length, 16);
    assert.deepEqual(TOOL_DEFS, fixture.tools);
  });

  it("serves the 16 tool names in fixture order", () => {
    assert.deepEqual(TOOL_NAMES, ALL_TOOLS);
  });

  it("carries exactly the fixture's keys on every tool (no title key)", () => {
    for (const tool of TOOL_DEFS) {
      assert.deepEqual(Object.keys(tool).sort(), [
        "description",
        "inputSchema",
        "name",
      ]);
      assert.equal("title" in tool, false);
    }
  });

  it("carries the fixture's descriptions verbatim", (t) => {
    if (skipWithoutFixture(t)) return;
    for (let i = 0; i < TOOL_DEFS.length; i++) {
      assert.equal(TOOL_DEFS[i].description, fixture.tools[i].description);
    }
    assert.match(defOf(JURISDICTIONS).description, /Call this FIRST/);
    assert.match(defOf(SOURCE_URL).description, /signed URL/);
    assert.match(defOf(EVIDENCE).description, /citation chain/);
  });

  it("carries the captured required lists exactly, per tool", () => {
    const expected: Record<string, string[] | undefined> = {
      [JURISDICTIONS]: undefined,
      [DOMAINS]: undefined,
      [SUBDOMAINS]: ["domain_id"],
      [CATEGORIES]: undefined,
      [SUBCATEGORIES]: ["category_id"],
      [LAW_TYPES]: ["subcategory_id"],
      [PORTALS]: ["iso"],
      [AUTH_TYPES]: ["iso"],
      [ISSUING]: ["iso"],
      [DOCUMENTS]: ["iso"],
      [DOC_TEXT]: ["iso"],
      [MARKDOWN]: ["iso"],
      [SOURCE_URL]: ["document_id"],
      [DOC_VERSION]: ["document_id", "version"],
      [HORIZON]: ["iso"],
      [EVIDENCE]: ["iso", "document_id"],
    };
    for (const tool of TOOL_DEFS) {
      assert.deepEqual(schemaOf(tool).required, expected[tool.name], tool.name);
      if (expected[tool.name] === undefined) {
        assert.equal("required" in schemaOf(tool), false, tool.name);
      }
    }
  });

  it("carries the $schema marker, object type and additionalProperties false on every inputSchema", () => {
    for (const tool of TOOL_DEFS) {
      assert.equal(schemaOf(tool).type, "object", tool.name);
      assert.equal(
        schemaOf(tool)["$schema"],
        "http://json-schema.org/draft-07/schema#",
        tool.name,
      );
      assert.equal(schemaOf(tool).additionalProperties, false, tool.name);
    }
  });

  it("carries every fixture property, in order, for every tool", (t) => {
    if (skipWithoutFixture(t)) return;
    for (let i = 0; i < TOOL_DEFS.length; i++) {
      const served = Object.keys(schemaOf(TOOL_DEFS[i]).properties);
      const expected = Object.keys(schemaOf(fixture.tools[i]).properties);
      assert.deepEqual(served, expected, TOOL_DEFS[i].name);
    }
  });

  it("list_jurisdictions takes no properties", () => {
    assert.deepEqual(Object.keys(schemaOf(defOf(JURISDICTIONS)).properties), []);
  });

  it("list_documents carries the full structured filter set in fixture order", () => {
    const names = Object.keys(schemaOf(defOf(DOCUMENTS)).properties);
    assert.equal(names.length, 26);
    assert.deepEqual(names.slice(0, 5), [
      "iso",
      "portal",
      "version",
      "limit",
      "offset",
    ]);
    assert.equal(names[names.length - 1], "lang");
    for (const shared of [DOCUMENTS, DOC_TEXT, MARKDOWN]) {
      assert.deepEqual(
        Object.keys(schemaOf(defOf(shared)).properties),
        names,
        shared,
      );
    }
  });

  it("get_source_url and get_document_with_version key off integer ids", () => {
    const src = schemaOf(defOf(SOURCE_URL)).properties;
    assert.equal(src.document_id.type, "integer");
    assert.equal(src.document_id.exclusiveMinimum, 0);
    const ver = schemaOf(defOf(DOC_VERSION)).properties;
    assert.equal(ver.document_id.type, "integer");
    assert.equal(ver.version.type, "integer");
    assert.equal(ver.version.exclusiveMinimum, 0);
  });

  it("horizon_scan carries the captured defaults and enums", () => {
    const props = schemaOf(defOf(HORIZON)).properties;
    assert.equal(props.since.default, "yesterday");
    assert.equal(props.date_field.default, "crawling_date");
    assert.deepEqual(props.date_field.enum, [
      "crawling_date",
      "publication_date",
      "last_updated",
    ]);
    assert.equal(props.include_repealed.default, false);
    assert.deepEqual(
      [props.max_per_jurisdiction.minimum, props.max_per_jurisdiction.maximum, props.max_per_jurisdiction.default],
      [1, 100, 50],
    );
    assert.deepEqual(props.topic.type, ["string", "null"]);
  });

  it("evidence_pull carries the captured format enum and include defaults", () => {
    const props = schemaOf(defOf(EVIDENCE)).properties;
    assert.equal(props.include_text.default, true);
    assert.equal(props.include_source_url.default, true);
    assert.equal(props.text_format.default, "markdown");
    assert.deepEqual(props.text_format.enum, ["markdown", "plain"]);
    assert.equal(props.document_id.type, "integer");
  });

  it("isKnownTool recognises all 16 built tools and rejects others", () => {
    for (const name of ALL_TOOLS) assert.equal(isKnownTool(name), true);
    assert.equal(isKnownTool("list_laws"), false);
    assert.equal(isKnownTool("search"), false);
    assert.equal(isKnownTool(""), false);
  });

  it("the MCP tools/list response carries exactly the fixture's 16 tools", async (t) => {
    if (skipWithoutFixture(t)) return;
    const upstream = makeUpstream();
    const listed = await withMcpClient(upstream, async (client) => {
      const res = await client.listTools();
      return res.tools;
    });
    assert.deepEqual(
      listed.map((t) => t.name),
      ALL_TOOLS,
    );
    assert.deepEqual(listed, fixture.tools);
    assert.equal(upstream.calls.length, 0);
  });
});

/* ------------------------------------------------------------------ */

describe("session establishment and reuse", () => {
  it("runs initialize, notifications/initialized, then tools/call in order", async () => {
    const { client: c, calls } = stubClient();
    const out = await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.equal(out.isError, undefined);
    assert.deepEqual(methods(calls), [
      "initialize",
      "notifications/initialized",
      "tools/call",
    ]);
    assert.ok(calls.every((call) => call.url === DEFAULT_ENDPOINT_URL));
    assert.equal(DEFAULT_ENDPOINT_URL, "https://mcp.lawstronaut.com");
    for (const call of calls) {
      assert.equal(call.headers["Content-Type"], "application/json");
      assert.equal(call.headers["Accept"], "application/json, text/event-stream");
    }
    assert.equal(calls[0].headers["Mcp-Session-Id"], undefined);
    assert.equal(calls[1].headers["Mcp-Session-Id"], "sess-abc");
    assert.equal(calls[2].headers["Mcp-Session-Id"], "sess-abc");
  });

  it("sends clientInfo name lawcorpus and the pinned protocol version on initialize", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    const initParams = calls[0].body.params as Record<string, unknown>;
    assert.equal(initParams.protocolVersion, PROTOCOL_VERSION);
    assert.equal(PROTOCOL_VERSION, "2025-03-26");
    assert.deepEqual(initParams.capabilities, {});
    assert.deepEqual(initParams.clientInfo, { name: "lawcorpus", version: VERSION });
  });

  it("establishes the session lazily once and reuses it on later calls", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    await c.callTool(JURISDICTIONS, {});
    assert.deepEqual(methods(calls), [
      "initialize",
      "notifications/initialized",
      "tools/call",
      "tools/call",
    ]);
    assert.equal(calls[3].headers["Mcp-Session-Id"], "sess-abc");
    assert.notEqual(calls[2].body.id, calls[3].body.id);
  });

  it("sends no session header when the upstream issues none", async () => {
    const { client: c, calls } = stubClient({ sessionId: null });
    const out = await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.equal(out.isError, undefined);
    assert.ok(calls.every((call) => call.headers["Mcp-Session-Id"] === undefined));
  });

  it("honours the LAWSTRONAUT_MCP_URL env override", async () => {
    const upstream = makeUpstream();
    const c = new LawcorpusClient({
      fetchFn: upstream.fetchFn,
      env: { LAWSTRONAUT_MCP_URL: "https://staging.example.com/mcp" },
    });
    await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.ok(
      upstream.calls.every((call) => call.url === "https://staging.example.com/mcp"),
    );
  });

  it("honours an explicit url override over the default endpoint", async () => {
    const upstream = makeUpstream();
    const c = createClient({
      fetchFn: upstream.fetchFn,
      env: {},
      url: "https://alt.example.com/mcp",
    });
    await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.ok(upstream.calls.every((call) => call.url === "https://alt.example.com/mcp"));
  });

  it("prefers an explicit url override over the env override", async () => {
    const upstream = makeUpstream();
    const c = createClient({
      fetchFn: upstream.fetchFn,
      env: { LAWSTRONAUT_MCP_URL: "https://env.example.com/mcp" },
      url: "https://explicit.example.com/mcp",
    });
    await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.ok(
      upstream.calls.every((call) => call.url === "https://explicit.example.com/mcp"),
    );
  });

  it("falls back to the pinned endpoint when the env override is blank", async () => {
    const upstream = makeUpstream();
    const c = new LawcorpusClient({
      fetchFn: upstream.fetchFn,
      env: { LAWSTRONAUT_MCP_URL: "   " },
    });
    await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.ok(upstream.calls.every((call) => call.url === DEFAULT_ENDPOINT_URL));
  });
});

/* ------------------------------------------------------------------ */

describe("no auth header is ever sent (record declares NO headers)", () => {
  it("sends no Authorization header when the environment is empty", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.equal(calls.length, 3);
    assert.ok(calls.every((call) => call.headers["Authorization"] === undefined));
  });

  it("sends no Authorization header even when a LAWSTRONAUT_API_KEY-style env var is present", async () => {
    const upstream = makeUpstream();
    const c = new LawcorpusClient({
      fetchFn: upstream.fetchFn,
      env: { LAWSTRONAUT_API_KEY: "some-key-42" },
    });
    await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.ok(
      upstream.calls.every((call) => call.headers["Authorization"] === undefined),
    );
  });

  it("sends no Authorization header even when AUTHORIZATION / API_KEY env vars are present", async () => {
    const upstream = makeUpstream();
    const c = new LawcorpusClient({
      fetchFn: upstream.fetchFn,
      env: {
        AUTHORIZATION: "Bearer x",
        API_KEY: "y",
        LAWSTRONAUT_TOKEN: "z",
      },
    });
    await c.callTool(JURISDICTIONS, {});
    assert.ok(
      upstream.calls.every((call) => call.headers["Authorization"] === undefined),
    );
  });

  it("never sends an X-API-Key header either", async () => {
    const upstream = makeUpstream();
    const c = new LawcorpusClient({
      fetchFn: upstream.fetchFn,
      env: { LAWSTRONAUT_API_KEY: "some-key-42" },
    });
    await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.ok(upstream.calls.every((call) => call.headers["X-API-Key"] === undefined));
  });

  it("sends only Content-Type, Accept and (when issued) Mcp-Session-Id headers", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.deepEqual(Object.keys(calls[0].headers).sort(), [
      "Accept",
      "Content-Type",
    ]);
    assert.deepEqual(Object.keys(calls[2].headers).sort(), [
      "Accept",
      "Content-Type",
      "Mcp-Session-Id",
    ]);
  });
});

/* ------------------------------------------------------------------ */

describe("tools/call forwarding", () => {
  it("forwards a list_documents call verbatim with every input", async () => {
    const { client: c, calls } = stubClient();
    await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    const params = calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, DOCUMENTS);
    assert.deepEqual(params.arguments, SAMPLE_ARGS);
  });

  it("forwards list_jurisdictions under its own name with empty arguments", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await c.callTool(JURISDICTIONS, {});
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, JURISDICTIONS);
    assert.deepEqual(params.arguments, {});
  });

  it("forwards get_source_url under its own name with the numeric id", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await c.callTool(SOURCE_URL, { document_id: 123 });
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, SOURCE_URL);
    assert.deepEqual(params.arguments, { document_id: 123 });
  });

  it("forwards get_document_with_version under its own name", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await c.callTool(DOC_VERSION, { document_id: 123, version: 2 });
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, DOC_VERSION);
    assert.deepEqual(params.arguments, { document_id: 123, version: 2 });
  });

  it("forwards horizon_scan under its own name", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await c.callTool(HORIZON, { iso: "IE", since: "7d" });
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, HORIZON);
    assert.deepEqual(params.arguments, { iso: "IE", since: "7d" });
  });

  it("forwards evidence_pull under its own name", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await c.callTool(EVIDENCE, { iso: "US", document_id: 42 });
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, EVIDENCE);
    assert.deepEqual(params.arguments, { iso: "US", document_id: 42 });
  });

  it("forwards every one of the 16 tools under its own name", async () => {
    for (const name of ALL_TOOLS) {
      const upstream = makeUpstream();
      const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
      const out = await c.callTool(name, {});
      assert.equal(out.isError, undefined, name);
      const params = upstream.calls[2].body.params as Record<string, unknown>;
      assert.equal(params.name, name);
    }
  });

  it("passes the upstream result through verbatim, including extra fields", async () => {
    const { client: c } = stubClient();
    const out = await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.deepEqual(out, SAMPLE_RESULT);
  });

  it("passes an upstream isError result through untouched", async () => {
    const upstreamResult = {
      content: [{ type: "text", text: "unknown iso upstream" }],
      isError: true,
    };
    const { client: c } = stubClient({ callResult: upstreamResult });
    const out = await c.callTool(DOCUMENTS, { iso: "XX" });
    assert.deepEqual(out, upstreamResult);
  });

  it("reads an SSE-framed tools/call response", async () => {
    const { client: c } = stubClient({ sse: true });
    const out = await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.equal(out.isError, undefined);
    assert.deepEqual(out, SAMPLE_RESULT);
  });

  it("the one-shot callTool helper forwards under the right tool name", async () => {
    const upstream = makeUpstream();
    const out = await callTool(
      MARKDOWN,
      { iso: "NL" },
      { fetchFn: upstream.fetchFn, env: {} },
    );
    assert.equal(out.isError, undefined);
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, MARKDOWN);
    assert.deepEqual(params.arguments, { iso: "NL" });
  });
});

/* ------------------------------------------------------------------ */

describe("upstream failures surface as lawcorpus error text", () => {
  it("maps a JSON-RPC error to `lawcorpus error: <message>`", async () => {
    const { client: c } = stubClient({
      callError: { code: -32000, message: "lookup failed upstream" },
    });
    const out = await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "lawcorpus error: lookup failed upstream");
  });

  it("maps an initialize JSON-RPC error to lawcorpus error text", async () => {
    const { client: c } = stubClient({
      initError: { code: -32600, message: "bad initialize" },
    });
    const out = await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "lawcorpus error: bad initialize");
  });

  it("maps an unparseable upstream response to a malformed-response error", async () => {
    const { client: c } = stubClient({ callBodyText: "<html>oops</html>" });
    const out = await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "lawcorpus error: malformed response");
  });

  it("maps a response with no result object to a malformed-response error", async () => {
    const { client: c } = stubClient({
      callBodyText: '{"jsonrpc":"2.0","id":3,"result":null}',
    });
    const out = await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "lawcorpus error: malformed response");
  });

  it("maps a non-2xx upstream status to lawcorpus error text", async () => {
    const { client: c } = stubClient({ callBodyText: "internal error", callStatus: 500 });
    const out = await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "lawcorpus error: HTTP 500");
  });

  it("maps a throwing fetch to lawcorpus error text", async () => {
    const { client: c } = stubClient({ throwOn: "tools/call" });
    const out = await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.equal(out.isError, true);
    assert.match(textOf(out), /^lawcorpus error: /);
  });

  it("maps a throwing initialize fetch to lawcorpus error text", async () => {
    const { client: c } = stubClient({ throwOn: "initialize" });
    const out = await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.equal(out.isError, true);
    assert.equal(textOf(out), "lawcorpus error: socket hang up");
  });

  it("maps a timed-out call to lawcorpus error text", async () => {
    const { client: c } = stubClient({ hangOnCall: true }, { timeoutMs: 20 });
    const out = await c.callTool(DOCUMENTS, SAMPLE_ARGS);
    assert.equal(out.isError, true);
    assert.match(textOf(out), /^lawcorpus error: /);
  });
});

/* ------------------------------------------------------------------ */

describe("parseRpcBody", () => {
  it("parses plain JSON and picks the message with the matching id", () => {
    const body = '{"jsonrpc":"2.0","id":7,"result":{"ok":true}}';
    assert.deepEqual(parseRpcBody(body, 7), {
      jsonrpc: "2.0",
      id: 7,
      result: { ok: true },
    });
  });

  it("parses SSE data lines", () => {
    const body =
      'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"ok":true}}\n\n';
    assert.deepEqual(parseRpcBody(body, 2), {
      jsonrpc: "2.0",
      id: 2,
      result: { ok: true },
    });
  });

  it("picks the matching id among several SSE messages", () => {
    const body =
      'data: {"jsonrpc":"2.0","id":1,"result":{"n":1}}\n\n' +
      'data: {"jsonrpc":"2.0","id":2,"result":{"n":2}}\n\n';
    assert.deepEqual(parseRpcBody(body, 2), {
      jsonrpc: "2.0",
      id: 2,
      result: { n: 2 },
    });
  });

  it("ignores the SSE [DONE] sentinel", () => {
    const body =
      'data: {"jsonrpc":"2.0","id":4,"result":{"ok":true}}\ndata: [DONE]\n';
    assert.deepEqual(parseRpcBody(body, 4), {
      jsonrpc: "2.0",
      id: 4,
      result: { ok: true },
    });
  });

  it("returns null for empty and unparseable bodies", () => {
    assert.equal(parseRpcBody(""), null);
    assert.equal(parseRpcBody("not json at all"), null);
    assert.equal(parseRpcBody("[1,2,3]"), null);
  });
});

/* ------------------------------------------------------------------ */

describe("MCP layer validation", () => {
  it("rejects an unknown tool with MethodNotFound before any network hop", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await assert.rejects(
      () => handleCallTool(c, "not_a_tool", {}),
      (err: unknown) =>
        err instanceof McpError && err.code === ErrorCode.MethodNotFound,
    );
    assert.equal(upstream.calls.length, 0);
  });

  it("rejects array arguments with InvalidParams before any network hop", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await assert.rejects(
      () => handleCallTool(c, DOCUMENTS, ["nope"]),
      (err: unknown) =>
        err instanceof McpError && err.code === ErrorCode.InvalidParams,
    );
    assert.equal(upstream.calls.length, 0);
  });

  it("rejects string arguments with InvalidParams before any network hop", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    await assert.rejects(
      () => handleCallTool(c, DOCUMENTS, "iso=US"),
      (err: unknown) =>
        err instanceof McpError && err.code === ErrorCode.InvalidParams,
    );
    assert.equal(upstream.calls.length, 0);
  });

  it("forwards a valid list_documents call through the MCP layer unchanged", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    const out = await handleCallTool(c, DOCUMENTS, SAMPLE_ARGS);
    assert.deepEqual(out, SAMPLE_RESULT);
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.deepEqual(params.arguments, SAMPLE_ARGS);
  });

  it("forwards a valid evidence_pull call through the MCP layer unchanged", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    const out = await handleCallTool(c, EVIDENCE, { iso: "US", document_id: 42 });
    assert.deepEqual(out, SAMPLE_RESULT);
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, EVIDENCE);
    assert.deepEqual(params.arguments, { iso: "US", document_id: 42 });
  });

  it("treats omitted arguments as an empty object", async () => {
    const upstream = makeUpstream();
    const c = createClient({ fetchFn: upstream.fetchFn, env: {} });
    const out = await handleCallTool(c, JURISDICTIONS, undefined);
    assert.deepEqual(out, SAMPLE_RESULT);
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.deepEqual(params.arguments, {});
  });

  it("an MCP tools/call for a known tool reaches the upstream and returns verbatim", async () => {
    const upstream = makeUpstream();
    const res = await withMcpClient(upstream, async (client) =>
      client.callTool({ name: PORTALS, arguments: { iso: "BE" } }),
    );
    assert.deepEqual(res, SAMPLE_RESULT);
    const params = upstream.calls[2].body.params as Record<string, unknown>;
    assert.equal(params.name, PORTALS);
  });
});

/* ------------------------------------------------------------------ */

describe("CLI", () => {
  it("--version prints 0.1.0 and exits 0", () => {
    const res = runCli(["--version"]);
    assert.equal(res.status, 0);
    assert.equal(res.stdout.trim(), "0.1.0");
    assert.equal(res.stdout.trim(), VERSION);
  });

  it("-v prints 0.1.0 and exits 0", () => {
    const res = runCli(["-v"]);
    assert.equal(res.status, 0);
    assert.equal(res.stdout.trim(), "0.1.0");
  });

  it("an unknown command prints usage on stderr and exits 2", () => {
    const res = runCli(["not-a-tool"]);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /Usage:/);
    assert.match(
      res.stderr,
      /list_jurisdictions, list_domains, list_subdomains/,
    );
    assert.match(res.stderr, /evidence_pull/);
  });

  it("no command at all prints usage on stderr and exits 2", () => {
    const res = runCli([]);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /Usage:/);
  });

  it("a non-JSON argument exits 2", () => {
    const res = runCli([DOCUMENTS, "not json"]);
    assert.equal(res.status, 2);
  });

  it("a JSON array argument exits 2", () => {
    const res = runCli([DOCUMENTS, "[]"]);
    assert.equal(res.status, 2);
  });

  it("extra arguments after a tool exit 2", () => {
    const res = runCli([DOCUMENTS, "{}", "extra"]);
    assert.equal(res.status, 2);
  });

  it("extra arguments after mcp exit 2", () => {
    const res = runCli(["mcp", "extra"]);
    assert.equal(res.status, 2);
  });
});
