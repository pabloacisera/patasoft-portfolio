import { describe, it, expect, vi } from 'vitest';
import { renderWithCleanup } from './cleanup.js';

describe('renderWithCleanup', () => {
  it('should render HTML into container', () => {
    const container = document.createElement('div');
    renderWithCleanup(container, '<p>hello</p>');
    expect(container.innerHTML).toBe('<p>hello</p>');
  });

  it('should clear existing content before rendering', () => {
    const container = document.createElement('div');
    container.innerHTML = '<span>old</span>';
    renderWithCleanup(container, '<p>new</p>');
    expect(container.innerHTML).toBe('<p>new</p>');
  });

  it('should call setupListeners when provided', () => {
    const container = document.createElement('div');
    const listener = vi.fn();
    renderWithCleanup(container, '<p>test</p>', listener);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('should not call setupListeners when not provided', () => {
    const container = document.createElement('div');
    renderWithCleanup(container, '<p>test</p>');
    expect(container.innerHTML).toBe('<p>test</p>');
  });
});
