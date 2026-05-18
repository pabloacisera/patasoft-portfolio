import os
import json
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Literal, AsyncGenerator

load_dotenv()

router = APIRouter()


SPECIALTY_PROMPTS = {
    "DOG": "perros y caninos",
    "CAT": "gatos y felinos",
    "HORSE": "equinos y caballos",
    "BIRD": "aves y ornitología",
    "RABBIT": "conejos y roedores",
    "REPTILE": "reptiles y herpetología",
    "GENERAL": "medicina veterinaria general",
}


SYSTEM_PROMPT_TEMPLATE = """Sos un asistente veterinario especializado en {specialties}.
Trabajas en {company_name}, una veterinaria ubicada en {company_address}.

Tenés acceso a los datos de la veterinaria y podés:
- Consultar mascotas y sus historial médico
- Buscar clientes y sus datos de contacto
- Ver el stock de insumos y medicamentos
- Consultar deudas pendientes de clientes

Tu estilo:
- Respondés en español argentino, formal pero amigable
- Usás terminología veterinaria precisa
- Cuando no sabés algo, lo decís con honestidad
- Si necesitás más información, pedís clarification

Última conversación:
{history}

Cliente dice: {input}
Asistente:"""


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    company_id: str
    company_name: str = ""
    company_address: str = ""
    specialties: List[str] = []
    model: str = "gpt-4o"
    temperature: float = 0.7
    session_id: str = "default"


class ChatResponse(BaseModel):
    message: ChatMessage
    usage: Optional[dict] = None


def get_llm(model_name: str):
    from langchain_groq import ChatGroq
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_openai import ChatOpenAI
    
    model = model_name.lower()
    
    if "groq" in model or model.startswith("llama") or model.startswith("mixtral"):
        return ChatGroq(
            model=model,
            groq_api_key=os.getenv("GROQ_API_KEY", ""),
            temperature=0.7,
        )
    elif "gemini" in model:
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=os.getenv("GEMINI_API_KEY", ""),
            temperature=0.7,
        )
    else:
        return ChatOpenAI(
            model=model,
            openai_api_key=os.getenv("OPENAI_API_KEY", ""),
            temperature=0.7,
        )


