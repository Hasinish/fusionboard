import { describe, it, expect } from 'vitest';
import { getYouTubeId, getYouTubeEmbedUrl } from '../youtubeUtils';

describe('youtubeUtils', () => {
    describe('getYouTubeId', () => {
        it('extracts ID from standard youtube.com/watch URL', () => {
            const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
            expect(getYouTubeId(url)).toBe('dQw4w9WgXcQ');
        });

        it('extracts ID from youtu.be short URL', () => {
            const url = 'https://youtu.be/dQw4w9WgXcQ';
            expect(getYouTubeId(url)).toBe('dQw4w9WgXcQ');
        });

        it('extracts ID from embed URL', () => {
            const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
            expect(getYouTubeId(url)).toBe('dQw4w9WgXcQ');
        });

        it('extracts ID from URL with extra params', () => {
            const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s';
            expect(getYouTubeId(url)).toBe('dQw4w9WgXcQ');
        });

        it('returns empty string for invalid URL', () => {
            expect(getYouTubeId('https://google.com')).toBe('');
            expect(getYouTubeId('invalid')).toBe('');
        });
    });

    describe('getYouTubeEmbedUrl', () => {
        it('returns correct embed URL', () => {
            expect(getYouTubeEmbedUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
        });

        it('returns empty string for empty ID', () => {
            expect(getYouTubeEmbedUrl('')).toBe('');
        });
    });
});
