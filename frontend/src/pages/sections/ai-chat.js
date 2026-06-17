import { api } from '../../services/api.js';
import { escapeHtml } from '../../utils/escape.js';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
});

export async function renderChatPage(content, pageData) {
  content.replaceChildren();
  content.insertAdjacentHTML('beforeend', `
    <div class="chat-container">
      <div class="chat-messages" id="chat-messages">
        <div class="chat-message assistant">Hola, soy el asistente de IA. ¿En qué puedo ayudarte hoy?</div>
      </div>
      <div class="chat-input">
        <textarea id="chat-input" placeholder="Escribe tu mensaje..."></textarea>
        <button class="btn btn-primary" id="send-chat-btn">Enviar</button>
      </div>
    </div>
  `);
  
  const messagesEl = document.getElementById('chat-messages');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-chat-btn');
  const chatHistory = [];

  function appendAssistantMessage(text = '') {
    const node = document.createElement('div');
    node.className = 'chat-message assistant';
    node.innerHTML = md.render(text);
    messagesEl.appendChild(node);
    return node;
  }

  function parseSsePayload(rawChunk, onPayload) {
    const events = rawChunk.split('\n\n');
    for (const eventBlock of events) {
      const lines = eventBlock.split('\n').map(line => line.trim()).filter(Boolean);
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payloadText = line.slice(5).trim();
        if (!payloadText) continue;
        try {
          onPayload(JSON.parse(payloadText));
        } catch {
          // Ignorar chunks parciales o inválidos.
        }
      }
    }
  }
  
  async function sendMessage() {
    const msg = inputEl.value.trim();
    if (!msg) return;
    
    chatHistory.push({ role: 'user', content: msg });
    messagesEl.insertAdjacentHTML('beforeend', `<div class="chat-message user">${escapeHtml(msg)}</div>`);
    inputEl.value = '';
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    const assistantMessageEl = appendAssistantMessage('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    try {
      const response = await api.streamPost('/ai/chat/stream', {
        message: msg,
        history: chatHistory.slice(0, -1),
        sessionId: 'chat_' + Date.now(),
      });

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Stream vacío');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          parseSsePayload(buffer, (payload) => {
            if (payload.error) {
              throw new Error(payload.error);
            }
            if (payload.content) {
              fullResponse += payload.content;
              assistantMessageEl.innerHTML = md.render(fullResponse);
            }
            if (payload.full) {
              fullResponse = payload.full;
              assistantMessageEl.innerHTML = md.render(fullResponse);
            }
          });
          const lastSeparator = buffer.lastIndexOf('\n\n');
          if (lastSeparator >= 0) {
            buffer = buffer.slice(lastSeparator + 2);
          }
        }
      }

      if (!assistantMessageEl.textContent) {
        assistantMessageEl.innerHTML = md.render(fullResponse || 'No pude obtener una respuesta.');
      }

      chatHistory.push({ role: 'assistant', content: fullResponse || 'No pude obtener una respuesta.' });
    } catch (e) {
      try {
        const { message } = await api.post('/ai/chat', {
          message: msg,
          history: chatHistory.slice(0, -1),
          sessionId: 'chat_' + Date.now(),
        });
        const fallbackText = message?.content || message?.response || 'No pude obtener una respuesta.';
        assistantMessageEl.innerHTML = md.render(fallbackText);
        chatHistory.push({ role: 'assistant', content: fallbackText });
      } catch {
        const errorText = 'Lo siento, hubo un error. Intenta de nuevo.';
        assistantMessageEl.innerHTML = md.render(errorText);
        chatHistory.push({ role: 'assistant', content: errorText });
      }
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  
  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
}
