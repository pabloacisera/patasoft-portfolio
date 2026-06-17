import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizeAttr } from './escape.js';

describe('escapeHtml', () => {
  it('should escape & to &amp;', () => {
    expect(escapeHtml('&')).toBe('&amp;');
  });

  it('should escape < to &lt;', () => {
    expect(escapeHtml('<')).toBe('&lt;');
  });

  it('should escape > to &gt;', () => {
    expect(escapeHtml('>')).toBe('&gt;');
  });

  it('should escape " to &quot;', () => {
    expect(escapeHtml('"')).toBe('&quot;');
  });

  it("should escape ' to &#039;", () => {
    expect(escapeHtml("'")).toBe('&#039;');
  });

  it('should escape mixed content', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('should return empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('should return same string for safe input', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('should handle numbers', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('sanitizeAttr', () => {
  it('should escape & first then other chars (last & catches entities)', () => {
    expect(sanitizeAttr('"test"')).toBe('&amp;quot;test&amp;quot;');
  });

  it('should escape single quotes', () => {
    expect(sanitizeAttr("'test'")).toBe('&amp;#039;test&amp;#039;');
  });

  it('should escape < and >', () => {
    expect(sanitizeAttr('<tag>')).toBe('&amp;lt;tag&amp;gt;');
  });

  it('should escape standalone &', () => {
    expect(sanitizeAttr('&')).toBe('&amp;');
  });

  it('should return empty string for null', () => {
    expect(sanitizeAttr(null)).toBe('');
  });

  it('should not double-escape already encoded input', () => {
    expect(sanitizeAttr('&lt;safe&gt;')).toBe('&amp;lt;safe&amp;gt;');
  });
});
