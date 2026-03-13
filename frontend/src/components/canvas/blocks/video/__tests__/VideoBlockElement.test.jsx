import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VideoBlockElement } from '../VideoBlockElement';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    Youtube: () => <div data-testid="icon-youtube" />,
    Link: () => <div data-testid="icon-link" />,
    Edit2: () => <div data-testid="icon-edit" />
}));

describe('VideoBlockElement', () => {
    const defaultProps = {
        el: {
            id: 'video-1',
            type: 'video',
            x: 0,
            y: 0,
            w: 400,
            h: 300,
            url: '',
            videoId: '',
            stroke: '#000',
            strokeWidth: 1
        },
        camera: { x: 0, y: 0, z: 1 },
        onChange: vi.fn(),
        isSelected: false,
        handlePointerDown: vi.fn()
    };

    it('renders input when no video ID is present', () => {
        render(<VideoBlockElement {...defaultProps} />);
        expect(screen.getByPlaceholderText('Paste YouTube Link...')).toBeInTheDocument();
        expect(screen.queryByTitle('YouTube Video')).not.toBeInTheDocument();
    });

    it('renders iframe when video ID is present', () => {
        const props = {
            ...defaultProps,
            el: { ...defaultProps.el, videoId: 'dQw4w9WgXcQ', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' }
        };
        render(<VideoBlockElement {...props} />);
        expect(screen.getByTitle('YouTube Video')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Paste YouTube Link...')).not.toBeInTheDocument();
    });

    it('calls onChange with parsed ID when URL is pasted', () => {
        render(<VideoBlockElement {...defaultProps} />);
        const input = screen.getByPlaceholderText('Paste YouTube Link...');
        fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=TEST_ID_123' } });
        
        expect(defaultProps.onChange).toHaveBeenCalledWith({
            ...defaultProps.el,
            url: 'https://youtube.com/watch?v=TEST_ID_123',
            videoId: 'TEST_ID_123'
        });
    });

    it('shows edit button when video is loaded', () => {
        const props = {
            ...defaultProps,
            el: { ...defaultProps.el, videoId: 'dQw4w9WgXcQ' }
        };
        render(<VideoBlockElement {...props} />);
        expect(screen.getByTitle('Change Video')).toBeInTheDocument();
    });

    it('clears videoId when edit button is clicked', () => {
        const props = {
            ...defaultProps,
            el: { ...defaultProps.el, videoId: 'dQw4w9WgXcQ' }
        };
        render(<VideoBlockElement {...props} />);
        fireEvent.click(screen.getByTitle('Change Video'));
        
        expect(props.onChange).toHaveBeenCalledWith({
            ...props.el,
            videoId: '',
            url: ''
        });
    });

    it('calls handlePointerDown when header is clicked', () => {
        const { container } = render(<VideoBlockElement {...defaultProps} />);
        // Find the main container (first div)
        const mainDiv = container.firstChild;
        fireEvent.pointerDown(mainDiv, { clientX: 10, clientY: 10 });
        expect(defaultProps.handlePointerDown).toHaveBeenCalled();
    });
});
