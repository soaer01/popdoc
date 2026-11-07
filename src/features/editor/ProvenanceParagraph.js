// Paragraph node that remembers where its text came from.
// pid keeps a paragraph's identity across commits so diffs and merges can line paragraphs up.
import Paragraph from '@tiptap/extension-paragraph';

export const ProvenanceParagraph = Paragraph.extend({
  addAttributes() {
    return {
      pid: { default: null, keepOnSplit: false, renderHTML: (a) => (a.pid ? { 'data-pid': a.pid } : {}) },
      origin: {
        default: 'typed',
        keepOnSplit: false,
        renderHTML: (a) => ({ class: `para origin-${a.origin}`, 'data-origin': a.origin }),
      },
      authorId: { default: null, keepOnSplit: false, renderHTML: () => ({}) },
    };
  },
});
