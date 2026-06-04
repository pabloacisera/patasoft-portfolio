import { api } from '../../services/api.js';

export async function renderChatPage(content, pageData) {
  content.innerHTML = `
    <div class="chat-container">
      <div class="chat-messages" id="chat-messages">
        <div class="chat-message assistant">Hola, soy el asistente de IA. ¿En qué puedo ayudarte hoy?</div>
      </div>
      <div class="chat-input">
        <textarea id="chat-input" placeholder="Escribe tu mensaje..."></textarea>
        <button class="btn btn-primary" id="send-chat-btn">Enviar</button>
      </div>
    </div>
  `;
  
  const messagesEl = document.getElementById('chat-messages');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-chat-btn');
  const chatHistory = [];
  
  async function sendMessage() {
    const msg = inputEl.value.trim();
    if (!msg) return;
    
    chatHistory.push({ role: 'user', content: msg });
    messagesEl.innerHTML += `<div class="chat-message user">${msg}</div>`;
    inputEl.value = '';
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    messagesEl.innerHTML += '<div class="chat-message assistant typing">Escribiendo...</div>';
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    try {
      const { message } = await api.post('/ai/chat', {
        message: msg,
        history: chatHistory.slice(0, -1),
        sessionId: 'chat_' + Date.now(),
      });
      chatHistory.push(message);
       
      messagesEl.querySelector('.typing')?.remove();
      messagesEl.innerHTML += `<div class="chat-message assistant">${message.content}</div>`;
    } catch (e) {
      messagesEl.querySelector('.typing')?.remove();
      messagesEl.innerHTML += '<div class="chat-message assistant">Lo siento, houve un error. Intenta de nuevo.</div>';
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  
  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
}
