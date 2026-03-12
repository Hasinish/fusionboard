import React, { useState, useEffect } from "react";
import { X, Calendar as CalendarIcon, AlignLeft, Check } from "lucide-react";

export default function ReminderModal({ isOpen, onClose, selectedDate, reminder, onSave, onDelete, isDark }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [completed, setCompleted] = useState(false);
  const [color, setColor] = useState("#244e8a");

  const colors = [
    "#244e8a", // Blue
    "#d50000", // Red
    "#f4511e", // Orange
    "#f6bf26", // Yellow
    "#33b679", // Green
    "#0b8043", // Dark Green
    "#039be5", // Light Blue
    "#3f51b5", // Indigo
    "#7986cb", // Light Indigo
    "#8e24aa", // Purple
    "#616161", // Gray
  ];

  const formatDateForInput = (dateObj) => {
    if (!dateObj) return "";
    const d = new Date(dateObj);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (reminder) {
      setTitle(reminder.title);
      setDescription(reminder.description || "");
      setDate(formatDateForInput(reminder.date));
      setCompleted(reminder.completed || false);
      setColor(reminder.color || "#244e8a");
    } else if (selectedDate) {
      setTitle("");
      setDescription("");
      setDate(formatDateForInput(selectedDate));
      setCompleted(false);
      setColor("#244e8a");
    }
  }, [reminder, selectedDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ title, description, date, completed, color });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300 reminder-modal-popup">
      <div 
        className="bg-white w-full max-w-lg rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 py-4 flex items-center justify-between border-b border-[#F5EAD8]">
           <h3 className="text-lg font-bold text-[#1A1A2E]">
              {reminder ? "Edit reminder" : "Create reminder"}
           </h3>
           <button onClick={onClose} className="p-2 hover:bg-[#F5EAD8] rounded-full transition-colors text-[#6B6560]">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="space-y-6">
            <div className="relative group">
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add title"
                className="w-full bg-transparent border-b-2 border-[#E8DDD0] focus:border-[#244e8a] px-0 py-2 text-2xl font-semibold text-[#1A1A2E] placeholder-[#C8BDB5] outline-none transition-all"
                autoFocus
                required
              />
            </div>

            <div className="flex items-center gap-6">
               <CalendarIcon size={20} className="text-[#6B6560] shrink-0" />
               <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-[#FAF8F5] border border-[#E8DDD0] rounded-xl px-4 py-2 text-sm font-bold text-[#1A1A2E] outline-none focus:ring-2 focus:ring-[#244e8a]/20"
                  required
                />
            </div>

            <div className="flex items-start gap-6">
               <AlignLeft size={20} className="text-[#6B6560] mt-3 shrink-0" />
               <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add description"
                  className="w-full bg-[#FAF8F5] border border-[#E8DDD0] rounded-xl px-4 py-3 text-sm font-medium text-[#1A1A2E] placeholder-[#C8BDB5] outline-none focus:ring-2 focus:ring-[#244e8a]/20 min-h-[120px] resize-none"
                />
            </div>

            <div className="flex items-center gap-6">
               <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: color }} />
               <div className="flex flex-wrap gap-2.5">
                  {colors.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full transition-all hover:scale-125 hover:shadow-md ${
                        color === c ? 'ring-2 ring-offset-2 ring-[#1A1A2E] scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
               </div>
            </div>

            {reminder && (
              <div className="flex items-center gap-6">
                 <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                    <Check size={18} className={completed ? "text-green-600" : "text-[#C8BDB5]"} />
                 </div>
                 <button
                    type="button"
                    onClick={() => setCompleted(!completed)}
                    className="text-sm font-bold text-[#6B6560] hover:text-[#1A1A2E] transition-colors"
                  >
                    Mark as {completed ? "pending" : "completed"}
                  </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            {reminder && (
              <button
                type="button"
                onClick={() => onDelete(reminder._id)}
                className="px-6 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                Delete
              </button>
            )}
            <button 
              type="submit"
              className="px-8 py-2.5 bg-[#1A1A2E] text-white rounded-xl font-bold text-sm hover:bg-[#2d2d4e] transition-all shadow-lg shadow-[#1A1A2E]/20"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
