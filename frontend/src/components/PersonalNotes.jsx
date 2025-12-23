import { useEffect, useState } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { 
  Plus, StickyNote, X, Bold, Italic, List, 
  ListOrdered, Quote, Eye, Trash2 
} from "lucide-react";
import api from "../lib/api";

export default function PersonalNotes({ boardId, token }) {
  const [notes, setNotes] = useState([]);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [, forceUpdate] = useState(0);

  // --- TIPTAP ---
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2] } })],
    content: "",
    editorProps: {
      attributes: {
        class: 'prose prose-sm focus:outline-none max-w-none',
      },
    },
    onUpdate: ({ editor }) => setNoteContent(editor.getHTML()),
    onTransaction: () => forceUpdate((n) => n + 1),
  });

  useEffect(() => {
    if (editor && !isNoteOpen) {
      editor.commands.clearContent();
      setEditingId(null);
    }
  }, [isNoteOpen, editor]);

  // --- DATA ---
  const loadNotes = async () => {
    if (!token) return;
    try {
      const res = await api.get(`/notes/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotes(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const handleSaveNote = async () => {
    const cleanText = noteContent.replace(/<(.|\n)*?>/g, '').trim();
    if (!cleanText && !noteContent.includes("<img")) return;

    try {
      if (editingId) {
        const res = await api.put(`/notes/${editingId}`, 
          { content: noteContent }, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setNotes(notes.map(n => n._id === editingId ? res.data : n));
      } else {
        const res = await api.post("/notes", 
          { boardId, content: noteContent }, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setNotes([res.data, ...notes]);
      }
      setNoteContent("");
      setEditingId(null);
      setIsNoteOpen(false);
      editor?.commands.clearContent();
    } catch (e) {
      alert("Failed to save note");
    }
  };

  const handleEditNote = (note) => {
    setEditingId(note._id);
    setNoteContent(note.content);
    if (editor) editor.commands.setContent(note.content);
    setIsNoteOpen(true);
  };

  const handleDeleteNote = async (noteId) => {
    if(!confirm("Delete this note?")) return;
    try {
      await api.delete(`/notes/${noteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotes(notes.filter(n => n._id !== noteId));
    } catch (e) {
      alert("Failed to delete note");
    }
  };

  return (
    <>
      <div className="divider">Personal Notes</div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <StickyNote className="text-primary" /> My Notes
          </h2>
          <button 
            className="btn btn-primary btn-sm gap-2"
            onClick={() => {
              if (isNoteOpen) setIsNoteOpen(false);
              else {
                setEditingId(null);
                setNoteContent("");
                editor?.commands.clearContent();
                setIsNoteOpen(true);
              }
            }}
          >
            {isNoteOpen ? "Close Editor" : (
              <> <Plus size={16} /> Take Note </>
            )}
          </button>
        </div>

        {isNoteOpen && (
          <div className="card bg-base-100 shadow-md border border-base-300 overflow-hidden">
            <div className="bg-base-50 p-2 border-b border-base-200 flex justify-between items-center">
              <span className="text-sm font-semibold ml-2">
                {editingId ? "Edit Note" : "New Note"}
              </span>
              <button className="btn btn-ghost btn-xs btn-square" onClick={() => setIsNoteOpen(false)}>
                <X size={14} />
              </button>
            </div>
            
            {editor && (
              <div className="flex items-center gap-1 p-2 bg-white border-b border-base-200">
                <button onClick={() => editor.chain().focus().toggleBold().run()} className={`btn btn-xs btn-square ${editor.isActive('bold') ? 'btn-primary' : 'btn-ghost'}`}><Bold size={14} /></button>
                <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`btn btn-xs btn-square ${editor.isActive('italic') ? 'btn-primary' : 'btn-ghost'}`}><Italic size={14} /></button>
                <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`btn btn-xs btn-square ${editor.isActive('bulletList') ? 'btn-primary' : 'btn-ghost'}`}><List size={14} /></button>
                <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`btn btn-xs btn-square ${editor.isActive('orderedList') ? 'btn-primary' : 'btn-ghost'}`}><ListOrdered size={14} /></button>
                <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`btn btn-xs btn-square ${editor.isActive('blockquote') ? 'btn-primary' : 'btn-ghost'}`}><Quote size={14} /></button>
              </div>
            )}

            <div className="p-4 bg-white">
              <EditorContent editor={editor} />
            </div>

            <div className="p-3 bg-base-50 border-t border-base-200 flex justify-end gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => setIsNoteOpen(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSaveNote}>
                  {editingId ? "Update Note" : "Save Note"}
                </button>
            </div>
          </div>
        )}

        {notes.length === 0 ? (
          <p className="text-neutral-500 text-sm text-center py-6 italic bg-base-100 rounded-lg border border-dashed border-base-300">
            You haven't taken any notes for this board yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notes.map((note) => (
              <div key={note._id} className="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition h-64 flex flex-col">
                <div className="card-body p-4 flex flex-col h-full">
                  <div className="note-content prose prose-sm max-w-none mb-2 flex-1 overflow-hidden relative">
                    <div dangerouslySetInnerHTML={{ __html: note.content }} />
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-base-100 to-transparent pointer-events-none"></div>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-base-100 text-xs text-neutral-400 shrink-0">
                    <span>{new Date(note.createdAt).toLocaleString()}</span>
                    <div className="flex items-center gap-1">
                      <button className="btn btn-ghost btn-xs text-primary" onClick={() => handleEditNote(note)} title="View / Edit"><Eye size={14} /></button>
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDeleteNote(note._id)} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}