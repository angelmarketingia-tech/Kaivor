import OpenAI from 'openai';

/**
 * Shared LLM client for ADMIA. Uses DeepSeek (OpenAI-compatible, cheap).
 * Centralizes API-key cleanup (PowerShell injects BOM/zero-width chars into env vars).
 */

export function getLlmApiKey(): string {
  // Strip BOM / zero-width / non-breaking space that sneak in via PowerShell env exports.
  return (process.env.DEEPSEEK_API_KEY || '').replace(/[﻿​ ]/g, '').trim();
}

export function getLlmClient(): OpenAI | null {
  const apiKey = getLlmApiKey();
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' });
}

export interface LlmChatResult {
  ok: boolean;
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  error?: string;
}

/**
 * Single-shot chat completion. messages is a standard OpenAI chat array.
 * maxTokens caps the OUTPUT (anti-abuse + cost control).
 */
export async function llmChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  opts: { model?: string; temperature?: number; maxTokens?: number } = {},
): Promise<LlmChatResult> {
  const client = getLlmClient();
  if (!client) {
    return {
      ok: false,
      content: '',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      error: 'DEEPSEEK_API_KEY no está configurada en el servidor.',
    };
  }

  try {
    const res = await client.chat.completions.create({
      model: opts.model || 'deepseek-chat',
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 700,
      messages,
    });
    const content = res.choices?.[0]?.message?.content?.trim() || '';
    const u = res.usage;
    return {
      ok: true,
      content,
      promptTokens: u?.prompt_tokens ?? 0,
      completionTokens: u?.completion_tokens ?? 0,
      totalTokens: u?.total_tokens ?? 0,
    };
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status;
    const detail = e?.error?.message || e?.message || 'sin detalles';
    return {
      ok: false,
      content: '',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      error: `LLM falló: ${detail} (status=${status ?? '?'})`,
    };
  }
}
