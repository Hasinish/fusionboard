import React from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown } from "lucide-react";

export default function CalendarHeader({ currentDate, onPrev, onNext, onJump, isDark }) {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 101 }, (_, i) => currentYear - 50 + i);

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E8DDD0]">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A1A2E] rounded-xl flex items-center justify-center shadow-lg shadow-[#1A1A2E]/10">
            <CalendarIcon size={20} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <h2 className="text-xl font-black text-[#1A1A2E] tracking-tight">
              Calendar
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#F9F6F1] p-1.5 rounded-2xl border border-[#E8DDD0]">
          <div className="relative group">
            <select 
              value={currentDate.getMonth()}
              onChange={(e) => onJump(parseInt(e.target.value), currentDate.getFullYear())}
              className="bg-transparent text-sm font-black text-[#1A1A2E] outline-none cursor-pointer pl-3 pr-8 py-1.5 hover:text-[#244e8a] transition-colors appearance-none relative z-10"
            >
              {monthNames.map((month, i) => (
                <option key={month} value={i}>{month}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B6560] pointer-events-none group-hover:text-[#244e8a] transition-colors" />
          </div>
          
          <div className="w-[1px] h-4 bg-[#E8DDD0] mx-1" />
          
          <div className="relative group">
            <select 
              value={currentDate.getFullYear()}
              onChange={(e) => onJump(currentDate.getMonth(), parseInt(e.target.value))}
              className="bg-transparent text-sm font-black text-[#1A1A2E] outline-none cursor-pointer pl-3 pr-8 py-1.5 hover:text-[#244e8a] transition-colors appearance-none relative z-10"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B6560] pointer-events-none group-hover:text-[#244e8a] transition-colors" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={() => onJump(new Date().getMonth(), new Date().getFullYear())}
          className="px-5 py-2 text-xs font-black uppercase tracking-widest text-[#1A1A2E] bg-white border border-[#E8DDD0] rounded-xl hover:bg-[#F9F6F1] transition-all active:scale-95 shadow-sm"
        >
          Today
        </button>

        <div className="flex items-center gap-1">
          <button 
            onClick={onPrev}
            className="p-2.5 hover:bg-[#F9F6F1] text-[#1A1A2E] rounded-xl transition-all active:scale-90 border border-transparent hover:border-[#E8DDD0]"
          >
            <ChevronLeft size={22} />
          </button>
          <button 
            onClick={onNext}
            className="p-2.5 hover:bg-[#F9F6F1] text-[#1A1A2E] rounded-xl transition-all active:scale-90 border border-transparent hover:border-[#E8DDD0]"
          >
            <ChevronRight size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
