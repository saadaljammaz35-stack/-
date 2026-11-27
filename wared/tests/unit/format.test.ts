import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration, parseTimestamp, readingMinutes, slugify } from '@/lib/format';

describe('formatClock', () => {
  it('formats minutes and hours', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(Number.NaN)).toBe('0:00');
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('parseTimestamp', () => {
  it('accepts seconds, clock and h/m/s forms', () => {
    expect(parseTimestamp('125')).toBe(125);
    expect(parseTimestamp('2:05')).toBe(125);
    expect(parseTimestamp('1:02:05')).toBe(3725);
    expect(parseTimestamp('1h2m5s')).toBe(3725);
    expect(parseTimestamp('90s')).toBe(90);
  });
  it('rejects junk', () => {
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp('abc')).toBeNull();
    expect(parseTimestamp('1:99')).toBeNull();
    expect(parseTimestamp('<script>')).toBeNull();
  });
});

describe('formatDuration / readingMinutes / slugify', () => {
  it('formats durations per locale', () => {
    expect(formatDuration(null, 'ar')).toBeNull();
    expect(formatDuration(1800, 'ar')).toBe('30 دقيقة');
    expect(formatDuration(5400, 'en')).toBe('1 h 30 min');
  });
  it('estimates reading time', () => {
    expect(readingMinutes('كلمة '.repeat(400))).toBe(2);
    expect(readingMinutes('')).toBe(1);
  });
  it('slugifies latin text and drops arabic', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('Café Été')).toBe('cafe-ete');
    expect(slugify('وارد')).toBe('');
  });
});
