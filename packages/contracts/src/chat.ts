import { z } from 'zod';
import { PageContextSchema } from './page-context.js';

/**
 * Walking-skeleton API contract: POST /chat.
 * The SDK sends the compact page model with every message so the assistant
 * is always anchored to what the visitor is actually looking at.
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  session_id: z.string().min(1),
  site_id: z.string().min(1),
  page_context: PageContextSchema,
  message: z.string().min(1).max(4000),
  history: z.array(ChatMessageSchema).max(20).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const AssistantModeSchema = z.enum(['answer', 'guide', 'ask', 'handoff']);
export type AssistantMode = z.infer<typeof AssistantModeSchema>;

export const ChatResponseSchema = z.object({
  message_id: z.string().min(1),
  reply: z.string().min(1).max(8000),
  mode: AssistantModeSchema,
  citations: z.array(z.string().max(500)).max(10).optional(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
