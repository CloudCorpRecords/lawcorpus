# lawcorpus

Read a published global legal corpus without reimplementing someone else's crawl. lawcorpus is a small forwarding client for the hosted Lawstronaut MCP service: the tool list is served from your own machine using the captured definitions, and each call is sent upstream, with the service's answer returned exactly as it arrived.

All sixteen of the service's captured tools are exposed, with no omissions. Start from the jurisdiction list to learn which `iso` codes are valid, walk the domain, category and law-type taxonomies, find the legal portals and issuing authorities behind a jurisdiction, list documents with structured filters, and read full document texts, markdown renderings, specific versions, and one-call citation chains. A recent-changes scan covers what moved in a jurisdiction over a chosen freshness window. Every tool is a read over published legal data; nothing is submitted anywhere.

## The tools

- **`list_jurisdictions`** — Every jurisdiction (country or state) in the corpus, with name, `iso` code and type. Call this first: the other tools key off these `iso` codes. No arguments.
- **`list_domains`** — Legal domains, optionally filtered by name (`domain`), with `limit` / `offset` pagination. No required arguments.
- **`list_subdomains`** — Subdomains of one domain. Requires `domain_id`; optional `subdomain` name filter and pagination.
- **`list_categories`** — Legal categories, optionally narrowed by `subdomain_id` or `category_name`, with pagination. No required arguments.
- **`list_subcategories`** — Subcategories of one category. Requires `category_id`; optional `subcategory_name` filter and pagination.
- **`list_law_types`** — Law types under one subcategory. Requires `subcategory_id`; optional `law_type` filter and pagination.
- **`list_portals`** — Legal portals for a jurisdiction. Requires `iso`; optional `name`, `tag` and `lang` filters.
- **`list_authority_types`** — Authority types for a jurisdiction. Requires `iso`; optional `portal_name` and `authority_type` filters and pagination.
- **`list_issuing_authorities`** — Issuing authorities for a jurisdiction. Requires `iso`; optional `portal_name` and `issuing_authority` filters and pagination.
- **`list_documents`** — Documents in a jurisdiction with structured filters and pagination. Requires `iso`; optional filters include `portal`, `title`, `section_title`, `url`, `status`, `repealed`, date fields, `issuing_authority`, `type_of_authority`, source identifiers, `tag` and `lang`.
- **`get_document_text`** — Full text for documents matching the same filter family as `list_documents`. Requires `iso`.
- **`get_markdown`** — Markdown renderings for documents matching the same filter family. Requires `iso`.
- **`get_source_url`** — A time-limited signed URL to a document's original source file (PDF etc.), as issued upstream. Requires the numeric `document_id`.
- **`get_document_with_version`** — One specific version of one document. Requires the numeric `document_id` and `version`.
- **`horizon_scan`** — Recent legal documents for a jurisdiction. Requires `iso`; optional `since` freshness window (default `yesterday`), `topic`, `date_field`, `status`, authority filters, `include_repealed` and `max_per_jurisdiction`.
- **`evidence_pull`** — The full citation chain for one document in a single call: metadata with all dates and identifiers, the permanent legal link, a signed URL to the original source file where available, and the full document body. Requires `iso` and the numeric `document_id`; `include_text`, `include_source_url` and `text_format` (`markdown` or `plain`) are optional.

## Install and run

As an MCP server via npm:

```bash
npx -y @reneturcios/lawcorpus mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "lawcorpus": {
      "command": "npx",
      "args": ["-y", "@reneturcios/lawcorpus", "mcp"]
    }
  }
}
```

As a container:

```bash
docker run -i ghcr.io/cloudcorprecords/lawcorpus
docker run --rm ghcr.io/cloudcorprecords/lawcorpus list_jurisdictions '{}'
```

## CLI

A single binary covers both the command line and the MCP server. Every tool is a subcommand whose one argument is a JSON string of that tool's inputs:

```bash
lawcorpus list_jurisdictions '{}'
lawcorpus list_documents '{"iso":"US","limit":5}'
lawcorpus get_document_text '{"iso":"NL","document_id":"123"}'
lawcorpus horizon_scan '{"iso":"IE","since":"7d"}'
lawcorpus evidence_pull '{"iso":"US","document_id":123}'
lawcorpus --version
```

Exit codes: `0` for a successful forwarded call, `1` when the result that comes back is an error, and `2` for usage mistakes like an unknown subcommand or a JSON argument that does not parse.

## Configuration

- `LAWSTRONAUT_MCP_URL` — Replaces the upstream endpoint. Defaults to the pinned hosted endpoint, `https://mcp.lawstronaut.com`. (This override variable is a reconstruction introduced by this rebuild.)

The Lawstronaut registry record lists no headers for its remote, so lawcorpus never attaches an authentication header — every call goes upstream keyless.

When the upstream cannot answer — it returns a JSON-RPC error, answers with a non-2xx status, sends a body that cannot be read, or the request itself fails — the caller receives an error result whose text begins with `lawcorpus error:`.

## How forwarding works

The first call of a process opens a session against the upstream: an `initialize` request (protocol version `2025-03-26`), a `notifications/initialized` notification, and then the `tools/call`. If the service issues an `Mcp-Session-Id` header during initialize, lawcorpus repeats it on subsequent requests and keeps reusing that one session until the process ends. Replies are understood in both plain JSON and server-sent-events framing. Successful results are passed through untouched, `isError` flag and any extra fields included.

## Development

```bash
npm install
npm run build   # tsc -> dist/ (dist/cli.js is the bin)
npm test        # tsx --test test/*.test.ts — stubbed upstream, no network
npm run dev     # run the CLI from source
```

The suite compares the served tool list against the captured surface tool for tool, walks the session handshake and its reuse, proves no `Authorization` header is sent under any environment, and confirms that arguments travel upstream unchanged and results return unchanged.

## License

MIT — see `LICENSE`. Copyright (c) 2026 Rene Turcios.
