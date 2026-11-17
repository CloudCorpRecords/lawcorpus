/**
 * lawcorpus core: a forwarding client for the hosted
 * Lawstronaut legal corpus MCP server.
 *
 * No legal corpus lives on this machine. tools/list is
 * answered from the literal definitions below, which
 * reproduce a live capture of the upstream server word
 * for word (name, description and inputSchema exactly
 * as captured, including the `$schema` marker each
 * captured inputSchema carries, `additionalProperties:
 * false` on every tool, and the captured `required`
 * lists — several tools have no `required` key at all).
 * A tools/call travels upstream over a streamable-HTTP
 * JSON-RPC session: an initialize POST, a
 * notifications/initialized POST, then the tools/call
 * POST, carrying the Mcp-Session-Id response header on
 * later requests when the upstream issues one. The
 * session opens lazily on the first forwarded call and
 * is reused for the client's lifetime.
 *
 * The surface is the full capture: all 16 tools are
 * registered, with no omissions. The built surface is
 * navigation and reading of a published global legal
 * corpus — jurisdiction, domain and category
 * taxonomies, legal portals, authority types and
 * issuing authorities, document listing with structured
 * filters, full document text and markdown, a specific
 * document version, a recent-changes scan, and a
 * one-call citation chain with the full document body.
 *
 * The endpoint is pinned to https://mcp.lawstronaut.com
 * and may be replaced with the LAWSTRONAUT_MCP_URL
 * environment variable (that override is a labelled
 * reconstruction). The registry record declares NO
 * headers on the remote: no auth header is ever sent,
 * under any environment.
 *
 * A successful upstream result is returned exactly as
 * received, isError flag and extra fields included.
 * Failures — an upstream JSON-RPC error, a non-2xx
 * status, a body that cannot be parsed, or a fetch
 * that throws or times out — become an isError result
 * whose text begins with `lawcorpus error:` (that
 * rendering is a labelled reconstruction). Replies may
 * be plain JSON or SSE (`data:` lines); the JSON-RPC
 * message whose id matches the request wins.
 */
