import type { ChatMessage } from '@kern/contracts';

/**
 * The model gateway is provider-agnostic (doc 3: "swap models without
 * rewriting product logic"). Everything above this interface speaks KERN
 * contracts; only the provider implementation knows an SDK.
 */
export interface GatewayRequest {
  system: string;
  messages: ChatMessage[];
}

/** Token/usage trace for observability (doc 3 Phase 0: "token traces"). */
export interface ModelUsage {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface GatewayReply {
  text: string;
  usage?: ModelUsage;
}

export interface ModelGateway {
  /** Human-readable provider + model, e.g. "anthropic:claude-opus-5" or "mock". */
  readonly name: string;
  chat(req: GatewayRequest): Promise<GatewayReply>;
}
