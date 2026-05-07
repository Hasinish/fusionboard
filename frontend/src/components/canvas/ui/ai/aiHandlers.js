import { DEFAULT_ELEMENT_STYLES } from "../../constants";
import { uid } from "../../BoardElement";

/**
 * Processes a single tool call from the AI and returns the corresponding whiteboard element.
 * Some tools (like delete/update) are handled via side effects (boardActions).
 */
export const processToolCall = (call, worldPos, isDark, offset, boardActions) => {
    const args = call.args;
    const newId = uid();
    let element = null;

    if (call.name === "create_shape") {
        const defaults = DEFAULT_ELEMENT_STYLES[args.shapeType] || {};
        const fill = args.fill || defaults.fill;
        const hasFill = fill && fill !== "transparent" && fill !== "none";
        
        // Auto-calculate readable text color: white for filled shapes, or theme-aware for empty ones
        const autoTextColor = hasFill ? "#ffffff" : (isDark ? "#ffffff" : "#1e1e1e");
        
        element = {
            ...defaults,
            id: newId,
            type: args.shapeType,
            x: args.x !== undefined ? args.x : (worldPos.x - ((args.width || 200) / 2) + offset),
            y: args.y !== undefined ? args.y : (worldPos.y - ((args.height || 200) / 2) + offset),
            w: args.width || 200,
            h: args.height || 200,
            text: args.text || "",
            textColor: args.textColor || autoTextColor,
            fontSize: args.fontSize || 18, // Slightly larger default for AI shapes
            rotation: 0,
            locked: false
        };
        if (args.color) element.stroke = args.color;
        if (args.fill) element.fill = args.fill;
    } else if (call.name === "create_sticky") {
        element = {
            ...DEFAULT_ELEMENT_STYLES.sticky,
            id: newId,
            type: "sticky",
            x: args.x !== undefined ? args.x : (worldPos.x - 100 + offset),
            y: args.y !== undefined ? args.y : (worldPos.y - 100 + offset),
            w: 200,
            h: 200,
            text: args.text,
            locked: false
        };
        if (args.color) element.fill = args.color;
    } else if (call.name === "create_text") {
        const darkOverrides = isDark ? { textColor: "#ffffff" } : {};
        element = {
            ...DEFAULT_ELEMENT_STYLES.text,
            ...darkOverrides,
            id: newId,
            type: "text",
            x: args.x !== undefined ? args.x : (worldPos.x - 100 + offset),
            y: args.y !== undefined ? args.y : (worldPos.y - 20 + offset),
            w: 200,
            h: 50,
            text: args.text,
            fontSize: args.fontSize || 20,
            locked: false
        };
    } else if (call.name === "create_arrow") {
        const darkOverrides = isDark ? { stroke: "#ffffff", textColor: "#ffffff" } : {};
        element = {
            ...DEFAULT_ELEMENT_STYLES.arrow,
            ...darkOverrides,
            id: newId,
            type: "arrow",
            x: args.x !== undefined ? args.x : (worldPos.x - 100 + offset),
            y: args.y !== undefined ? args.y : (worldPos.y + offset),
            w: args.w || 200,
            h: 40,
            rotation: args.rotation || 0,
            locked: false
        };
        if (args.color) element.stroke = args.color;
    } else if (call.name === "create_mermaid") {
        const darkOverrides = isDark ? { stroke: "#ffffff", color: "#ffffff", textColor: "#ffffff" } : {};
        element = {
            ...DEFAULT_ELEMENT_STYLES.text,
            ...darkOverrides,
            id: newId,
            type: "mermaid",
            x: args.x !== undefined ? args.x : (worldPos.x - 200 + offset),
            y: args.y !== undefined ? args.y : (worldPos.y - 150 + offset),
            w: 400,
            h: 300,
            text: args.code, // mermaid component uses text prop
            locked: false
        };
    } else if (call.name === "create_video") {
        let videoId = "";
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = (args.url || "").match(regExp);
        if (match && match[2].length === 11) {
            videoId = match[2];
        }
        element = {
            ...DEFAULT_ELEMENT_STYLES.video,
            id: newId,
            type: "video",
            x: args.x !== undefined ? args.x : (worldPos.x - 240 + offset),
            y: args.y !== undefined ? args.y : (worldPos.y - 135 + offset),
            w: 480,
            h: 270,
            url: args.url,
            videoId: videoId,
            locked: false
        };
    } else if (call.name === "create_code") {
        element = {
            ...DEFAULT_ELEMENT_STYLES.code,
            id: newId,
            type: "code",
            x: args.x !== undefined ? args.x : (worldPos.x - 200 + offset),
            y: args.y !== undefined ? args.y : (worldPos.y - 150 + offset),
            w: 400,
            h: 300,
            code: args.code,
            language: args.language,
            locked: false
        };
    } else if (call.name === "delete_elements") {
        if (args.elementIds && Array.isArray(args.elementIds)) {
            args.elementIds.forEach(id => boardActions.deleteElement(id));
        }
    } else if (call.name === "update_elements") {
        if (args.updates && Array.isArray(args.updates)) {
            args.updates.forEach(update => {
                if (update.id) {
                    const cleanUpdate = { ...update };
                    delete cleanUpdate.id; // remove id from the update payload itself
                    boardActions.updateElement(update.id, cleanUpdate);
                }
            });
        }
    } else if (call.name === "create_line") {
        const darkOverrides = isDark ? { stroke: "#ffffff" } : {};
        element = {
            ...DEFAULT_ELEMENT_STYLES.line,
            ...darkOverrides,
            id: newId,
            type: "line",
            x: args.x !== undefined ? args.x : (worldPos.x - 100 + offset),
            y: args.y !== undefined ? args.y : (worldPos.y + offset),
            w: args.w || 200,
            h: 4,
            rotation: args.rotation || 0,
            locked: false
        };
        if (args.color) element.stroke = args.color;
    } else if (call.name === "create_graph") {
        const colors = ["#2563eb", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
        const inputExprs = Array.isArray(args.expressions) ? args.expressions : [args.latex || "y=x"];
        
        element = {
            ...DEFAULT_ELEMENT_STYLES.graph,
            id: newId,
            type: "graph",
            x: args.x !== undefined ? args.x : (worldPos.x - 200 + offset),
            y: args.y !== undefined ? args.y : (worldPos.y - 150 + offset),
            w: 400,
            h: 300,
            viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
            grid: { show: true, step: 1 },
            expressions: inputExprs.map((latex, idx) => ({
                id: uid(),
                latex,
                color: colors[idx % colors.length],
                visible: true
            })),
            points: [],
            ui: { showGrid: true, showAxes: true, showLabels: true },
            locked: false
        };
    }

    return element;
};
