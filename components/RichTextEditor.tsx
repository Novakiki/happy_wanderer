'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
};

export default function RichTextEditor({ value, onChange, placeholder, className, minHeight = '100px' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-2 border-white/20 pl-4 italic',
          },
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#e8b4a0] underline',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'before:content-[attr(data-placeholder)] before:text-white/30 before:float-left before:h-0 before:pointer-events-none',
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: `prose prose-invert prose-sm max-w-none focus:outline-none`,
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  return (
    <div className={className}>
      <div className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
