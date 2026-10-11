// Minimal OpenAI function-calling wiring for ddg-tools.
//
// Illustrative and dependency-free: it shows the exact request shape and the
// tool-call dispatch loop. It will not hit the network unless you run it, and
// it needs no DDG API key to read. Bring your own OpenAI client — `openai` is
// a dependency of YOUR app, never of ddg-tools.

import { getSchemas, callTool, DDG_BASE_URL } from '../src/index.js';

// 1. Every DDG tool as an OpenAI function schema.
const tools = getSchemas();

async function main() {
  const messages = [
    { role: 'user', content: 'Is example.com safe to interact with as an agent?' },
  ];

  // 2. Hand the schemas straight to the model.
  const chatRequest = {
    model: 'gpt-4o-mini',
    messages,
    tools, // <-- DDG schemas plug in here verbatim
    tool_choice: 'auto',
  };
  // POST chatRequest to https://api.openai.com/v1/chat/completions with your key.

  // 3. The model returns a tool_call; dispatch it to DDG.
  const toolCall = {
    id: 'call_1',
    function: {
      name: 'trustCheck',
      arguments: JSON.stringify({ url: 'https://example.com' }),
    },
  };

  const name = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments);

  const result = await callTool(name, args, { agentId: 'my-agent-id' });

  if (result.status === 402) {
    // Settle result.paymentRequired with your own x402 client, then retry:
    //   callTool(name, args, { agentId, paymentHeader: '<x-payment header>' })
    console.log('Payment required for', name, '->', result.paymentRequired?.accepts);
    return;
  }

  // 4. Feed the tool output back to the model to finish the turn.
  messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result.body) });
  console.log('Tool result:', result.body);
}

console.log(`DDG base URL: ${DDG_BASE_URL}`);
console.log(`Exposing ${tools.length} DDG tools to the model.`);
main();