import type {
  FetchFn,
  FetchResponseLike,
  ForwardDeps,
  ToolArgs,
  ToolDef,
  ToolResult,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_ENDPOINT_URL = "https://mcp.lawstronaut.com";

export const DEFAULT_TIMEOUT_MS = 30000;

export const PROTOCOL_VERSION = "2025-03-26";

/* ------------------------------------------------------------------ */
/* Tool definitions (tools/list literals, verbatim from the live       */
/* capture in harness/fixtures/lawstronaut-mcp-tools-original.json;    */
/* generated programmatically by parsing and re-serialising the        */
/* fixture JSON, never retyped)                                        */
/* ------------------------------------------------------------------ */

// TOOL_DEFS_GENERATED_START
export const TOOL_DEFS: ToolDef[] = [
  {
    "name": "list_jurisdictions",
    "description": "List all jurisdictions (countries/states) available in the Lawstronaut legal corpus. Call this FIRST when answering legal questions so you know which \"iso\" codes are valid for the other tools. Result is cached for the MCP process lifetime\n    \n    Returns: {data: [{\"name\": \"Belgium\", \"iso\": \"BE\", \"type\": \"country\"}, ...]}\n    - Full list of jurisdiction objects including names, iso, and type",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "list_domains",
    "description": "Retrieves a list of domains for a specific jurisdiction and optional filters.\n    Use this tool when:\n    - The user wants to find legal domains for a specific jurisdiction and optional filters\n    - The user asks about available domains for a domain name\n    - The user wants to filter with pagination\n\n    Parameters:\n    - domain (optional): Filter domains by name\n    - limit: z.number().optional().describe(\"Number of results to return\"),\n    - offset: z.number().optional().describe(\"Number of results to skip\")\n\n    Returns:\n    - List of domains with domain_id, domain, pagination: total_count, limit, offset\n    - Only returns domains that have data",
    "inputSchema": {
      "type": "object",
      "properties": {
        "domain": {
          "type": "string",
          "description": "Filter by domain name"
        },
        "limit": {
          "type": "number",
          "description": "Number of results to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of results to skip"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "list_subdomains",
    "description": "Retrieves a list of subdomains for a specific jurisdiction and optional filters.\n    Use this tool when:\n    - The user wants to find legal subdomains for a specific jurisdiction and optional filters\n    - The user asks about available subdomains for a domain id\n    - The user wants to filter subdomains by name with pagination\n\n    Parameters:\n    - domain_id (required): Filter by Domain ID.\n    - subdomain (optional): Filter subdomains by name\n    - limit: z.number().optional().describe(\"Number of results to return\"),\n    - offset: z.number().optional().describe(\"Number of results to skip\")\n\n    Returns:\n    - List of subdomains with subdomain_id, subdomain, domain_id, pagination: total_count, limit, offset\n    - Only returns subdomains that have data",
    "inputSchema": {
      "type": "object",
      "properties": {
        "domain_id": {
          "type": "string",
          "description": "Filter by Domain ID"
        },
        "subdomain": {
          "type": "string",
          "description": "Filter by subdomain name"
        },
        "limit": {
          "type": "number",
          "description": "Number of results to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of results to skip"
        }
      },
      "required": [
        "domain_id"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "list_categories",
    "description": "Retrieves a list of categories for a specific jurisdiction and optional filters.\n    Use this tool when:\n    - The user wants to find legal categories for a specific jurisdiction and optional filters\n    - The user asks about available categories for a subdomain id\n    - The user wants to filter categories by name with pagination\n\n    Parameters:\n    - subdomain_id (optional): Filter by Subdomain ID.\n    - category_name (optional): Filter categories by name\n    - limit: z.number().optional().describe(\"Number of results to return\"),\n    - offset: z.number().optional().describe(\"Number of results to skip\")\n\n    Returns:\n    - List of categories with category_id, category_name, subdomain_id, domain_id, pagination: total_count, limit, offset\n    - Only returns categories that have data",
    "inputSchema": {
      "type": "object",
      "properties": {
        "subdomain_id": {
          "type": "string",
          "description": "Filter by Subdomain ID"
        },
        "category_name": {
          "type": "string",
          "description": "Filter by category name"
        },
        "limit": {
          "type": "number",
          "description": "Number of results to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of results to skip"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "list_subcategories",
    "description": "Retrieves a list of subcategories for a specific jurisdiction and optional filters.\n    Use this tool when:\n    - The user wants to find legal subcategories for a specific jurisdiction and optional filters\n    - The user asks about available subcategories for a category id\n    - The user wants to filter subcategories by name with pagination\n\n    Parameters:\n    - category_id (required): Filter by Category ID.\n    - subcategory_name (optional): Filter subcategories by name\n    - limit: z.number().optional().describe(\"Number of results to return\"),\n    - offset: z.number().optional().describe(\"Number of results to skip\")\n\n    Returns:\n    - List of subcategories with subcategory_id, subcategory_name, category_id, pagination: total_count, limit, offset\n    - Only returns subcategories that have data",
    "inputSchema": {
      "type": "object",
      "properties": {
        "category_id": {
          "type": "string",
          "description": "Filter by Category ID"
        },
        "subcategory_name": {
          "type": "string",
          "description": "Filter by subcategory name"
        },
        "limit": {
          "type": "number",
          "description": "Number of results to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of results to skip"
        }
      },
      "required": [
        "category_id"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "list_law_types",
    "description": "Retrieves a list of law types for a specific jurisdiction and optional filters.\n    Use this tool when:\n    - The user wants to find legal law types for a specific jurisdiction and optional filters\n    - The user asks about available law types for a subcategory id\n    - The user wants to filter law types by name with pagination\n\n    Parameters:\n    - subcategory_id (required): Filter by Subcategory ID.\n    - law_type (optional): Filter law types by name\n    - limit: z.number().optional().describe(\"Number of results to return\"),\n    - offset: z.number().optional().describe(\"Number of results to skip\")\n\n    Returns:\n    - List of law types with law_type_id, law_type, subcategory_id, category_id, pagination: total_count, limit, offset\n    - Only returns law types that have data",
    "inputSchema": {
      "type": "object",
      "properties": {
        "subcategory_id": {
          "type": "string",
          "description": "Filter by Subcategory ID"
        },
        "law_type": {
          "type": "string",
          "description": "Filter by law type name"
        },
        "limit": {
          "type": "number",
          "description": "Number of results to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of results to skip"
        }
      },
      "required": [
        "subcategory_id"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "list_portals",
    "description": "Retrieves a list of legal portals filtered by jurisdiction and optional criteria.\n    Use this tool when:\n    - The user wants to find legal portals, websites, or resources for a specific jurisdiction\n    - The user asks about available portals in a country or state\n    - The user wants to filter portals by name, language, or tag with total crawled links\n\n    Parameters:\n    - iso (required): Filter by Jurisdiction ISO code (e.g. \"US\").\n    - name (optional): Filter portals by name or URL keyword\n    - tag (optional): Filter portals by tag\n    - lang (optional): Filter portals by language name\n\n    Returns:\n    - List of portals with name, URL, language, jurisdiction, tags, and total crawled links\n    - Only returns portals that have crawled data",
    "inputSchema": {
      "type": "object",
      "properties": {
        "iso": {
          "type": "string",
          "description": "Filter by Jurisdiction ISO code (e.g. 'US')"
        },
        "name": {
          "type": "string",
          "description": "Filter by portal name"
        },
        "tag": {
          "type": "string",
          "description": "Filter by portal tags"
        },
        "lang": {
          "type": "string",
          "description": "Filter by language"
        }
      },
      "required": [
        "iso"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "list_authority_types",
    "description": "Retrieves a list of authority types.\n    Use this tool when:\n    - The user wants to find legal authority types for a specific jurisdiction and optional filters\n    - The user asks about available authority types for a portal name, authority type\n    - The user wants to filter with pagination\n\n    Parameters:\n    - iso (required): Filter by Jurisdiction ISO code (e.g. \"US\").\n    - limit (optional): Number of results to return.\n    - offset (optional): Number of results to skip.\n    - portal_name (optional): Filter by portal name.\n    - authority_type (optional): Filter by authority type.\n\n    Returns:\n    - List of authority types with iso, authority_type, portal_name, pagination: total_count, limit, offset\n    - Only returns authority types that have data",
    "inputSchema": {
      "type": "object",
      "properties": {
        "iso": {
          "type": "string",
          "description": "Filter by Jurisdiction ISO code (e.g. 'US')"
        },
        "limit": {
          "type": "number",
          "description": "Number of results to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of results to skip"
        },
        "portal_name": {
          "type": "string",
          "description": "Filter by portal name"
        },
        "authority_type": {
          "type": "string",
          "description": "Filter by authority type"
        }
      },
      "required": [
        "iso"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "list_issuing_authorities",
    "description": "Retrieves a list of issuing authorities for a specific jurisdiction and optional filters.\n    Use this tool when:\n    - The user wants to find legal issuing authorities for a specific jurisdiction and optional filters\n    - The user asks about available issuing authorities for a portal name, issuing authority\n    - The user wants to filter with pagination\n\n    Parameters:\n    - iso (required): Filter by Jurisdiction ISO code (e.g. \"US\").\n    - limit (optional): Number of results to return.\n    - offset (optional): Number of results to skip.\n    - portal_name (optional): Filter by portal name.\n    - issuing_authority (optional): Filter by issuing authority.\n\n    Returns:\n    - List of issuing authorities with iso, issuing_authority, portal_name, pagination: total_count, limit, offset\n    - Only returns issuing authorities that have data",
    "inputSchema": {
      "type": "object",
      "properties": {
        "iso": {
          "type": "string",
          "description": "Filter by Jurisdiction ISO code (e.g. 'US')"
        },
        "limit": {
          "type": "number",
          "description": "Number of results to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of results to skip"
        },
        "portal_name": {
          "type": "string",
          "description": "Filter by portal name"
        },
        "issuing_authority": {
          "type": "string",
          "description": "Filter by issuing authority"
        }
      },
      "required": [
        "iso"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "list_documents",
    "description": "List documents in a jurisdiction with structured filters and pagination.\n    Use this tool when:\n    - The user wants to find legal content for a specific jurisdiction and optional filters\n    - The user asks about available content for a portal name, title, section_title, url, status, repealed, publication_date and crawling_date\n    - The user wants to filter content for type of authority, issuing authority, source identifier, source secondary identifier, tag\n\n    Parameters: \n    - iso (required): Jurisdiction ISO code (e.g. \"US\").\n    - portal (optional): Portal name.\n    - limit (optional): Number of results to return.\n    - offset (optional): Number of results to skip.\n    - document_id (optional): Document ID.\n    - title (optional): Title.\n    - section_title (optional): Section title.\n    - url (optional): URL.\n    - last_updated (optional): Last updated date.\n\n    Returns:\n    - Contents list with title, section_title, publication_date, effective_date, expiration_date, date_of_enactment, date_of_last_amendment, date_of_repealed, date_of_decision, status, version, source_identifier, source_secondary_identifier, issuing_authority, type_of_authority, language, legal_link, repealed, metadata, summary, tags, source_keywords, crawling_date, portal, portal_name, last_updated\n    - Only returns content that has crawled data",
    "inputSchema": {
      "type": "object",
      "properties": {
        "iso": {
          "type": "string",
          "description": "Filter by Jurisdiction ISO code (e.g. 'US')"
        },
        "portal": {
          "type": "string",
          "description": "Filter by portal name"
        },
        "version": {
          "type": "string",
          "description": "Filter by version"
        },
        "limit": {
          "type": "number",
          "description": "Number of results to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of results to skip"
        },
        "document_id": {
          "type": "string",
          "description": "Filter by document ID"
        },
        "repealed": {
          "type": "boolean",
          "description": "Filter by repealed status"
        },
        "title": {
          "type": "string",
          "description": "Filter by title"
        },
        "section_title": {
          "type": "string",
          "description": "Filter by section title"
        },
        "url": {
          "type": "string",
          "description": "Filter by URL"
        },
        "status": {
          "type": "string",
          "description": "Filter by status"
        },
        "crawling_date": {
          "type": "string",
          "description": "Filter by crawling date"
        },
        "last_updated": {
          "type": "string",
          "description": "Filter by last updated date"
        },
        "last_amendment": {
          "type": "string",
          "description": "Filter by last amendment date"
        },
        "publication_date": {
          "type": "string",
          "description": "Filter by publication date"
        },
        "expiration_date": {
          "type": "string",
          "description": "Filter by expiration date"
        },
        "effective_date": {
          "type": "string",
          "description": "Filter by effective date"
        },
        "date_of_enactment": {
          "type": "string",
          "description": "Filter by date of enactment"
        },
        "date_of_decision": {
          "type": "string",
          "description": "Filter by date of decision"
        },
        "file_data_only": {
          "type": "boolean",
          "description": "Return file data only"
        },
        "issuing_authority": {
          "type": "string",
          "description": "Filter by issuing authority"
        },
        "type_of_authority": {
          "type": "string",
          "description": "Filter by type of authority"
        },
        "source_identifier": {
          "type": "string",
          "description": "Filter by source identifier"
        },
        "source_secondary_identifier": {
          "type": "string",
          "description": "Filter by secondary source identifier"
        },
        "tag": {
          "type": "string",
          "description": "Filter by tag"
        },
        "lang": {
          "type": "string",
          "description": "Filter by language"
        }
      },
      "required": [
        "iso"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "get_document_text",
    "description": "Retrieves full text for a specific jurisdiction and optional filters.\n    Use this tool when:\n    - The user asks about available full text for a portal name, title, section_title, url, status, repealed, publication_date and crawling_date\n    - The user wants to filter full text for type of authority, issuing authority, source identifier, source secondary identifier, tag\n\n    Parameters: \n    - iso (required): Jurisdiction ISO code (e.g. \"US\").\n    - portal (optional): Portal name.\n    - limit (optional): Number of results to return.\n    - offset (optional): Number of results to skip.\n    - document_id (optional): Document ID.\n    - title (optional): Title.\n    - section_title (optional): Section title.\n    - url (optional): URL.\n    - last_updated (optional): Last updated date.\n    \n    Returns:\n    - Content full text list with document_id, full_text",
    "inputSchema": {
      "type": "object",
      "properties": {
        "iso": {
          "type": "string",
          "description": "Filter by Jurisdiction ISO code (e.g. 'US')"
        },
        "portal": {
          "type": "string",
          "description": "Filter by portal name"
        },
        "version": {
          "type": "string",
          "description": "Filter by version"
        },
        "limit": {
          "type": "number",
          "description": "Number of results to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of results to skip"
        },
        "document_id": {
          "type": "string",
          "description": "Filter by document ID"
        },
        "repealed": {
          "type": "boolean",
          "description": "Filter by repealed status"
        },
        "title": {
          "type": "string",
          "description": "Filter by title"
        },
        "section_title": {
          "type": "string",
          "description": "Filter by section title"
        },
        "url": {
          "type": "string",
          "description": "Filter by URL"
        },
        "status": {
          "type": "string",
          "description": "Filter by status"
        },
        "crawling_date": {
          "type": "string",
          "description": "Filter by crawling date"
        },
        "last_updated": {
          "type": "string",
          "description": "Filter by last updated date"
        },
        "last_amendment": {
          "type": "string",
          "description": "Filter by last amendment date"
        },
        "publication_date": {
          "type": "string",
          "description": "Filter by publication date"
        },
        "expiration_date": {
          "type": "string",
          "description": "Filter by expiration date"
        },
        "effective_date": {
          "type": "string",
          "description": "Filter by effective date"
        },
        "date_of_enactment": {
          "type": "string",
          "description": "Filter by date of enactment"
        },
        "date_of_decision": {
          "type": "string",
          "description": "Filter by date of decision"
        },
        "file_data_only": {
          "type": "boolean",
          "description": "Return file data only"
        },
        "issuing_authority": {
          "type": "string",
          "description": "Filter by issuing authority"
        },
        "type_of_authority": {
          "type": "string",
          "description": "Filter by type of authority"
        },
        "source_identifier": {
          "type": "string",
          "description": "Filter by source identifier"
        },
        "source_secondary_identifier": {
          "type": "string",
          "description": "Filter by secondary source identifier"
        },
        "tag": {
          "type": "string",
          "description": "Filter by tag"
        },
        "lang": {
          "type": "string",
          "description": "Filter by language"
        }
      },
      "required": [
        "iso"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "get_markdown",
    "description": "Retrieves markdown for a specific jurisdiction and optional filters.\n    Use this tool when:\n    - The user asks about available markdown for a portal name, title, section_title, url, status, repealed, publication_date and crawling_date\n    - The user wants to filter markdown for type of authority, issuing authority, source identifier, source secondary identifier, tag\n\n    Parameters: \n    - iso (required): Jurisdiction ISO code (e.g. \"US\").\n    - portal (optional): Portal name.\n    - limit (optional): Number of results to return.\n    - offset (optional): Number of results to skip.\n    - document_id (optional): Document ID.\n    - title (optional): Title.\n    - section_title (optional): Section title.\n    - url (optional): URL.\n    - last_updated (optional): Last updated date.\n\n    Returns:\n    - Content markdown list with document_id, content_markdown",
    "inputSchema": {
      "type": "object",
      "properties": {
        "iso": {
          "type": "string",
          "description": "Filter by Jurisdiction ISO code (e.g. 'US')"
        },
        "portal": {
          "type": "string",
          "description": "Filter by portal name"
        },
        "version": {
          "type": "string",
          "description": "Filter by version"
        },
        "limit": {
          "type": "number",
          "description": "Number of results to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of results to skip"
        },
        "document_id": {
          "type": "string",
          "description": "Filter by document ID"
        },
        "repealed": {
          "type": "boolean",
          "description": "Filter by repealed status"
        },
        "title": {
          "type": "string",
          "description": "Filter by title"
        },
        "section_title": {
          "type": "string",
          "description": "Filter by section title"
        },
        "url": {
          "type": "string",
          "description": "Filter by URL"
        },
        "status": {
          "type": "string",
          "description": "Filter by status"
        },
        "crawling_date": {
          "type": "string",
          "description": "Filter by crawling date"
        },
        "last_updated": {
          "type": "string",
          "description": "Filter by last updated date"
        },
        "last_amendment": {
          "type": "string",
          "description": "Filter by last amendment date"
        },
        "publication_date": {
          "type": "string",
          "description": "Filter by publication date"
        },
        "expiration_date": {
          "type": "string",
          "description": "Filter by expiration date"
        },
        "effective_date": {
          "type": "string",
          "description": "Filter by effective date"
        },
        "date_of_enactment": {
          "type": "string",
          "description": "Filter by date of enactment"
        },
        "date_of_decision": {
          "type": "string",
          "description": "Filter by date of decision"
        },
        "file_data_only": {
          "type": "boolean",
          "description": "Return file data only"
        },
        "issuing_authority": {
          "type": "string",
          "description": "Filter by issuing authority"
        },
        "type_of_authority": {
          "type": "string",
          "description": "Filter by type of authority"
        },
        "source_identifier": {
          "type": "string",
          "description": "Filter by source identifier"
        },
        "source_secondary_identifier": {
          "type": "string",
          "description": "Filter by secondary source identifier"
        },
        "tag": {
          "type": "string",
          "description": "Filter by tag"
        },
        "lang": {
          "type": "string",
          "description": "Filter by language"
        }
      },
      "required": [
        "iso"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "get_source_url",
    "description": "Get a time-limited signed URL to the original source file (PDF etc.).\n    Use this tool when:\n    - The user wants to find a pdf URL for a specific document\n    - The user asks about presigned URL for a pdf\n    Parameters:\n    - document_id (required): Document ID.\n\n    Returns:\n    - PDF URL for a specific document with document_id and pdf_url",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "description": "Document ID"
        }
      },
      "required": [
        "document_id"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "get_document_with_version",
    "description": "Retrieves a specific document with a specific version.\n    Use this tool when:\n    - The user wants to find a specific document with a specific version\n    - The user asks about available a specific document with a specific version\n\n    Parameters:\n    - document_id (required): Document ID.\n    - version (required): Version.\n\n    Returns:\n    - Content with version with title, section_title, publication_date, effective_date, expiration_date, date_of_enactment, date_of_last_amendment, date_of_repealed, date_of_decision, status, version, source_identifier, source_secondary_identifier, issuing_authority, type_of_authority, language, legal_link, repealed, metadata, summary, tags, source_keywords, crawling_date, portal, portal_name, last_updated\n    - Only returns content that has crawled data with the specific version",
    "inputSchema": {
      "type": "object",
      "properties": {
        "document_id": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "description": "Document ID"
        },
        "version": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "description": "Version"
        }
      },
      "required": [
        "document_id",
        "version"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "horizon_scan",
    "description": "Scans recent legal documents across jurisdictions.\n    Use this when the user asks:\n    - \"What laws changed recently in Netherland?\"\n    - \"Show me new regulations from last week\"\n    - \"Any updates in NL law?\"",
    "inputSchema": {
      "type": "object",
      "properties": {
        "iso": {
          "type": "string",
          "description": "One ISO code e.g. \"IE\", \"NL\", \"US\", etc."
        },
        "since": {
          "type": "string",
          "default": "yesterday",
          "description": "Freshness window. \"yesterday\", \"today\", \"Nd\"/\"Nh\"/\"Nw\" (e.g. \"7d\"), or ISO date \"YYYY-MM-DD\""
        },
        "topic": {
          "type": [
            "string",
            "null"
          ],
          "description": "Optional filter (matches title) e.g. \"employee monitoring\" or \"workplace surveillance\""
        },
        "date_field": {
          "type": "string",
          "enum": [
            "crawling_date",
            "publication_date",
            "last_updated"
          ],
          "default": "crawling_date",
          "description": "Which date to window on. \"crawling_date\" (default) = when Lawstronaut crawled it. \"publication_date\" = when officially published. \"last_updated\" = when corpus record last changed."
        },
        "status": {
          "type": [
            "string",
            "null"
          ],
          "description": "Optional filter on status field e.g. \"new\", \"updated\" String."
        },
        "issuing_authority": {
          "type": [
            "string",
            "null"
          ],
          "description": "Optional filter on issuing authority"
        },
        "type_of_authority": {
          "type": [
            "string",
            "null"
          ],
          "description": "Optional filter on type of authority"
        },
        "include_repealed": {
          "type": "boolean",
          "default": false,
          "description": "If false, drop documents where repealed=true"
        },
        "max_per_jurisdiction": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100,
          "default": 50,
          "description": "Max docs to return per jurisdiction (1-100)"
        }
      },
      "required": [
        "iso"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "evidence_pull",
    "description": "\"Show me the source.\"\n     For a specific document, return the full citation chain in one call:\n    metadata (with all dates and identifiers), permanent legal_link, signed\n    URL to the original source file (if available), and the full document\n    body in markdown or plain text. Designed for auditability.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "iso": {
          "type": "string",
          "description": "Document's jurisdiction ISO code, e.g. 'IE', 'NL', 'US', etc."
        },
        "document_id": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "description": "Numeric document_id from any listing/search tool"
        },
        "include_text": {
          "type": "boolean",
          "default": true,
          "description": "Fetch the full body (default True)"
        },
        "include_source_url": {
          "type": "boolean",
          "default": true,
          "description": "Fetch a temporary signed URL to the original file (PDF etc.) where available (default True)."
        },
        "text_format": {
          "type": "string",
          "enum": [
            "markdown",
            "plain"
          ],
          "default": "markdown",
          "description": "'markdown' (preserves structure) or 'plain'."
        }
      },
      "required": [
        "iso",
        "document_id"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  }
];
// TOOL_DEFS_GENERATED_END

export const TOOL_NAMES = TOOL_DEFS.map((t) => t.name);

/** Whether `name` belongs to the captured surface. */
export function isKnownTool(name: string): boolean {
  return TOOL_NAMES.includes(name);
}

/* ------------------------------------------------------------------ */
/* Forwarding client                                                   */
/* ------------------------------------------------------------------ */

function errorResult(detail: string): ToolResult {
  return {
    content: [{ type: "text", text: `lawcorpus error: ${detail}` }],
    isError: true,
  };
}

function rpcErrorMessage(error: unknown): string {
  if (error !== null && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message !== "") return message;
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * Read a JSON-RPC response body, tolerating SSE framing.
 * Returns the message whose id matches `expectedId` when
 * present, otherwise the last parseable message, otherwise
 * null when nothing in the body parses.
 */
export function parseRpcBody(
  text: string,
  expectedId?: number,
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const candidates: Record<string, unknown>[] = [];
  const tryPush = (payload: string): void => {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        candidates.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Not a JSON payload; skip this candidate.
    }
  };
  if (trimmed.includes("data:")) {
    for (const line of trimmed.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice("data:".length).trim();
      if (payload !== "" && payload !== "[DONE]") tryPush(payload);
    }
  } else {
    tryPush(trimmed);
  }
  if (candidates.length === 0) return null;
  if (expectedId !== undefined) {
    const match = candidates.find((c) => c.id === expectedId);
    if (match !== undefined) return match;
  }
  return candidates[candidates.length - 1];
}

async function defaultFetch(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
): Promise<FetchResponseLike> {
  return fetch(url, init) as unknown as FetchResponseLike;
}

/**
 * A forwarding client holding a single upstream session,
 * opened lazily on first use and reused from then on
 * (for the process lifetime in the MCP server, or for a
 * single invocation in the CLI).
 */
export class LawcorpusClient {
  private readonly deps: ForwardDeps;
  private sessionId: string | null = null;
  private ready = false;
  private sessionPromise: Promise<void> | null = null;
  private idCounter = 0;

  constructor(deps: ForwardDeps = {}) {
    this.deps = deps;
  }

  private fetchFn(): FetchFn {
    return this.deps.fetchFn ?? defaultFetch;
  }

  private endpointUrl(): string {
    if (this.deps.url && this.deps.url.trim() !== "") return this.deps.url.trim();
    const raw = (this.deps.env ?? process.env).LAWSTRONAUT_MCP_URL;
    if (raw && raw.trim() !== "") return raw.trim();
    return DEFAULT_ENDPOINT_URL;
  }

  private timeoutMs(): number {
    if (typeof this.deps.timeoutMs === "number" && this.deps.timeoutMs > 0) {
      return this.deps.timeoutMs;
    }
    return DEFAULT_TIMEOUT_MS;
  }

  private nextId(): number {
    this.idCounter += 1;
    return this.idCounter;
  }

  private async post(
    body: unknown,
    withSession: boolean,
  ): Promise<FetchResponseLike> {
    // The registry record declares NO headers on the remote:
    // no Authorization (or any other auth) header is ever sent.
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (withSession && this.sessionId !== null) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      return await this.fetchFn()(this.endpointUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.ready) return;
    if (this.sessionPromise === null) {
      this.sessionPromise = (async () => {
        const initId = this.nextId();
        const initRes = await this.post(
          {
            jsonrpc: "2.0",
            id: initId,
            method: "initialize",
            params: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: "lawcorpus", version: VERSION },
            },
          },
          false,
        );
        const sessionId = initRes.headers.get("mcp-session-id");
        if (sessionId) this.sessionId = sessionId;
        const initText = await initRes.text();
        const initParsed = parseRpcBody(initText, initId);
        if (initParsed !== null && initParsed.error) {
          throw new Error(rpcErrorMessage(initParsed.error));
        }
        if (initRes.status < 200 || initRes.status >= 300) {
          throw new Error(`HTTP ${initRes.status}`);
        }
        if (initParsed === null && initText.trim() !== "") {
          throw new Error("malformed response");
        }
        const initializedRes = await this.post(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          true,
        );
        try {
          await initializedRes.text();
        } catch {
          // Nothing needed from the notification response body.
        }
        this.ready = true;
      })();
    }
    try {
      await this.sessionPromise;
    } catch (err) {
      this.sessionPromise = null;
      this.sessionId = null;
      throw err;
    }
  }

  /** Forward one tool call; upstream failures come back as isError results. */
  async callTool(name: string, args: ToolArgs): Promise<ToolResult> {
    try {
      await this.ensureSession();
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    const callId = this.nextId();
    let callRes: FetchResponseLike;
    try {
      callRes = await this.post(
        {
          jsonrpc: "2.0",
          id: callId,
          method: "tools/call",
          params: { name, arguments: args ?? {} },
        },
        true,
      );
    } catch (err) {
      return errorResult(
        `request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const parsed = parseRpcBody(await callRes.text(), callId);
    if (parsed !== null && parsed.error) {
      return errorResult(rpcErrorMessage(parsed.error));
    }
    if (callRes.status < 200 || callRes.status >= 300) {
      return errorResult(`HTTP ${callRes.status}`);
    }
    if (parsed === null) return errorResult("malformed response");
    const result = parsed.result as ToolResult | undefined;
    if (result === undefined || result === null || typeof result !== "object") {
      return errorResult("malformed response");
    }
    // Hand the upstream result back exactly as received.
    return result;
  }
}

/** Build a forwarding client; tests inject a fake fetch and env through deps. */
export function createClient(deps: ForwardDeps = {}): LawcorpusClient {
  return new LawcorpusClient(deps);
}

/** One-shot helper: a fresh client for a single call (the CLI path). */
export async function callTool(
  name: string,
  args: ToolArgs,
  deps: ForwardDeps = {},
): Promise<ToolResult> {
  return new LawcorpusClient(deps).callTool(name, args);
}
