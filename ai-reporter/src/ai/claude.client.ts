import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import type { NewsItem } from '../types';

// Extracts the outermost JSON object by tracking brace depth.
// Unlike lastIndexOf('}'), this correctly handles truncated responses
// where the last '}' in the string belongs to a nested object, not the root.
function extractOutermostJson(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) return text;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  // Truncated — return everything from start so the parse error is informative
  console.warn('[Claude] JSON appears truncated — brace depth never reached 0');
  return text.slice(start);
}

const client = new Anthropic({ apiKey: config.anthropicApiKey });

export async function classifyNewsWithHaiku(news: NewsItem[]): Promise<NewsItem[]> {
  if (news.length === 0) return [];
  try {
    const headlineList = news.map((n, i) => `${i + 1}. [${n.relevantCurrencies.join(',')}] ${n.headline}`).join('\n');
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Classify each forex news headline. Return ONLY a JSON array of objects with keys "index" (1-based), "type" ("FUNDAMENTAL" or "SHOCK"), and "reason" (max 8 words).

FUNDAMENTAL = changes central bank policy, rate decisions, major economic data surprises, geopolitical events with lasting economic impact.
SHOCK = political statement, speech, tweet, rumor, short-term market reaction with no lasting policy change.

Headlines:
${headlineList}`,
      }],
    });

    const text = (message.content[0] as any).text as string;
    const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const classifications: Array<{ index: number; type: string; reason: string }> = JSON.parse(clean);

    return news.map((n, i) => {
      const cls = classifications.find(c => c.index === i + 1);
      return {
        ...n,
        fundamentalChange: cls?.type === 'FUNDAMENTAL',
        headlineShockOnly: cls?.type === 'SHOCK',
        classificationReason: cls?.reason,
      } as NewsItem & { fundamentalChange: boolean; headlineShockOnly: boolean; classificationReason: string };
    });
  } catch (err: any) {
    console.warn('[Haiku] News classification failed:', err.message);
    return news; // degrade gracefully — main model classifies itself
  }
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    if (message.stop_reason === 'max_tokens') {
      console.error(`[Claude] Response hit max_tokens limit (${message.usage.output_tokens} tokens used) — JSON WILL be truncated. Increase max_tokens.`);
    }

    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    const raw = textContent.text;

    // Strip markdown fences if present
    const stripped = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

    // Extract the outermost JSON object by tracking brace depth
    // (lastIndexOf('}') is wrong when response is truncated — it finds a nested closing brace)
    const cleanedContent = extractOutermostJson(stripped);

    return {
      content: cleanedContent,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}
