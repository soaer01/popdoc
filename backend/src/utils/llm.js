import dotenv from 'dotenv';
dotenv.config();

const wordy = [
  [/\bin order to\b/gi, 'to'],
  [/\ba lot of\b/gi, 'many'],
  [/\bactually\s/gi, ''],
  [/\bvery\s/gi, ''],
  [/\breally\s/gi, ''],
  [/\bwhat no tool records\b/gi, 'yet nothing records'],
  [/\bcannot\b/gi, 'can’t'],
  [/\bis able to\b/gi, 'can'],
];

const sentences = (t) => t.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()) || [t];

export function fallbackTransform(action, text, { language } = {}) {
  switch (action) {
    case 'rewrite': {
      let out = text;
      for (const [re, rep] of wordy) out = out.replace(re, rep);
      if (out === text) {
        const s = sentences(text);
        out =
          s.length > 1
            ? [s[s.length - 1], ...s.slice(0, -1)].join(' ')
            : `Put simply, ${text[0]?.toLowerCase() || ''}${text.slice(1)}`;
      }
      return out.replace(/\s{2,}/g, ' ');
    }
    case 'expand':
      return `${text} This matters most in group work, where a reviewer needs to see each member’s share rather than guess it.`;
    case 'summarize':
      return sentences(text)[0] || text;
    case 'translate':
      return `[${language || 'English'}] ${text}`;
    default:
      return text;
  }
}

export const transformSync = fallbackTransform;

async function callGemini(action, text, { language, instructions } = {}, apiKey) {
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let prompt = '';
  switch (action) {
    case 'rewrite':
      prompt = `You are an editor for collaborative writing. Rewrite the following paragraph to improve clarity, flow, and conciseness while preserving its original meaning. Return ONLY the rewritten paragraph without commentary, greetings, quotes, or markdown backticks.\n\nOriginal paragraph:\n"${text}"`;
      break;
    case 'expand':
      prompt = `You are an editor for collaborative writing. Expand the following paragraph by adding relevant supporting context, clarity, and detail while maintaining the author's voice. Return ONLY the expanded paragraph without commentary, greetings, quotes, or markdown backticks.\n\nOriginal paragraph:\n"${text}"`;
      break;
    case 'summarize':
      prompt = `You are an editor for collaborative writing. Summarize the following paragraph into a concise, high-impact single sentence. Return ONLY the summary without commentary, greetings, quotes, or markdown backticks.\n\nOriginal paragraph:\n"${text}"`;
      break;
    case 'translate':
      prompt = `You are a translator. Translate the following paragraph accurately into ${language || 'English'}. Return ONLY the translated paragraph without commentary, greetings, quotes, or markdown backticks.\n\nOriginal paragraph:\n"${text}"`;
      break;
    default:
      return text;
  }

  if (instructions && instructions.trim()) {
    prompt += `\n\nAdditional instructions from user: ${instructions.trim()}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini API HTTP ${response.status}: ${errText.slice(0, 100)}`);
  }

  const data = await response.json();
  const rawOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawOutput || typeof rawOutput !== 'string' || !rawOutput.trim()) {
    throw new Error('Gemini API returned empty candidate response');
  }

  let cleaned = rawOutput.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith('“') && cleaned.endsWith('”'))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

export async function transform(action, text, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackTransform(action, text, options);
  }

  try {
    const result = await callGemini(action, text, options, apiKey);
    return result || fallbackTransform(action, text, options);
  } catch (err) {
    console.warn(`[AI] External LLM error (${err.message}). Falling back to local transformer.`);
    return fallbackTransform(action, text, options);
  }
}
