# BUILD REPORT — lawcorpus

Clean-room rebuild of `com.lawstronaut/lawstronaut-mcp` v1.1.1
(remote-only MCP server at `https://mcp.lawstronaut.com`),
built 2026-10-28 as a forwarding client. Package: `@reneturcios/lawcorpus`
0.1.0, registry name `io.github.CloudCorpRecords/lawcorpus`.

## Surface built

Full surface: **16 of 16 captured tools built**, no omissions.

| Tool | Required fields as served |
|------|---------------------------|
| `list_jurisdictions` | *(none — no `required` key in the capture, served verbatim)* |
| `list_domains` | *(none — no `required` key in the capture, served verbatim)* |
| `list_subdomains` | `domain_id` |
| `list_categories` | *(none — no `required` key in the capture, served verbatim)* |
| `list_subcategories` | `category_id` |
| `list_law_types` | `subcategory_id` |
| `list_portals` | `iso` |
| `list_authority_types` | `iso` |
| `list_issuing_authorities` | `iso` |
| `list_documents` | `iso` |
| `get_document_text` | `iso` |
| `get_markdown` | `iso` |
| `get_source_url` | `document_id` |
| `get_document_with_version` | `document_id`, `version` |
| `horizon_scan` | `iso` |
| `evidence_pull` | `iso`, `document_id` |

Each served tool carries exactly the keys `name`, `description`,
`inputSchema` (the capture carries no `title` key on any tool, and
none was invented), with the `inputSchema.$schema` marker
(`http://json-schema.org/draft-07/schema#`) and
`additionalProperties: false` exactly as captured on every tool.
The tool literals were generated programmatically from
`harness/fixtures/lawstronaut-mcp-tools-original.json` by the
script at `/tmp/laneb5-lawcorpus-scratch/gen.py` (parse +
re-serialise, splice into `src/forward.ts`) — never retyped — and
the generator's own post-generation roundtrip check, the
registration-integrity test suite, and the parity harness each
confirmed the served literals deep-equal the fixture's 16 tool
objects, in order. Tools are registered via the MCP SDK low-level
Server API (`ListToolsRequestSchema` / `CallToolRequestSchema`
handlers), not McpServer+zod.

## Files created (19-file factory set, per TEMPLATE.md)

- `package.json`, `server.json`, `Dockerfile`, `tsconfig.json`,
  `.gitignore`, `package-lock.json`, `README.md`, `LICENSE`,
  `CHANGELOG.md`
- `src/index.ts`, `src/cli.ts`, `src/mcp.ts`, `src/types.ts`,
  `src/forward.ts` (core forwarding client, holds `VERSION`)
- `test/forward.test.ts`
- `.github/workflows/ci.yml`, `.github/workflows/publish.yml`,
  `.github/workflows/publish-container.yml`,
  `.github/workflows/registry-publish.yml`
- Plus this `BUILD-REPORT.md` and the generated `parity-out/`
  (`parity.json`, `parity.md`); `dist/` and `node_modules/` are
  build artifacts (gitignored).

## Fixture conflicts

**None.** The spec's required-field list, the fixture's tool
objects, and the served surface agree tool for tool: names,
descriptions, property shapes and order, the absence of a
`required` key on `list_jurisdictions`, `list_domains` and
`list_categories`, and the absence of any `title` key.

## Labelled reconstructions (from the spec's Wire section)

- Upstream endpoint pinned: `https://mcp.lawstronaut.com`.
- Env override `LAWSTRONAUT_MCP_URL` — labelled reconstruction.
- The registry record declares NO headers on the remote: no auth
  header is ever sent, under any environment. Tests assert that no
  `Authorization` header (and no `X-API-Key` header) is sent with an
  empty environment, with a `LAWSTRONAUT_API_KEY`-style variable
  present, and with `AUTHORIZATION` / `API_KEY` /
  `LAWSTRONAUT_TOKEN` variables present.
- Error rendering `lawcorpus error:` text for upstream failures —
  labelled reconstruction.
- Upstream results pass through verbatim, including `isError` and
  extra fields. tools/call is forwarded as streamable-HTTP JSON-RPC:
  initialize (protocolVersion `2025-03-26`) →
  notifications/initialized → tools/call, honouring `Mcp-Session-Id`
  when issued; plain-JSON and SSE replies are both parsed. The
  forwarding core takes an injectable fetch; tests stub the
  upstream — no live network calls in tests, and no live call is
  claimed beyond the coordinator's tools/list capture.

## Deviations

None.

## Lockfile

- Route: generated clean from birth in the build dir with no
  `node_modules` and no pre-existing lockfile:
  `npm install --package-lock-only --ignore-scripts --offline`
  (Route 3), then populated with `npm ci --ignore-scripts --offline`
  (lockfile not regenerated afterwards).
- Parses as JSON; `name` == `@reneturcios/lawcorpus`.
- Package entries: **128**.
- sha256: `f00f1a5223ed428b18c2c99331b7b6b41212e17c3e7a6a861fc089fe26a5adee`
  (re-verified unchanged after the subsequent offline `npm ci`).

## server.json

- Description exactly: "Browse and read a global legal corpus:
  jurisdictions, authorities, documents and full texts." —
  **92 characters**.
- npm package entry carries `"version": "0.1.0"`; the OCI entry
  (`ghcr.io/cloudcorprecords/lawcorpus:0.1.0`) carries **no**
  `version` field. Both entries carry packageArguments
  `[{type: positional, value: mcp}]` and transport stdio. Dockerfile
  (node:20-alpine, both stages) carries the label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/lawcorpus"`.
  Container workflow `IMAGE` is `ghcr.io/cloudcorprecords/lawcorpus`
  and its smoke test asserts the server name `lawcorpus`.

## Verification (all run 2026-10-28)

1. `npx tsc --noEmit` → exit 0.
2. `npm run build` → exit 0; real `dist/` produced (cli, forward,
   index, mcp, types — .js, .d.ts, .js.map each).
3. `node dist/cli.js --version` → `0.1.0`.
4. `npm test` → **66 tests, 66 pass, 0 fail** (registration-integrity
   suite deep-equals the served tools/list against the fixture's 16
   tools, in order, at both the registry level and through an
   in-memory MCP transport; plus session handling/reuse, env
   override, the no-Authorization-header assertions under every
   environment, verbatim argument forwarding for all 16 tools and
   result pass-through including upstream isError, SSE parsing,
   error rendering, MCP-layer validation, and CLI behaviour).
5. Parity: `python3 /home/hatch/workspace/mcp-rebuild-100/harness/parity.py --original /home/hatch/workspace/mcp-rebuild-100/harness/fixtures/lawstronaut-mcp-tools-original.json --rebuild "stdio:node /home/hatch/workspace/mcp-rebuild-100/builds/lawcorpus/dist/cli.js mcp" --out /home/hatch/workspace/mcp-rebuild-100/builds/lawcorpus/parity-out` → **verdict PASS, parity 100.0**
   (16/16 identical, 0 missing, 0 extra, no schema diffs). Output in
   `parity-out/`.
