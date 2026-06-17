import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderChatPage } from './ai-chat.js';
import { api } from '../../services/api.js';

vi.mock('../../services/api.js', () => ({
  api: {
    streamPost: vi.fn(),
    post: vi.fn(),
  },
}));

describe('ai-chat page', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    vi.clearAllMocks();
  });

  it('streams assistant responses into the chat UI', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"content":"Hola"}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"content":" mundo"}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"done":true,"full":"Hola mundo"}\n\n'));
        controller.close();
      },
    });

    api.streamPost.mockResolvedValueOnce(new Response(stream, {
      headers: { 'content-type': 'text/event-stream' },
    }));

    const content = document.getElementById('app');
    await renderChatPage(content, {});

    const input = document.getElementById('chat-input');
    const button = document.getElementById('send-chat-btn');
    input.value = 'Hola';
    button.click();

    await vi.waitFor(() => {
      const assistantMessages = document.querySelectorAll('.chat-message.assistant');
      expect(assistantMessages.length).toBeGreaterThan(1);
      expect(assistantMessages[assistantMessages.length - 1].textContent).toContain('Hola mundo');
    });
  });

  it('falls back to the JSON chat endpoint if streaming fails', async () => {
    api.streamPost.mockRejectedValueOnce(new Error('stream failed'));
    api.post.mockResolvedValueOnce({
      message: { role: 'assistant', content: 'Respuesta JSON' },
    });

    const content = document.getElementById('app');
    await renderChatPage(content, {});

    const input = document.getElementById('chat-input');
    const button = document.getElementById('send-chat-btn');
    input.value = 'Hola';
    button.click();

    await vi.waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ai/chat', expect.objectContaining({
        message: 'Hola',
      }));
      expect(document.querySelector('.chat-message.assistant:last-child').textContent).toContain('Respuesta JSON');
    });
  });
});
