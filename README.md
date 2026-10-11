# ddg-tools

`ddg-tools` is a zero-dependency JavaScript/TypeScript client for the [Daedalus Development Group](https://agents.daedalusdevelopmentgroup.com) agent-payable API. It exposes each AI-agent service as an OpenAI function-calling schema, so an agent can discover capabilities and call them directly. Free metadata tools are readable without payment; paid tools answer HTTP 402 with an x402 challenge (USDC on Base and other chains) that the caller settles with their own wallet client. The core package has no runtime dependencies and never imports a payment SDK.

## Install

```sh
npm install ddg-tools
# optional, only if you want a ready-made x402 client for the payment step:
npm install x402-axios viem
```

## Quickstart

```js
import { listTools, getSchemas, getTool, callTool, DDG_BASE_URL } from 'ddg-tools';

// 1. Discover tools.
const tools = listTools();               // [{ name, method, path, price_usd, free, category, ... }]
const schema = getTool('chainsGas');    // one tool, or undefined

// 2. Hand the OpenAI schemas to your model.
const openaiTools = getSchemas();       // -> chat.completions `tools` array

// 3. Call a tool. Free tools just work; paid tools return a 402 challenge.
const res = await callTool('chainsGas', { chain: 'base' }, { agentId: 'my-agent-id' });

if (res.status === 402) {
  // Settle res.paymentRequired (the x402 challenge) with your own wallet client,
  // then retry with the payment header returned by that client:
  const paid = await callTool('chainsGas', { chain: 'base' }, {
    agentId: 'my-agent-id',
    paymentHeader: '<X-PAYMENT payload>',
  });
  console.log(paid.status, paid.paid, paid.body);
} else {
  console.log(res.body);
}
```

Runnable, dependency-free examples live in [`examples/`](./examples): [`openai-tools.mjs`](./examples/openai-tools.mjs) (schema wiring + tool-call dispatch) and [`paid-call.mjs`](./examples/paid-call.mjs) (raw 402 -> settle -> retry flow).

## API

- `DDG_BASE_URL` — `https://agents.daedalusdevelopmentgroup.com`.
- `listTools()` — metadata for every tool (name, method, path, price_usd, free, category, description, openai_schema).
- `getTool(name)` — one tool's metadata, or `undefined` if unknown.
- `getSchemas()` — array of OpenAI function-calling schemas for use as a `tools` array.
- `callTool(name, args, opts)` — `fetch`es `DDG_BASE_URL + path` with the tool's method and a JSON body. Returns `{ status, paid, body }`. On HTTP 402 it returns `{ status: 402, paid: false, paymentRequired, acceptsHeader, body }`. `opts`: `apiKeyOrToken` (Bearer), `agentId` (`X-Agent-Id`), `paymentHeader` (`X-PAYMENT`/`PAYMENT-SIGNATURE`), `headers`.

## Tools

### Paid (20)

| Name | Method | Price | Description |
| --- | --- | --- | --- |
| `securityAuditDeep` | POST | $0.01 | Premium deep security audit of agent-supplied code or MCP tool configs: 16 detector families, evidence with... |
| `promptInjectionScan` | POST | $0.01 | Prompt-injection and tool-exfiltration scan: risk_summary, exploit_reproduction_steps, prompt/tool-boundary... |
| `mcpToolSecurityAudit` | POST | $0.01 | MCP/tool permission and auth-boundary audit: tool-risk matrix, dangerous capability flags, prompt-injection... |
| `secretLeakApiKeyScan` | POST | $0.01 | API-key/secret leak and credential boundary scan: redacted_secret_findings, leak_paths, rotation_priority. |
| `productionSecurityAudit` | POST | $0.01 | Productionized public-surface security audit for AI-agent services, MCP/tool servers, OpenAPI/llms.txt cata... |
| `receiptsIssue` | POST | $0.01 | Issue a portable Ed25519-signed service receipt for any completed interaction. |
| `receiptsVerify` | POST | $0.01 | Verify any DDG receipt: signature + payload integrity + state. |
| `receiptsBundle` | POST | $0.01 | Merkle-bundle up to 200 receipts into one signed root (portable reputation). |
| `verifyClaim` | POST | $0.01 | Deterministic claim-vs-source verification (CVE real? package vulnerable/exists? domain resolves? TLS cert... |
| `trustCheck` | POST | $0.01 | Adversarial pre-flight verification of any x402 endpoint BEFORE an agent pays it: a real 402-handshake prob... |
| `chainsRpc` | POST | $0.01 | One gate-verified keyless read op on one chain (ethereum, base, polygon, arbitrum, optimism, avalanche, bnb... |
| `chainsAddress` | POST | $0.01 | Address snapshot on any supported chain: balance_wei, nonce, is_contract (chainId-gated backend). |
| `chainsGas` | POST | $0.01 | Gas snapshot on any supported chain: gas_price, max_priority_fee, short fee_history (chainId-gated backend). |
| `chainsTokenBalance` | POST | $0.01 | ERC-20 balanceOf + metadata (symbol/decimals/name) on any supported chain, gate-verified eth_call, exact fo... |
| `contractAbi` | POST | $0.01 | Fetch verified smart contract ABI from block explorers (Base, Ethereum, Optim... |
| `complianceSanctions` | POST | $0.01 | Sanctions screen with PINNED list versions (OFAC SDN consolidated CSV + EU consolidated list): verdict clea... |
| `complianceScreenWallet` | POST | $0.01 | Screen a wallet address against the OFAC SDN digital-currency list (1,066 addresses, 20 chains); block/clea... |
| `x402Preflight` | POST | $0.01 | x402 challenge compliance pre-flight: probes an endpoint's 402 envelope and verdicts it against v1/v2 + MPP... |
| `agentRegistry` | POST | $0.01 | Search or list AI agents in the DDG agent directory. Registration is free. |
| `webSearch` | POST | $0.01 | Search the web and return structured JSON results. Aggregates 20+ search engi... |

### Free metadata (5)

| Name | Method | Price | Description |
| --- | --- | --- | --- |
| `agentCard` | GET | free | Publish the A2A 1.0 Agent Card. |
| `x402Metadata` | GET | free | Free x402 discovery document: protocol version, accepted payment networks/assets (USDC on Base/Polygon/Arbi... |
| `attestationJwks` | GET | free | Publish the DDG Ed25519 attestation verification key. |
| `refundPolicy` | GET | free | Machine-readable policy: refunds are manual strict reversals; approved revers... |
| `servicesSearch` | POST | free | Rank up to five available DDG services for an objective. |

## Payment

DDG services are machine-payable over **x402**: each paid call without settlement returns HTTP `402` with a JSON challenge (`accepts[]` of `{ scheme, network, asset, amount, payTo }`) plus a raw `payment-required` header. DDG settles **USDC on Base (eip155:8453)** by default, and also accepts Polygon, Arbitrum One, World Chain, and Solana USDC. Amounts are atomic integer strings (USDC has 6 decimals, so `$0.01` is `"10000"`).

The core package does not import a payment client. Complete the challenge with any x402 client and retry:

```sh
npm install x402-axios viem   # optional peer dependency for the payment flow
```

Alternatives that also work: [`x402`](https://www.npmjs.com/package/x402) and [`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch).

```js
import { createAxiosInstance } from 'x402-axios';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY);
const paidApi = createAxiosInstance({ account }); // auto-settles 402 challenges
const res = await paidApi.post(`${DDG_BASE_URL}/v1/chains/gas`, { chain: 'base' });
```

## Discovery metadata

- x402 discovery document: `https://agents.daedalusdevelopmentgroup.com/.well-known/x402`
- A2A agent card: `https://agents.daedalusdevelopmentgroup.com/.well-known/agent-card.json`
- Attestation JWKS: `https://agents.daedalusdevelopmentgroup.com/.well-known/ddg-attestation-jwks.json`
- Machine-readable catalog: `https://agents.daedalusdevelopmentgroup.com/.well-known/ddg-service-registry.json`

## License

MIT © 2026 Daedalus Development Group
