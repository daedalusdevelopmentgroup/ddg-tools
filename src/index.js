// ddg-tools — zero-dependency client for Daedalus Development Group's
// x402-payable AI-agent API tools.
//
// The core deliberately ships no runtime dependencies and never imports an x402
// client. Every paid request that has not been settled returns HTTP 402 with an
// x402 challenge; callTool surfaces that challenge so the caller can settle it
// with their own x402 client (for example the optional peer dependency
// `x402-axios`, or `@x402/fetch`) and then retry with the payment header.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Tools metadata is generated from DDG's live pricing catalog at build time.
const CATALOG = JSON.parse(readFileSync(join(__dirname, 'tools.json'), 'utf8'));

/** Base URL for every DDG agent-payable service. */
export const DDG_BASE_URL = CATALOG.base_url || 'https://agents.daedalusdevelopmentgroup.com';

const TOOLS = Array.isArray(CATALOG.tools) ? CATALOG.tools : [];
const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

const deepClone = (value) => JSON.parse(JSON.stringify(value));

/**
 * Full metadata for every tool (paid and free).
 * @returns {Array<object>}
 */
export function listTools() {
  return TOOLS.map(deepClone);
}

/**
 * Metadata for one tool, or undefined if the name is unknown.
 * @param {string} name
 * @returns {object|undefined}
 */
export function getTool(name) {
  const tool = BY_NAME.get(name);
  return tool ? deepClone(tool) : undefined;
}

/**
 * OpenAI function-calling schemas for every tool. Drop the result straight into
 * the `tools` array of a chat.completions / responses request.
 * @returns {Array<object>}
 */
export function getSchemas() {
  return TOOLS.map((t) => deepClone(t.openai_schema));
}

/**
 * Call a DDG tool.
 *
 * Plain `fetch` to DDG_BASE_URL + tool.path with the tool's HTTP method and the
 * arguments as a JSON body (GET/HEAD tools ignore the body).
 *
 * @param {string} name Tool name from listTools().
 * @param {object} [args] Tool arguments (sent as JSON body for non-GET tools).
 * @param {object} [opts]
 * @param {string} [opts.apiKeyOrToken] Sent as `Authorization: Bearer <token>`.
 * @param {string} [opts.agentId] Sent as `X-Agent-Id` (DDG requires a stable
 *   agent identity; send the same value on the paid retry).
 * @param {string} [opts.paymentHeader] Settled x402 payment payload, sent as the
 *   `X-PAYMENT` / `PAYMENT-SIGNATURE` header on the retry.
 * @param {object} [opts.headers] Extra request headers.
 * @returns {Promise<{status:number, paid:boolean, body:any,
 *   paymentRequired?:object, acceptsHeader?:string|null}>}
 *   On HTTP 402: { status:402, paid:false, paymentRequired:<parsed challenge>,
 *   acceptsHeader:<raw base64 challenge header>, body:<parsed challenge> }.
 */
export async function callTool(name, args = {}, opts = {}) {
  const tool = BY_NAME.get(name);
  if (!tool) {
    throw new Error(`Unknown DDG tool: ${name}`);
  }

  const { apiKeyOrToken, agentId, paymentHeader, headers = {} } = opts;
  const url = `${DDG_BASE_URL.replace(/\/+$/, '')}${tool.path}`;

  const reqHeaders = { accept: 'application/json', ...headers };
  const init = { method: tool.method, headers: reqHeaders };

  if (tool.method !== 'GET' && tool.method !== 'HEAD') {
    reqHeaders['content-type'] = 'application/json';
    init.body = JSON.stringify(args ?? {});
  }
  if (agentId) reqHeaders['X-Agent-Id'] = agentId;
  if (apiKeyOrToken) reqHeaders['authorization'] = `Bearer ${apiKeyOrToken}`;
  if (paymentHeader) {
    reqHeaders['X-PAYMENT'] = paymentHeader;
    reqHeaders['PAYMENT-SIGNATURE'] = paymentHeader;
  }

  const res = await fetch(url, init);
  const text = await res.text();

  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (res.status === 402) {
    const acceptsHeader =
      res.headers.get('payment-required') ||
      res.headers.get('x-payment-required') ||
      null;
    return {
      status: 402,
      paid: false,
      tool: name,
      paymentRequired: body,
      acceptsHeader,
      body,
    };
  }

  const paid = res.status >= 200 && res.status < 300 && tool.free !== true;
  return { status: res.status, paid, tool: name, body };
}

export default { DDG_BASE_URL, listTools, getTool, getSchemas, callTool };
