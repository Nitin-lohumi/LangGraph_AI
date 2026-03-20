import asyncio
import json
import logging
import os
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, Agent, AutoSubscribe
from livekit.plugins import deepgram, groq, silero, cartesia

logging.basicConfig(level=logging.INFO)
load_dotenv()

class VoiceAgent(Agent):
    def __init__(self, session_id: str, uploaded_files: list):
        super().__init__(
            instructions=f"""You are a helpful voice assistant.
Uploaded PDFs in this session: {', '.join(uploaded_files) or 'None'}.
Give concise 2-3 sentence answers. Speak naturally."""
        )

async def entrypoint(ctx: agents.JobContext):
    try:
        print("🚀 Agent starting...")
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        print("✅ Connected to LiveKit")

        meta = json.loads(ctx.room.metadata or "{}")
        session_id = meta.get("sessionId", "")
        uploaded_files = meta.get("uploadedFiles", [])
        print("📦 Metadata:", meta)

        session = AgentSession(
            vad=silero.VAD.load(),
            stt=deepgram.STT(),
            llm=groq.LLM(model="llama-3.3-70b-versatile"),
            tts=cartesia.TTS(
                model="sonic-2",
                voice="f786b574-daa5-4673-aa0c-cbe3e8534c02",
            ),
        )

        await session.start(
            room=ctx.room,
            agent=VoiceAgent(session_id, uploaded_files),
        )
        print("🎤 Agent started successfully")

    
        @session.on("user_speech_committed")
        def on_user(ev):
            text = ev.transcript if hasattr(ev, 'transcript') else str(ev)
            print(f"👤 User said: {text}")
            asyncio.ensure_future(
                ctx.room.local_participant.publish_data(
                    json.dumps({"type": "transcript", "role": "user", "text": text}).encode(),
                    reliable=True
                )
            )

        @session.on("agent_speech_committed")
        def on_agent(ev):
            text = ev.transcript if hasattr(ev, 'transcript') else str(ev)
            print(f"🤖 Agent said: {text}")
            asyncio.ensure_future(
                ctx.room.local_participant.publish_data(
                    json.dumps({"type": "transcript", "role": "assistant", "text": text}).encode(),
                    reliable=True
                )
            )

        await asyncio.sleep(2)
        await session.generate_reply(
            instructions="Greet the user warmly and ask how you can help."
        )
        print("💬 Greeting sent!")

    except Exception as e:
        print("❌ ERROR:", str(e))
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(entrypoint_fnc=entrypoint)
    )