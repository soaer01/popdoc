// Stand-in for the server-side LLM call. The real backend will call an LLM API from a
// background worker; these deterministic edits just make the flow demonstrable offline.

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

export function transform(action, text, { language } = {}) {
  switch (action) {
    case 'rewrite': {
      let out = text;
      for (const [re, rep] of wordy) out = out.replace(re, rep);
      if (out === text) {
        const s = sentences(text);
        out = s.length > 1 ? [s[s.length - 1], ...s.slice(0, -1)].join(' ') : `Put simply, ${text[0].toLowerCase()}${text.slice(1)}`;
      }
      return out.replace(/\s{2,}/g, ' ');
    }
    case 'expand':
      return `${text} This matters most in group work, where a reviewer needs to see each member’s share rather than guess it.`;
    case 'summarize':
      return sentences(text)[0];
    case 'translate':
      return `[${language || 'English'}] ${text}`;
    default:
      return text;
  }
}
