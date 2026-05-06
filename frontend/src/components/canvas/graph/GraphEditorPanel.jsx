import React, { useState } from "react";
import { Plus, Trash2, Eye, EyeOff, RotateCcw, FunctionSquare, MapPin, Search, ChevronRight, Settings2, X } from "lucide-react";
import { GRAPH_COLORS } from "./graphDefaults";

export default function GraphEditorPanel({ element, onChange, zoom = 1, isDark = false, onClose }) {
  const { expressions = [], points = [] } = element;
  const [activeTab, setActiveTab] = useState('functions'); 
  const [searchQuery, setSearchQuery] = useState('');

  const handleUpdateExpr = (id, updates) => {
    const newExprs = expressions.map(ex => ex.id === id ? { ...ex, ...updates } : ex);
    onChange({ expressions: newExprs });
  };

  const handleAddExpr = () => {
    const newId = `expr_${Date.now()}`;
    const color = GRAPH_COLORS[expressions.length % GRAPH_COLORS.length];
    onChange({ 
      expressions: [{ id: newId, latex: "y=", color, visible: true }, ...expressions] 
    });
    setActiveTab('functions');
  };

  const handleRemoveExpr = (id) => {
    onChange({ expressions: expressions.filter(ex => ex.id !== id) });
  };

  const handleUpdatePoint = (id, updates) => {
    const newPoints = points.map(p => p.id === id ? { ...p, ...updates } : p);
    onChange({ points: newPoints });
  };

  const handleAddPoint = () => {
    const newId = `pt_${Date.now()}`;
    const color = GRAPH_COLORS[(points.length + expressions.length) % GRAPH_COLORS.length];
    onChange({ 
      points: [{ id: newId, x: 0, y: 0, label: "P", color, visible: true }, ...points] 
    });
    setActiveTab('points');
  };

  const handleRemovePoint = (id) => {
    onChange({ points: points.filter(p => p.id !== id) });
  };

  const handleResetViewport = () => {
    onChange({ viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 } });
  };

  const filteredExprs = expressions.filter(ex => (ex?.latex || "").toLowerCase().includes((searchQuery || "").toLowerCase()));
  const filteredPoints = points.filter(p => (p?.label || "").toLowerCase().includes((searchQuery || "").toLowerCase()));

  return (
    <div className="flex flex-col h-full">
      {/* Side Panel Header */}
      <div 
        className={`flex items-center justify-between p-5 border-b shrink-0 ${isDark ? "border-white/5" : "border-gray-100"}`}
      >
        <div className="flex flex-col">
          <h4 className="font-bold tracking-tight text-lg">Graph Editor</h4>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={handleResetViewport}
                className={`flex items-center justify-center rounded-lg transition-all active:scale-90 ${isDark ? "hover:bg-white/5 text-gray-500" : "hover:bg-gray-100 text-gray-400"}`} 
                style={{ width: 32, height: 32 }}
                title="Reset View"
            >
                <RotateCcw size={16} />
            </button>
            <button 
                onClick={onClose}
                className={`flex items-center justify-center rounded-lg transition-all active:scale-90 ${isDark ? "hover:bg-red-500/10 text-red-500" : "hover:bg-red-50 text-red-500"}`} 
                style={{ width: 32, height: 32 }}
            >
                <X size={18} />
            </button>
        </div>
      </div>

      {/* Modern Search & Tab Section */}
      <div className={`p-5 pb-2 shrink-0 space-y-3`}>
        <div className={`flex items-center border rounded-xl px-3 transition-all ${isDark ? "bg-black/20 border-white/5" : "bg-gray-50 border-gray-100"}`}>
          <Search size={14} className="text-gray-400 shrink-0" />
          <input 
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent p-2 outline-none text-xs"
          />
        </div>

        <div className={`flex p-1 gap-1 ${isDark ? "bg-white/5" : "bg-gray-50"}`} style={{ borderRadius: 12 }}>
            {[
            { id: 'functions', icon: FunctionSquare, label: 'Functions' },
            { id: 'points', icon: MapPin, label: 'Points' }
            ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all font-semibold ${
                activeTab === tab.id 
                    ? (isDark ? "bg-white/10 text-white" : "bg-white text-blue-600 shadow-sm")
                    : (isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")
                }`}
                style={{ fontSize: 11 }}
            >
                <tab.icon size={12} />
                {tab.label}
            </button>
            ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-5 custom-scrollbar pb-32">
        
        {/* FUNCTIONS VIEW */}
        {activeTab === 'functions' && (
          <div className="flex flex-col space-y-2 mt-2">
            {filteredExprs.map(ex => (
              <div 
                key={ex.id}
                className={`group border-l-2 rounded-lg p-3 transition-all ${isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-transparent shadow-sm"}`}
                style={{ borderLeftColor: ex.color }}
              >
                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    value={ex.latex}
                    onChange={(e) => handleUpdateExpr(ex.id, { latex: e.target.value })}
                    className={`flex-1 bg-transparent font-mono outline-none ${isDark ? "text-gray-200" : "text-gray-700"}`}
                    style={{ fontSize: 13 }}
                  />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleUpdateExpr(ex.id, { visible: !ex.visible })} className={`p-1 rounded hover:bg-black/5 ${ex.visible ? 'text-blue-500' : 'text-gray-400'}`}>
                      {ex.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button onClick={() => handleRemoveExpr(ex.id)} className="p-1 rounded hover:bg-red-500/10 text-red-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* POINTS VIEW */}
        {activeTab === 'points' && (
          <div className="flex flex-col space-y-3 mt-2">
            {filteredPoints.map(p => (
              <div 
                key={p.id}
                className={`flex flex-col rounded-lg p-4 border transition-all ${isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-100"}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <input 
                      type="text" value={p.label}
                      onChange={(e) => handleUpdatePoint(p.id, { label: e.target.value })}
                      className="bg-transparent font-bold outline-none w-20 text-xs"
                    />
                  </div>
                  <button onClick={() => handleRemovePoint(p.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex gap-3">
                  <div className={`flex-1 flex flex-col p-2 rounded-lg ${isDark ? "bg-black/20" : "bg-white border border-gray-100"}`}>
                    <span className="text-[8px] font-bold uppercase opacity-30">X</span>
                    <input 
                      type="number" value={p.x}
                      onChange={(e) => handleUpdatePoint(p.id, { x: parseFloat(e.target.value) || 0 })}
                      className="bg-transparent font-mono w-full outline-none text-xs"
                    />
                  </div>
                  <div className={`flex-1 flex flex-col p-2 rounded-lg ${isDark ? "bg-black/20" : "bg-white border border-gray-100"}`}>
                    <span className="text-[8px] font-bold uppercase opacity-30">Y</span>
                    <input 
                      type="number" value={p.y}
                      onChange={(e) => handleUpdatePoint(p.id, { y: parseFloat(e.target.value) || 0 })}
                      className="bg-transparent font-mono w-full outline-none text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dynamic Floating Action Bar */}
      {activeTab !== 'settings' && (
        <div className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t ${isDark ? "from-[#111111]" : "from-white"} shrink-0`}>
          <button 
            onClick={activeTab === 'functions' ? handleAddExpr : handleAddPoint}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all active:scale-95 text-white ${activeTab === 'functions' ? "bg-blue-600 hover:bg-blue-700" : "bg-purple-600 hover:bg-purple-700"}`}
            style={{ fontSize: 12 }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Add {activeTab === 'functions' ? 'Function' : 'Point'}
          </button>
        </div>
      )}
    </div>
  );
}