def get_system_prompt(
    specialties: List[str],
    company_name: str,
    company_address: str,
    history: str = "",
    user_input: str = "",
) -> str:
    if not specialties:
        specialties = ["GENERAL"]
    
    specialties_text = ", ".join([
        SPECIALTY_PROMPTS.get(s, s) for s in specialties
    ])
    
    return SYSTEM_PROMPT_TEMPLATE.format(
        specialties=specialties_text or "medicina veterinaria general",
        company_name=company_name or "la veterinaria",
        company_address=company_address or "",
        history=history or "Sin conversación previa.",
        input=user_input,
    )


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        llm = get_llm(request.model)
        
        from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
        from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
        from langchain.agents import AgentExecutor, create_openai_functions_agent

        from app.memory import get_company_memory
        from app.tools import (
            get_pets_tool,
            get_clients_tool,
            get_medical_records_tool,
            get_supplies_tool,
            get_debts_tool,
            get_payments_tool,
        )
        
        memory = get_company_memory(request.company_id)
        history_messages = memory.get_history(request.session_id)
        
        history_str = ""
        for msg in history_messages:
            role = "Usuario" if isinstance(msg, HumanMessage) else "Asistente"
            history_str += f"{role}: {msg.content}\n"
        
        system_prompt = get_system_prompt(
            specialties=request.specialties,
            company_name=request.company_name,
            company_address=request.company_address,
            history=history_str,
            user_input=request.messages[-1].content if request.messages else "",
        )
        
        chat_messages = [SystemMessage(content=system_prompt)]
        
        for msg in request.messages[:-1]:
            if msg.role == "user":
                chat_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                chat_messages.append(AIMessage(content=msg.content))
        
        last_message = request.messages[-1].content if request.messages else ""
        if last_message:
            chat_messages.append(HumanMessage(content=last_message))
        
        from app.tools import (
            get_pets_tool,
            get_clients_tool,
            get_medical_records_tool,
            get_supplies_tool,
            get_debts_tool,
            get_payments_tool,
        )

        tools = [
            get_pets_tool,
            get_clients_tool,
            get_medical_records_tool,
            get_supplies_tool,
            get_debts_tool,
            get_payments_tool,
        ]

        agent_prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="chat_history", optional=True),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])

        agent = create_openai_functions_agent(
            llm=get_llm(request.model),
            tools=tools,
            prompt=agent_prompt,
        )

        agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=False,
            handle_parsing_errors=True,
            max_iterations=5,
        )

        chat_history_for_agent = []
        for msg in request.messages[:-1]:
            if msg.role == "user":
                chat_history_for_agent.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                chat_history_for_agent.append(AIMessage(content=msg.content))

        agent_result = agent_executor.invoke({
            "input": last_message,
            "chat_history": chat_history_for_agent,
        })

        response_text = agent_result.get("output", "No pude obtener una respuesta.")
        
        memory.add_message("user", last_message, request.session_id)
        memory.add_message("assistant", response_text, request.session_id)

        return ChatResponse(
            message=ChatMessage(role="assistant", content=response_text),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def build_chat_messages(request: ChatRequest) -> tuple:
    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
    from app.memory import get_company_memory

    memory = get_company_memory(request.company_id)
    history_messages = memory.get_history(request.session_id)
    history_str = ""
    for msg in history_messages:
        role = "Usuario" if isinstance(msg, HumanMessage) else "Asistente"
        history_str += f"{role}: {msg.content}\n"

    system_prompt = get_system_prompt(
        specialties=request.specialties,
        company_name=request.company_name,
        company_address=request.company_address,
        history=history_str,
        user_input=request.messages[-1].content if request.messages else "",
    )

    chat_messages = [SystemMessage(content=system_prompt)]
    for msg in request.messages[:-1]:
        if msg.role == "user":
            chat_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            chat_messages.append(AIMessage(content=msg.content))

    last_message = request.messages[-1].content if request.messages else ""
    if last_message:
        chat_messages.append(HumanMessage(content=last_message))

    return chat_messages, last_message


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            from langchain_core.messages import HumanMessage, AIMessage
            from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
            from langchain.agents import AgentExecutor, create_openai_functions_agent
            from app.memory import get_company_memory
            from app.tools import (
                get_pets_tool, get_clients_tool, get_medical_records_tool,
                get_supplies_tool, get_debts_tool, get_payments_tool,
            )

            chat_messages, last_message = await build_chat_messages(request)
            memory = get_company_memory(request.company_id)
            history_messages = memory.get_history(request.session_id)

            system_prompt = chat_messages[0].content if chat_messages else ""

            agent_prompt = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="chat_history", optional=True),
                ("human", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad"),
            ])

            tools = [
                get_pets_tool, get_clients_tool, get_medical_records_tool,
                get_supplies_tool, get_debts_tool, get_payments_tool,
            ]

            agent = create_openai_functions_agent(
                llm=get_llm(request.model),
                tools=tools,
                prompt=agent_prompt,
            )

            agent_executor = AgentExecutor(
                agent=agent,
                tools=tools,
                verbose=False,
                handle_parsing_errors=True,
                max_iterations=5,
            )

            chat_history_for_agent = [
                msg for msg in chat_messages[1:-1]
            ]

            full_response = ""
            result = agent_executor.invoke({
                "input": last_message,
                "chat_history": chat_history_for_agent,
            })
            full_response = result.get("output", "No pude obtener una respuesta.")

            chunk_size = 10
            for i in range(0, len(full_response), chunk_size):
                chunk = full_response[i:i+chunk_size]
                yield f"data: {json.dumps({'content': chunk})}\n\n"

            memory.add_message("user", last_message, request.session_id)
            memory.add_message("assistant", full_response, request.session_id)
            yield f"data: {json.dumps({'done': True, 'full': full_response})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/models")
async def list_models():
    return {
        "models": [
            {"id": "gpt-4o", "name": "GPT-4o", "provider": "openai"},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "provider": "openai"},
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B", "provider": "groq"},
            {"id": "llama-3.1-70b-instant", "name": "Llama 3.1 70B", "provider": "groq"},
            {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B", "provider": "groq"},
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "provider": "google"},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "provider": "google"},
        ]
    }


@router.delete("/memory")
async def clear_memory(
    company_id: str,
    session_id: str = "default",
):
    from app.memory import get_company_memory
    
    memory = get_company_memory(company_id)
    
    if session_id == "all":
        memory.clear_all()
    else:
        memory.clear(session_id)
    
    return {"success": True, "message": "Memoria清除ada"}


@router.get("/history")
async def get_history(
    company_id: str,
    session_id: str = "default",
):
    from app.memory import get_company_memory
    
    memory = get_company_memory(company_id)
    messages = memory.get_messages(session_id)
    
    return {"success": True, "messages": messages}


@router.get("/tools")
async def list_tools():
    return {
        "tools": [
            {
                "name": "get_pets",
                "description": "Busca mascotas de la empresa por nombre, especie o cliente",
            },
            {
                "name": "get_clients", 
                "description": "Busca clientes por nombre, email o DNI",
            },
            {
                "name": "get_medical_records",
                "description": "Obtiene el historial médico de una mascota",
            },
            {
                "name": "get_supplies",
                "description": "Busca insumos del stock, opcionalmente filtrando por stock bajo",
            },
            {
                "name": "get_debts",
                "description": "Busca deudas pendientes de la empresa",
            },
        ]
    }