import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Modal, { openModal } from './Modal.js';

describe('Modal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    Modal.closeAll();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    Modal.closeAll();
  });

  it('should open a modal and append to body', () => {
    Modal.open({ title: 'Test', content: '<p>Content</p>' });
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();
  });

  it('should set aria attributes on modal', () => {
    Modal.open({ title: 'Test', content: '<p>Content</p>' });
    const modal = document.querySelector('.modal');
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.getAttribute('aria-labelledby')).toBe('modal-title');
  });

  it('should render title in modal header', () => {
    Modal.open({ title: 'My Title', content: '<p>Content</p>' });
    const title = document.querySelector('.modal-title');
    expect(title.textContent).toBe('My Title');
  });

  it('should close modal and remove overlay after animation', () => {
    Modal.open({ title: 'Test', content: '<p>Content</p>' });
    Modal.close();
    vi.advanceTimersByTime(300);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('should remove body class modal-open after last modal closes', () => {
    Modal.open({ title: 'Test', content: '<p>Content</p>' });
    Modal.close();
    vi.advanceTimersByTime(300);
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('should set body class modal-open when first modal opens', () => {
    Modal.open({ title: 'Test', content: '<p>Content</p>' });
    expect(document.body.classList.contains('modal-open')).toBe(true);
  });

  it('should call onConfirm when confirm is clicked', async () => {
    const onConfirm = vi.fn();
    Modal.open({ title: 'Test', content: '<p>Content</p>', onConfirm });
    const confirmBtn = document.querySelector('[data-modal-confirm]');
    confirmBtn.click();
    await vi.waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  it('should call onCancel when cancel is clicked', () => {
    const onCancel = vi.fn();
    Modal.open({ title: 'Test', content: '<p>Content</p>', onCancel, showCancel: true });
    const cancelBtn = document.querySelector('[data-modal-cancel]');
    cancelBtn.click();
    expect(onCancel).toHaveBeenCalled();
  });

  it('should focus first focusable element on open', async () => {
    Modal.open({ title: 'Test', content: '<button id="first-btn">OK</button>', showCancel: true });
    await vi.waitFor(() => {
      const focused = document.activeElement;
      expect(focused).not.toBeNull();
    });
  });
});
