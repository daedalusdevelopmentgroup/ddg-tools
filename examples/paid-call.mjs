// Raw end-to-end paid call against DDG: the x402 402 flow.
//
//  1. Call a paid tool with no payment -> DDG answers 402 + an x402 challenge.
//  2. Settle the challenge with your own x402 client.
//  3. Retry with the payment header -> DDG returns the real result.
//
// Run:  node examples/paid-call.mjs
// Set DDG_X_PAYMENT to a settled X-PAYMENT payload to exercise step 3; without
// it the example stops after showing the 402 challenge.

import { callTool, DDG_BASE_URL } from '../src/index.js';

const AGENT_ID = 'example-agent-0001'; // DDG needs a stable agent identity.

async function main() {
  const args = { chain: 'base' };

  // 1. Unpaid attempt.
  const first = await callTool('chainsGas', args, { agentId: AGENT_ID });
  console.log('base URL :', DDG_BASE_URL);
  console.log('status   :', first.status, '| paid:', first.paid);

  if (first.status !== 402) {
    console.log('No payment required (unexpected here):', first.body);
    return;
  }

  // The parsed x402 challenge from the response body.
  const challenge = first.paymentRequired;
  console.log('x402Version:', challenge?.x402Version);
  console.log('accepts    :', JSON.stringify(challenge?.accepts, null, 2));

  // The raw base64 challenge header (payment-required), if you prefer it.
  console.log('challenge header:', String(first.acceptsHeader).slice(0, 48), '...');

  // 2. Settle with your own x402 client. `x402-axios` is an OPTIONAL peer
  //    dependency and is NOT imported by ddg-tools. Example wiring:
  //
  //    import { createAxiosInstance } from 'x402-axios';
  //    import { privateKeyToAccount } from 'viem/accounts';
  //    const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY);
  //    const paidApi = createAxiosInstance({ account }); // handles 402 for you
  //    const res = await paidApi.post(`${DDG_BASE_URL}/v1/chains/gas`, args);
  //
  // With a manual client you build the X-PAYMENT header (base64 JSON payment
  // payload signed for one of the accepted network/asset pairs above).

  // 3. Retry with the payment header.
  const paymentHeader = process.env.DDG_X_PAYMENT || '';
  const paid = await callTool('chainsGas', args, { agentId: AGENT_ID, paymentHeader });

  console.log('retry status:', paid.status, '| paid:', paid.paid);
  console.log('result      :', paid.body);
}

main();
