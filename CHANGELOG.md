# Changelog

## 0.1.0 (2026-10-28)

- First release: a forwarding client for the hosted Lawstronaut legal corpus MCP server. All 16 captured tools are answered locally for tools/list, and every tools/call is forwarded upstream over a streamable-HTTP JSON-RPC session (initialize, notifications/initialized, tools/call, honouring the Mcp-Session-Id header when the upstream issues one).
- Tools: `list_jurisdictions`, `list_domains`, `list_subdomains`, `list_categories`, `list_subcategories`, `list_law_types`, `list_portals`, `list_authority_types`, `list_issuing_authorities`, `list_documents`, `get_document_text`, `get_markdown`, `get_source_url`, `get_document_with_version`, `horizon_scan`, `evidence_pull` — the full captured surface, with no omissions.
- Upstream results pass through verbatim, including the isError flag; upstream failures surface as `lawcorpus error:` text results.
- One bin serves the CLI (one subcommand per tool, plus `--version`) and the stdio MCP server (`mcp` subcommand). The upstream endpoint can be overridden via `LAWSTRONAUT_MCP_URL`. The registry record declares no headers on the remote, so no auth header is ever sent.
