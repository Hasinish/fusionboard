import { useCallback } from 'react';

/**
 * Provides handlers for code editor key interactions (auto-indent, tabs).
 * @param {object} params
 * @param {string} params.code Current code value
 * @param {function} params.onChange Callback with new code
 * @param {React.RefObject} params.textareaRef Ref to the textarea element
 */
export function useCodeEditorIndentation({ code, onChange, textareaRef }) {
    const handleKeyDown = useCallback((e) => {
        // Prevent default only if we handle the key
        // But for Enter/Tab we usually want to prevent default behavior of form/textarea

        if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation(); // Stop event from bubbling to canvas (tool switching etc)

            const textarea = e.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            // Simple 2-space indentation
            const indent = '  ';
            const newValue = code.substring(0, start) + indent + code.substring(end);
            
            // We need to update state and then restore cursor
            // React state updates are async, so we use requestAnimationFrame or layout effect in parent
            // But here we can just fire onChange and handle cursor restoration in the component
            onChange(newValue);
            
            // HACK: Queue cursor update
            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + indent.length;
                }
            });
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();

            const textarea = e.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            
            const currentLineStart = code.lastIndexOf('\n', start - 1) + 1;
            const currentLine = code.substring(currentLineStart, start);
            
            // Match existing indentation
            const match = currentLine.match(/^(\s*)/);
            let indent = match ? match[1] : '';
            
            // Smart indent: increase if line ends with specific chars
            const trimmed = currentLine.trim();
            if (trimmed.endsWith('{') || trimmed.endsWith('(') || trimmed.endsWith('[') || trimmed.endsWith(':')) {
                indent += '  ';
            }
            
            const newValue = code.substring(0, start) + '\n' + indent + code.substring(end);
            
            onChange(newValue);
            
            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1 + indent.length;
                }
            });
            return;
        }
        
        // Stop event propagation for other editing keys to prevent canvas hotkeys
        // e.g. Backspace shouldn't delete the element (if logic exists), 
        // Space shouldn't pan, etc.
        e.stopPropagation();
        
    }, [code, onChange, textareaRef]);

    return { handleKeyDown };
}
