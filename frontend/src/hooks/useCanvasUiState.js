import { useState, useEffect, useRef } from "react";

/**
 * Hook to manage UI-specific state like popups, layout, and ephemeral visuals.
 */
export function useCanvasUiState() {
    // Popup states
    const [shapesOpen, setShapesOpen] = useState(false);
    const [plusOpen, setPlusOpen] = useState(false);
    const [colorOpen, setColorOpen] = useState(false);

    // Refs for click-outside detection
    const shapesRef = useRef(null);
    const plusRef = useRef(null);
    const colorRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            const shapesPopup = document.getElementById('shapes-popup');
            if (shapesRef.current && !shapesRef.current.contains(e.target) && (!shapesPopup || !shapesPopup.contains(e.target))) setShapesOpen(false);

            const plusPopup = document.getElementById('plus-popup');
            if (plusRef.current && !plusRef.current.contains(e.target) && (!plusPopup || !plusPopup.contains(e.target))) setPlusOpen(false);

            const colorPopup = document.getElementById('color-popup');
            if (colorRef.current && !colorRef.current.contains(e.target) && (!colorPopup || !colorPopup.contains(e.target))) setColorOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Minimap state
    const [isMinimapVisible, setIsMinimapVisible] = useState(true);
    const minimapCanvasRef = useRef(null);
    const minimapCtxRef = useRef(null);

    // Layout and responsive state
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toolbarRef = useRef(null);
    const [toolbarHeight, setToolbarHeight] = useState(80);
    useEffect(() => {
        if (!toolbarRef.current) return;
        const obs = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setToolbarHeight(entry.target.offsetHeight);
            }
        });
        obs.observe(toolbarRef.current);
        return () => obs.disconnect();
    }, []);

    // Ephemeral visual state
    const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
    const [statusMsg, setStatusMsg] = useState("");

    return {
        shapesOpen, setShapesOpen, shapesRef,
        plusOpen, setPlusOpen, plusRef,
        colorOpen, setColorOpen, colorRef,
        isMinimapVisible, setIsMinimapVisible, minimapCanvasRef, minimapCtxRef,
        isMobile,
        toolbarRef, toolbarHeight,
        mousePos, setMousePos,
        statusMsg, setStatusMsg
    };
}

export default useCanvasUiState;
