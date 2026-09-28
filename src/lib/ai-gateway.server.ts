import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

function createRunIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get(RUN_ID_HEADER)?.trim() || undefined;
    return res;
  };
}

export class GatewayError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Streams a Responses call through the Lovable AI Gateway and returns the final text. */
export async function generateTextViaGateway(messages: ModelMessage[]): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new GatewayError(401, "AI is not configured.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: createRunIdFetch(),
  });
  let failure: unknown;
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    messages,
    onError: ({ error }) => {
      failure = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  let text = "";
  for await (const chunk of result.textStream) text += chunk;
  if (failure || !text) {
    const status = (failure as { statusCode?: number } | undefined)?.statusCode ?? 500;
    if (status === 429) throw new GatewayError(429, "The assistant is busy. Please try again in a moment.");
    if (status === 402) throw new GatewayError(402, "The assistant is unavailable right now (AI credits exhausted).");
    if (status === 403) throw new GatewayError(403, "The assistant can't help with that request.");
    throw new GatewayError(status, "The assistant couldn't answer. Please try again.");
  }
  return text;
}
