"use client";
import { useState, useEffect } from "react";
import {
  LiveKitRoom,
  useVoiceAssistant,
  BarVisualizer,
  useRoomContext,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { FiMicOff, FiMic, FiSquare } from "react-icons/fi";

type VoiceMsg = { role: string; text: string };

function Session({ onStop }: { onStop: (msgs: VoiceMsg[]) => void }) {
  const { state, audioTrack } = useVoiceAssistant();
  const [transcript, setTranscript] = useState<VoiceMsg[]>([]);
  const [muted, setMuted] = useState(false);
  const room = useRoomContext();

  useEffect(() => {
    const handler = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === "transcript") {
          setTranscript((p) => [...p, { role: data.role, text: data.text }]);
        }
      } catch {}
    };
    room.on("dataReceived", handler);
    return () => {
      room.off("dataReceived", handler);
    };
  }, [room]);

  const toggleMute = async () => {
    const localParticipant = room.localParticipant;
    await localParticipant.setMicrophoneEnabled(muted);
    setMuted(!muted);
  };

  const stateLabel: Record<string, string> = {
    listening: "listening ...",
    thinking: "thinking...",
    speaking: "speaking...",
    idle: "Ready",
  };
  const label =
    (stateLabel as Record<string, string>)[state] ?? "Connecting...";

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <div
        className={`w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all
        ${
          state === "speaking"
            ? "border-purple-400 shadow-lg shadow-purple-500/30"
            : state === "listening"
              ? "border-green-400"
              : "border-gray-600"
        }`}
      >
        <span className="text-3xl">🤖</span>
      </div>

      <p className="text-sm text-gray-400">{label}</p>

      <BarVisualizer
        state={state}
        barCount={24}
        trackRef={audioTrack}
        style={{ width: "200px", height: "48px" }}
      />

      {transcript.length > 0 && (
        <div className="w-full max-h-36 overflow-y-auto space-y-1 px-2">
          {transcript.slice(-4).map((m, i) => (
            <p
              key={i}
              className={`text-xs ${
                m.role === "user"
                  ? "text-right text-blue-300"
                  : "text-left text-green-300"
              }`}
            >
              <span className="font-medium opacity-60">
                {m.role === "user" ? "You" : "AI"}:
              </span>{" "}
              {m.text}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={toggleMute}
          className={`flex items-center cursor-pointer gap-2 px-4 py-2.5 rounded-full font-medium transition-all
            ${
              muted
                ? "bg-yellow-600 hover:bg-yellow-500 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-white"
            }`}
        >
          {muted ? <FiMicOff size={16} /> : <FiMic size={16} />}
          {muted ? "Unmute" : "Mute"}
        </button>

        <button
          onClick={() => onStop(transcript)}
          disabled={state === "connecting"}
          className={`flex items-center cursor-pointer gap-2 text-white px-4 py-2.5 rounded-full font-medium transition-all
            ${
              state === "connecting"
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-500"
            }`}
        >
          {state != "connecting" ? <FiSquare size={16} color="white" /> : ""}
          {state === "connecting" ? "Connecting..." : "Stop"}
        </button>
      </div>

    </div>
  );
}

export function VoiceOverlay({
  onClose,
  onSave,
  sessionId,
  uploadedFiles,
}: {
  onClose: () => void;
  onSave: (msgs: VoiceMsg[]) => void;
  sessionId: string;
  uploadedFiles: string[];
}) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/livekit-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, uploadedFiles }),
    })
      .then((r) => r.json())
      .then((d) => (d.token ? setToken(d.token) : setError("Token failed")))
      .catch(() => setError("Connection failed"));
  }, []);

  const handleStop = (msgs: VoiceMsg[]) => {
    onSave(msgs);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-950 border border-gray-700 rounded-2xl p-6 w-80 max-w-[90vw]">
        <div className="flex justify-center items-center mb-5">
          <h2 className="text-white font-semibold"> Voice Chat</h2>
        </div>

        {error ? (
          <p className="text-red-400 text-sm text-center py-4">{error}</p>
        ) : !token ? (
          <p className="text-gray-400 text-sm text-center py-8 animate-pulse">
            Connecting...
          </p>
        ) : (
          <LiveKitRoom
            token={token}
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
            audio={true}
            video={false}
            connect={true}
          >
            <RoomAudioRenderer />
            <Session onStop={handleStop} />
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}
