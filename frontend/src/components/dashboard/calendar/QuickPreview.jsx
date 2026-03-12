import React, { useEffect, useRef } from "react";
import { X, Trash2, Edit2, AlignLeft, Layout, Check } from "lucide-react";

export default function QuickPreview({ reminder, onClose, onEdit, onDelete, onToggleDone, position, canEdit }) {
  const previewRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (previewRef.current && !previewRef.current.contains(event.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (!reminder) return null;

  const dateStr = new Date(reminder.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const isNearTop = position.y < 350;

  return (
    <div 
      ref={previewRef}
      className="fixed z-[150] bg-white rounded-2xl shadow-2xl border border-[#E8DDD0] w-[400px] overflow-hidden animate-in zoom-in-95 duration-200 quick-preview-popup"
      style={{
        left: position.x,
        top: isNearTop ? position.y + 40 : position.y, // Add offset if showing below
        transform: isNearTop ? 'translate(-50%, 0)' : 'translate(-50%, -100%) translateY(-20px)'
      }}
    >
      <div className="flex items-center justify-end px-4 py-2 border-b border-[#F5EAD8] bg-white gap-1">
        {canEdit && (
          <>
            <button 
              onClick={() => onToggleDone(reminder._id, !reminder.completed)}
              className={`p-2 rounded-full transition-colors ${
                reminder.completed 
                ? "bg-[#244e8a] text-white hover:bg-[#1a3a69]" 
                : "hover:bg-[#F5EAD8] text-[#6B6560] hover:text-[#1A1A2E]"
              }`}
              title={reminder.completed ? "Mark as undone" : "Mark as done"}
            >
              <Check size={16} />
            </button>
            <button 
              onClick={onEdit}
              className="p-2 hover:bg-[#F5EAD8] text-[#6B6560] hover:text-[#1A1A2E] rounded-full transition-colors"
              title="Edit"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={() => onDelete(reminder._id)}
              className="p-2 hover:bg-red-50 text-[#6B6560] hover:text-red-600 rounded-full transition-colors"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
            <div className="w-[1px] h-4 bg-[#E8DDD0] mx-1" />
          </>
        )}
        <button 
          onClick={onClose}
          className="p-2 hover:bg-[#F5EAD8] text-[#6B6560] hover:text-[#1A1A2E] rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex gap-4">
          <div 
            className="w-4 h-4 rounded-md mt-1.5 shrink-0" 
            style={{ backgroundColor: reminder.color || "#244e8a" }} 
          />
          <div className="space-y-1">
            <h3 className={`text-xl font-black text-[#1A1A2E] leading-tight ${reminder.completed ? "line-through opacity-50" : ""}`}>
              {reminder.title}
            </h3>
            <p className="text-sm font-bold text-[#6B6560]">
              {dateStr}
            </p>
          </div>
        </div>

        {reminder.description && (
          <div className="flex gap-4">
            <div className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center">
              <AlignLeft size={16} className="text-[#6B6560]" />
            </div>
            <div className="max-h-[150px] overflow-y-auto w-full custom-scrollbar pr-2">
              <p className="text-[13px] text-[#6B6560] leading-relaxed break-words whitespace-pre-wrap">
                {reminder.description}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <div className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center">
            <Layout size={16} className="text-[#6B6560]" />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-[#1A1A2E]">
              Workspace Reminder
            </p>
            <span className="w-1 h-1 rounded-full bg-[#C8BDB5]" />
            <p className="text-xs font-bold text-[#6B6560] uppercase tracking-wider">
              Calendar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
