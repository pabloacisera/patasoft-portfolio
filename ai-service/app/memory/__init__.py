import os
import json
import redis
from typing import Any, Dict, List, Optional
from langchain.memory import ConversationBufferMemory
from langchain.schema import HumanMessage, AIMessage, SystemMessage


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
MAX_HISTORY = 20


class CompanyMemory:
    def __init__(self, company_id: str):
        self.company_id = company_id
        self.key_prefix = f"ai_memory:{company_id}:"
        
        self.redis = redis.from_url(REDIS_URL, decode_responses=True)
    
    def _get_key(self, session_id: str = "default") -> str:
        return f"{self.key_prefix}{session_id}"
    
    def get_messages(self, session_id: str = "default") -> List[Dict[str, str]]:
        key = self._get_key(session_id)
        data = self.redis.get(key)
        
        if not data:
            return []
        
        try:
            messages = json.loads(data)
            return messages
        except json.JSONDecodeError:
            return []
    
    def save_messages(self, messages: List[Dict[str, str]], session_id: str = "default"):
        key = self._get_key(session_id)
        
        if len(messages) > MAX_HISTORY * 2:
            messages = messages[-(MAX_HISTORY * 2):]
        
        self.redis.set(key, json.dumps(messages), ex=2592000)
    
    def add_user_message(self, content: str, session_id: str = "default"):
        messages = self.get_messages(session_id)
        messages.append({"role": "user", "content": content})
        self.save_messages(messages, session_id)
    
    def add_ai_message(self, content: str, session_id: str = "default"):
        messages = self.get_messages(session_id)
        messages.append({"role": "assistant", "content": content})
        self.save_messages(messages, session_id)
    
    def add_message(self, role: str, content: str, session_id: str = "default"):
        if role == "user":
            self.add_user_message(content, session_id)
        elif role == "assistant":
            self.add_ai_message(content, session_id)
    
    def get_history(self, session_id: str = "default") -> List[Dict[str, str]]:
        messages = self.get_messages(session_id)
        
        result = []
        for msg in messages:
            if msg["role"] == "user":
                result.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                result.append(AIMessage(content=msg["content"]))
            elif msg["role"] == "system":
                result.append(SystemMessage(content=msg["content"]))
        
        return result
    
    def clear(self, session_id: str = "default"):
        key = self._get_key(session_id)
        self.redis.delete(key)
    
    def clear_all(self):
        pattern = f"{self.key_prefix}*"
        keys = self.redis.keys(pattern)
        if keys:
            self.redis.delete(*keys)


def get_company_memory(company_id: str) -> CompanyMemory:
    return CompanyMemory(company_id)


class CompanyMemoryStore:
    def __init__(self):
        self.redis = redis.from_url(REDIS_URL, decode_responses=True)
    
    def get_memory(self, company_id: str) -> CompanyMemory:
        return CompanyMemory(company_id)
    
    def list_sessions(self, company_id: str) -> List[str]:
        pattern = f"ai_memory:{company_id}:*"
        keys = self.redis.keys(pattern)
        
        sessions = []
        for key in keys:
            session_id = key.replace(f"ai_memory:{company_id}:", "")
            if session_id:
                sessions.append(session_id)
        
        return sessions
    
    def delete_company_memory(self, company_id: str):
        pattern = f"ai_memory:{company_id}:*"
        keys = self.redis.keys(pattern)
        if keys:
            self.redis.delete(*keys)


company_memory_store = CompanyMemoryStore()

__all__ = [
    "CompanyMemory",
    "CompanyMemoryStore", 
    "get_company_memory",
    "company_memory_store",
]