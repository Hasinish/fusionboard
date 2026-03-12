import React, { useEffect, useRef } from "react";
import { X, Plus } from "lucide-react";

export default function DayRemindersList({ date, reminders, onClose, onReminderClick, onCreateClick, position, canEdit }) {
  const listRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (event.target.closest('.quick-preview-popup')) return;
      if (event.target.closest('.reminder-modal-popup')) return;
      if (listRef.current && !listRef.current.contains(event.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (!date) return null;

  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div 
      ref={listRef}
      className="fixed z-[140] bg-white rounded-2xl shadow-2xl border border-[#E8DDD0] w-[280px] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className="px-5 py-4 flex items-center justify-between border-b border-[#F5EAD8]">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#6B6560B3]">
            {date.toLocaleDateString("en-US", { weekday: "short" })}
          </p>
          <h3 className="text-xl font-black text-[#1A1A2E]">
            {date.getDate()}
          </h3>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-[#F5EAD8] text-[#6B6560] hover:text-[#1A1A2E] rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {reminders.map(rem => (
          <div 
            key={rem._id}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              onReminderClick(rem, { x: rect.left + rect.width / 2, y: rect.top });
            }}
            style={{ 
              backgroundColor: rem.completed ? `${rem.color || "#244e8a"}15` : (rem.color || "#244e8a"),
              borderColor: rem.completed ? rem.color || "#244e8a" : "transparent",
              borderWidth: rem.completed ? "1px" : "0px",
              color: rem.completed ? rem.color || "#244e8a" : "white"
            }}
            className={`text-[12px] px-3 py-2 rounded-lg truncate transition-all cursor-pointer font-bold shadow-sm hover:brightness-110 active:scale-[0.98] border ${
              rem.completed ? "line-through opacity-80" : ""
            }`}
          >
            {rem.title}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="p-2 border-t border-[#F5EAD8]">
          <button 
            onClick={() => onCreateClick(date)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest text-[#244e8a] hover:bg-[#244e8a]/5 rounded-xl transition-all"
          >
            <Plus size={16} />
            Add Reminder
          </button>
        </div>
      )}
    </div>
  );
}
