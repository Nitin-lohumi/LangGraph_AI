"use client";
import { useState, useEffect, useRef } from "react";
import Vapi from "@vapi-ai/web";
import { FiSend, FiMic, FiSquare } from "react-icons/fi";

const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!);

export default function VapiChat() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    vapi.on("call-start", () => {
      setConnected(true);
      setConnecting(false);
    });
    vapi.on("call-end", () => {
      setConnected(false);
      setConnecting(false);
      setSpeaking(false);
    });
    vapi.on("speech-start", () => setSpeaking(true));
    vapi.on("speech-end", () => setSpeaking(false));
    vapi.on("message", (msg) => {
      if (msg.type === "transcript" && msg.transcriptType === "final") {
        setMessages((p) => [...p, { role: msg.role, text: msg.transcript }]);
      }
    });
  }, []);

  const startVoice = async () => {
    setConnecting(true);
    await vapi.start(process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID!);
  };

  const stopVoice = () => vapi.stop();

  const sendText = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setLoading(true);
    setMessages((p) => [...p, { role: "user", text: userMsg }]);

    try {
      const res = await fetch("/api/vapi-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages((p) => [...p, { role: "assistant", text: data.reply }]);
    } catch {
      setMessages((p) => [...p, { role: "assistant", text: "Something went wrong." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4.3rem)] md:h-[calc(100vh-4rem)] bg-gradient-to-b from-black via-gray-950 to-black text-white overflow-hidden">
      
      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto md:max-w-7xl w-full mx-auto flex flex-col gap-3 p-4 scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-center mt-32">
            <div className="text-5xl mb-3">🎙️</div>
            <p className="text-lg text-gray-300">AI Assistant</p>
            <p className="text-sm text-gray-600 mt-1">Type or use voice to start</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`px-4 py-3 rounded-2xl max-w-[80%] text-sm leading-relaxed
              ${m.role === "user"
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-gray-800 text-gray-100 rounded-bl-sm"}`}>
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Voice status bar */}
      {(connected || connecting) && (
        <div className="flex justify-center mb-2">
          <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-full text-sm font-medium transition-all
            ${connecting
              ? "bg-yellow-600/20 border border-yellow-500/40 text-yellow-300"
              : speaking
                ? "bg-purple-600/30 border border-purple-500/50 text-purple-300"
                : "bg-green-600/20 border border-green-500/40 text-green-300"}`}>

            {/* Animated bars */}
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full transition-all ${
                    connecting ? "bg-yellow-400" : speaking ? "bg-purple-400" : "bg-green-400"
                  }`}
                  style={{
                    height: connecting ? "4px" : speaking ? `${8 + (i % 3) * 6}px` : "4px",
                    animation: speaking
                      ? `pulse ${0.4 + i * 0.1}s ease-in-out infinite alternate`
                      : "none",
                  }}
                />
              ))}
            </div>

            {connecting ? "Connecting..." : speaking ? "AI speaking..." : "Listening..."}

            {connected && (
              <button
                onClick={stopVoice}
                className="ml-1 bg-red-600/80 hover:bg-red-500 px-2 py-0.5 rounded-full text-xs text-white cursor-pointer"
              >
                End
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-800 bg-gradient-to-b from-black via-gray-950 to-black pt-3 pb-4">
        <div className="md:max-w-7xl w-full mx-auto px-4">
          <div className="flex items-center gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
              }}
              placeholder={connected ? "Voice active — or type here..." : "Type a message..."}
              rows={1}
              disabled={loading}
              className="flex-1 scrollbar-hide bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />

            <button
              onClick={sendText}
              disabled={loading || !input.trim()}
              className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
            >
              {loading
                ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                : <FiSend size={20} />}
            </button>

            <button
              onClick={connected ? stopVoice : startVoice}
              disabled={connecting}
              className={`p-3 rounded-xl font-medium transition-colors cursor-pointer flex-shrink-0
                ${connected
                  ? "bg-red-600 hover:bg-red-500"
                  : connecting
                    ? "bg-gray-700 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-500"}`}
            >
              {connecting
                ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                : connected
                  ? <FiSquare size={20} />
                  : <FiMic size={20} />}
            </button>
          </div>

          <p className="md:block hidden text-center text-xs text-gray-600 mt-2">
            Enter to send • 🎤 for voice
          </p>
        </div>
      </div>
    </div>
  );
}