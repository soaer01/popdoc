import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { ProvenanceParagraph } from './ProvenanceParagraph.js';
import { toDoc } from './paragraphs.js';
import './Editor.css';

// Mark the paragraphs a paste landed in, once the paste has been applied.
function flagPaste(view, from) {
  setTimeout(() => {
    const { state } = view;
    const to = state.selection.to;
    const tr = state.tr;
    state.doc.nodesBetween(Math.min(from, to), Math.max(from, to), (node, pos) => {
      if (node.type.name === 'paragraph' && node.textContent.trim()) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, origin: 'pasted' });
      }
    });
    if (tr.docChanged) view.dispatch(tr);
  }, 0);
}

export default function Editor({ paragraphs, editable, onChange, onPaste }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
        heading: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
      }),
      ProvenanceParagraph,
      Placeholder.configure({ placeholder: 'Start writing your draft. Only you can see this branch.' }),
    ],
    content: toDoc(paragraphs),
    editable,
    editorProps: {
      attributes: { class: 'prose', 'aria-label': 'Document text' },
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain') || '';
        if (text.trim()) {
          flagPaste(view, view.state.selection.from);
          onPaste?.(text);
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return <EditorContent editor={editor} className={`editor ${editable ? '' : 'is-readonly'}`} />;
}
