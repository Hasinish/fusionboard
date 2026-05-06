import React, { useEffect, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
});

export default function MermaidRenderer({ code, isDark }) {
  const [svgContent, setSvgContent] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    mermaid.initialize({
      theme: isDark ? "dark" : "default",
    });
    
    let isMounted = true;
    
    const renderDiagram = async () => {
      if (!code || !code.trim()) {
        if (isMounted) {
          setSvgContent("");
          setError("");
        }
        return;
      }
      
      const id = `mermaid-svg-${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        const { svg } = await mermaid.render(id, code);
        if (isMounted) {
          setSvgContent(svg);
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          // Mermaid sometimes throws HTML error messages
          let msg = err.message || "Invalid Mermaid syntax";
          // strip html if present
          msg = msg.replace(/<[^>]*>?/gm, '');
          setError(msg);
        }
      } finally {
        // Clean up Mermaid's temporary DOM nodes, which it leaks on syntax errors
        const node1 = document.getElementById(id);
        if (node1) node1.remove();
        const node2 = document.getElementById(`d${id}`);
        if (node2) node2.remove();
      }
    };

    renderDiagram();
    return () => { isMounted = false; };
  }, [code, isDark]);

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden rounded-lg shadow-xl ${isDark ? 'bg-[#1e1e2e]/70' : 'bg-white/70'} backdrop-blur-sm border ${isDark ? 'border-[#313244]' : 'border-gray-300'}`}>
      <div className="flex-1 w-full h-full overflow-hidden flex items-center justify-center p-4 relative">
        {error && (
          <div className="text-red-500 font-mono text-xs overflow-auto w-full h-full p-2 text-left">
            {error}
          </div>
        )}
        {!error && !svgContent && (
          <div className={`${isDark ? 'text-gray-500' : 'text-gray-400'} font-mono text-sm flex items-center justify-center h-full text-center p-4`}>
            Double click to add Mermaid code<br/>(e.g., graph TD; A--&gt;B;)
          </div>
        )}
        {!error && svgContent && (
          <div 
            className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:!w-auto [&>svg]:!h-auto"
            dangerouslySetInnerHTML={{ __html: svgContent }} 
          />
        )}
      </div>
    </div>
  );
}
