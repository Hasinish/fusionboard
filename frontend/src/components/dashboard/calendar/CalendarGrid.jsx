import React from "react";

export default function CalendarGrid({ currentDate, reminders, onDateClick, onReminderClick, onMoreClick, canEdit, isDark }) {
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  
  const today = new Date();
  const isToday = (day) => {
    return day === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear();
  };

  const getDayReminders = (day) => {
    return reminders.filter(r => {
      const d = new Date(r.date);
      return d.getUTCDate() === day && 
             d.getUTCMonth() === currentDate.getMonth() && 
             d.getUTCFullYear() === currentDate.getFullYear();
    });
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="w-full min-w-[700px] h-full flex flex-col bg-white overflow-hidden shadow-inner">
      {/* Day names header */}
      <div className="grid grid-cols-7 border-b border-[#E8DDD0]">
        {dayNames.map(day => (
          <div key={day} className="py-4 text-center text-[11px] font-black uppercase tracking-[0.2em] text-[#6B6560B3]">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {/* Empty cells for previous month padding */}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-[#FAF8F522] border-r border-b border-[#E8DDD0] opacity-40" />
        ))}

        {/* Days of current month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayReminders = getDayReminders(day);
          const active = isToday(day);
          
          const maxVisible = 3;
          const hasMore = dayReminders.length > maxVisible;
          const visibleReminders = dayReminders.slice(0, hasMore ? maxVisible - 1 : maxVisible);

          return (
            <div 
              key={day} 
              className={`min-h-[140px] p-1 border-r border-b border-[#E8DDD0] transition-colors ${canEdit ? 'hover:bg-[#FDF9F3] cursor-pointer' : 'cursor-default'} flex flex-col relative overflow-hidden group/cell`}
              onClick={() => canEdit && onDateClick(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
            >
              <div className="flex items-start justify-center pt-2 mb-2">
                <span className={`text-[13px] font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                  active 
                  ? "bg-[#244e8a] text-white shadow-lg shadow-[#244e8a]/20" 
                  : `text-[#1A1A2E] ${canEdit ? 'group-hover/cell:bg-[#F5EAD8]' : ''}`
                }`}>
                  {day}
                </span>
              </div>

              <div className="flex-1 space-y-0.5 px-0.5 pb-1">
                {visibleReminders.map(rem => (
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
                      color: rem.completed ? rem.color || "#244e8a" : "white",
                    }}
                    className={`text-[11px] px-2 py-0.5 rounded-md truncate transition-all cursor-pointer font-bold leading-5 shadow-sm hover:brightness-110 active:scale-[0.98] border ${
                      rem.completed ? "line-through opacity-80" : ""
                    }`}
                  >
                    {rem.title}
                  </div>
                ))}
                
                {hasMore && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.closest('div.min-h-\\[140px\\]').getBoundingClientRect();
                      onMoreClick(
                        new Date(currentDate.getFullYear(), currentDate.getMonth(), day),
                        { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
                        dayReminders
                      );
                    }}
                    className="text-[10px] font-bold text-[#6B6560] px-2 py-0.5 hover:bg-[#F5EAD8] rounded-md cursor-pointer transition-colors"
                  >
                    {dayReminders.length - (maxVisible - 1)} more...
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Padding for remaining cells in 6x7 grid */}
        {Array.from({ length: 42 - (daysInMonth + firstDayOfMonth) }).map((_, i) => (
          <div key={`pad-end-${i}`} className="bg-[#FAF8F522] border-r border-b border-[#E8DDD0] opacity-40 last:border-r-0" />
        ))}
      </div>
    </div>
  );
}
