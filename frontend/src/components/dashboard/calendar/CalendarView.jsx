import React, { useState } from "react";
import { useReminders } from "../../../hooks/useReminders";
import CalendarHeader from "./CalendarHeader";
import CalendarGrid from "./CalendarGrid";
import ReminderModal from "./ReminderModal";
import QuickPreview from "./QuickPreview";
import DayRemindersList from "./DayRemindersList";

export default function CalendarView({ workspaceId, myRole, isDark }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDayList, setShowDayList] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [dayListPosition, setDayListPosition] = useState({ x: 0, y: 0 });
  const [dayListReminders, setDayListReminders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingReminder, setEditingReminder] = useState(null);
  
  const canEdit = myRole === "owner" || myRole === "editor";
  const { reminders, addReminder, updateReminder, deleteReminder } = useReminders(workspaceId);

  const handleJump = (month, year) => {
    setCurrentDate(new Date(year, month, 1));
    setShowPreview(false);
    setShowDayList(false);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setShowPreview(false);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setShowPreview(false);
  };

  const handleDateClick = (date) => {
    if (!canEdit) return;
    setSelectedDate(date);
    setEditingReminder(null);
    setShowPreview(false);
    setShowModal(true);
  };

  const handleReminderClick = (reminder, position) => {
    setEditingReminder(reminder);
    setPreviewPosition(position);
    setShowPreview(true);
  };

  const handleMoreClick = (date, position, dayReminders) => {
    setSelectedDate(date);
    setDayListPosition(position);
    setDayListReminders(dayReminders);
    setShowPreview(false);
    setShowDayList(true);
  };

  const handleEditFromPreview = () => {
    if (!canEdit) return;
    setShowPreview(false);
    setShowModal(true);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl overflow-hidden shadow-xl border border-[#E8DDD0] relative">
      <CalendarHeader 
        currentDate={currentDate} 
        onPrev={handlePrevMonth} 
        onNext={handleNextMonth} 
        onJump={handleJump}
        isDark={isDark}
      />
      
      <div className="flex-1 overflow-auto bg-[#F9F6F1]">
        <CalendarGrid 
          currentDate={currentDate}
          reminders={reminders}
          onDateClick={handleDateClick}
          onReminderClick={handleReminderClick}
          onMoreClick={handleMoreClick}
          canEdit={canEdit}
          isDark={isDark}
        />
      </div>

      <QuickPreview 
        reminder={showPreview ? editingReminder : null}
        position={previewPosition}
        canEdit={canEdit}
        onClose={() => setShowPreview(false)}
        onEdit={handleEditFromPreview}
        onToggleDone={async (id, completed) => {
          try {
            const updated = await updateReminder(id, { completed });
            if (showPreview && editingReminder?._id === id) {
              setEditingReminder(updated);
            }
            // Update the day list state to reflect changes instantly
            setDayListReminders(prev => prev.map(r => r._id === id ? updated : r));
          } catch (err) {
            alert(err.message || "Failed to update reminder");
          }
        }}
        onDelete={async (id) => {
          try {
            await deleteReminder(id);
            setShowPreview(false);
            // Remove the deleted reminder from the day list state
            setDayListReminders(prev => prev.filter(r => r._id !== id));
          } catch (err) {
            alert(err.message || "Failed to delete reminder");
          }
        }}
      />

      <DayRemindersList 
        date={showDayList ? selectedDate : null}
        reminders={dayListReminders}
        position={dayListPosition}
        canEdit={canEdit}
        onClose={() => setShowDayList(false)}
        onReminderClick={handleReminderClick}
        onCreateClick={handleDateClick}
      />

      <ReminderModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        selectedDate={selectedDate}
        reminder={editingReminder}
        onSave={async (data) => {
          try {
            if (editingReminder) {
              const updated = await updateReminder(editingReminder._id, data);
              // Update list if open
              setDayListReminders(prev => prev.map(r => r._id === editingReminder._id ? updated : r));
            } else {
              const created = await addReminder(data);
              // If the day list is open for this specific date, add it to the view
              if (showDayList && selectedDate && created) {
                const createdDate = new Date(created.date);
                if (createdDate.getUTCDate() === selectedDate.getDate() && 
                    createdDate.getUTCMonth() === selectedDate.getMonth() && 
                    createdDate.getUTCFullYear() === selectedDate.getFullYear()) {
                  setDayListReminders(prev => [...prev, created]);
                }
              }
            }
            setShowModal(false);
          } catch (err) {
            alert(err.message || "Failed to save reminder");
          }
        }}
        onDelete={async (id) => {
          try {
            await deleteReminder(id);
            setShowModal(false);
            // Also update the day list if open
            setDayListReminders(prev => prev.filter(r => r._id !== id));
          } catch (err) {
            alert(err.message || "Failed to delete reminder");
          }
        }}
        isDark={isDark}
      />
    </div>
  );
}
