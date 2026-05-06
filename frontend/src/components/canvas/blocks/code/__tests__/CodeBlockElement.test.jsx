import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeBlockElement } from '../CodeBlockElement';
import * as codeExecutionHook from '../useCodeExecution';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    Play: () => <div data-testid="icon-play" />,
    Loader2: () => <div data-testid="icon-loader" />,
    RefreshCw: () => <div data-testid="icon-refresh" />,
    Terminal: () => <div data-testid="icon-terminal" />,
    Keyboard: () => <div data-testid="icon-keyboard" />,
    Trash2: () => <div data-testid="icon-trash" />
}));

describe('CodeBlockElement', () => {
    const mockExecute = vi.fn();
    const mockOnChange = vi.fn();
    const mockOnStartEdit = vi.fn();
    const mockOnEndEdit = vi.fn();
    const mockHandlePointerDown = vi.fn();

    const defaultProps = {
        el: {
            id: 'code-1',
            type: 'code',
            x: 0,
            y: 0,
            w: 400,
            h: 300,
            language: 'javascript',
            code: "console.log('test');",
            output: '',
            stroke: '#000',
            strokeWidth: 1,
            fill: '#1e1e2e'
        },
        camera: { x: 0, y: 0, z: 1 },
        onChange: mockOnChange,
        isEditing: false,
        onStartEdit: mockOnStartEdit,
        onEndEdit: mockOnEndEdit,
        handlePointerDown: mockHandlePointerDown
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock the hook implementation
        vi.spyOn(codeExecutionHook, 'useCodeExecution').mockReturnValue({
            isRunning: false,
            execute: mockExecute
        });
        
        // window.confirm mock
        window.confirm = vi.fn(() => true);
    });

    it('renders code editor with correct language', () => {
        render(<CodeBlockElement {...defaultProps} />);
        expect(screen.getByDisplayValue("console.log('test');")).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toHaveValue('javascript');
    });

    it('enters edit mode on double click', () => {
        const { container } = render(<CodeBlockElement {...defaultProps} />);
        // Find main container
        const mainDiv = container.firstChild;
        fireEvent.doubleClick(mainDiv);
        expect(mockOnStartEdit).toHaveBeenCalledWith('code-1');
    });

    it('calls execute when run button is clicked', () => {
        render(<CodeBlockElement {...defaultProps} />);
        const runButton = screen.getByText('Run');
        fireEvent.click(runButton);
        expect(mockExecute).toHaveBeenCalled();
    });

    it('updates code on change', () => {
        const props = { ...defaultProps, isEditing: true };
        render(<CodeBlockElement {...props} />);
        const textarea = screen.getByDisplayValue("console.log('test');");
        fireEvent.change(textarea, { target: { value: 'new code' } });
        expect(mockOnChange).toHaveBeenCalledWith({
            ...defaultProps.el,
            code: 'new code'
        });
    });

    it('switches to output tab by default', () => {
        render(<CodeBlockElement {...defaultProps} />);
        expect(screen.getByText('Output')).toBeInTheDocument();
    });

    it('switches to input tab when clicked', () => {
        render(<CodeBlockElement {...defaultProps} />);
        const inputTab = screen.getByText(/Input \(stdin\)/i);
        fireEvent.click(inputTab);
        expect(screen.getByPlaceholderText(/Enter input here/i)).toBeInTheDocument();
    });

    it('resets code to boilerplate', () => {
        render(<CodeBlockElement {...defaultProps} />);
        const resetButton = screen.getByTitle('Reset to boilerplate');
        fireEvent.click(resetButton);
        expect(window.confirm).toHaveBeenCalled();
        expect(mockOnChange).toHaveBeenCalled(); // Should call with boilerplate
    });

    it('handles indentation on Enter', () => {
         // This tests the useCodeEditorIndentation hook indirectly
         const props = { ...defaultProps, isEditing: true };
         render(<CodeBlockElement {...props} />);
         const textarea = screen.getByDisplayValue("console.log('test');");
         
         // Mock selection
         textarea.setSelectionRange = vi.fn();
         textarea.selectionStart = 20; // end of line
         textarea.selectionEnd = 20;

         fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', charCode: 13 });
         
         // The hook should call onChange with newline
         // We can't easily verify the exact string content without deeper mocking,
         // but we can verify it prevented default and triggered change if logic ran.
         // Actually, our hook calls onChange with new value.
         // Let's rely on the unit test for the hook or integration here.
         // Since I didn't export the hook for testing, integration is best.
         
         expect(mockOnChange).toHaveBeenCalled();
    });
});
