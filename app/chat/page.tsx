"use client";

import React, { useState, useRef, useEffect } from "react";
import { FiSend, FiUpload, FiFile, FiX } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { FaRegCopy } from "react-icons/fa";
import { FaCopy } from "react-icons/fa6";
type Chat = {
  role: "user" | "ai";
  text: string;
  attachedFile?: string;
  contextUsed?: boolean;
};

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="text-xs px-2 py-1 rounded transition-colors cursor-pointer"
    >
      {copied ? <FaCopy size={16} color="green" /> : <FaRegCopy size={16} />}
    </button>
  );
}

function MarkdownMessage({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          const codeString = String(children).replace(/\n$/, "");
          return !inline && match ? (
            <div className="relative my-2 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-700">
                <span className="text-xs text-gray-400 font-mono">
                  {match[1]}
                </span>
                <CopyButton code={codeString} />
              </div>
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: 0,
                  fontSize: "0.75rem",
                }}
                {...props}
              >
                {codeString}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code
              className="bg-gray-700 text-pink-300 px-1.5 py-0.5 rounded text-xs font-mono"
              {...props}
            >
              {children}
            </code>
          );
        },
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="text-sm">{children}</li>,
        h1: ({ children }) => (
          <h1 className="text-lg font-bold mb-2 mt-1">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold mb-2 mt-1">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold mb-1 mt-1">{children}</h3>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-white">{children}</strong>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-gray-500 pl-3 italic text-gray-300 my-2">
            {children}
          </blockquote>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const hasLoadedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<Chat[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, loading]);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    const savedChat = localStorage.getItem("chat_history");
    if (savedChat) {
      try {
        const parsed = JSON.parse(savedChat);
        chatRef.current = parsed;
        setChat(parsed);
      } catch {
        localStorage.removeItem("chat_history");
      }
    }
  }, []);

  const uploadFileToServer = async (file: File): Promise<boolean> => {
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUploadedFiles((prev) => [...prev, file.name]);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async () => {
    if ((!message.trim() && !pendingFile) || loading) return;
    const userMessage = message.trim();
    setMessage("");
    setError("");

    const fileToUpload = pendingFile;
    if (pendingFile) setPendingFile(null);
    const userBubble: Chat = {
      role: "user",
      text: userMessage,
      attachedFile: fileToUpload?.name,
    };
    const historyBeforeThisMessage = [...chatRef.current];
    chatRef.current = [...chatRef.current, userBubble];
    setChat([...chatRef.current]);
    setLoading(true);
    let uploadedFileName: string | undefined;
    if (fileToUpload) {
      const success = await uploadFileToServer(fileToUpload);
      if (success) {
        uploadedFileName = fileToUpload.name;
      } else {
        chatRef.current = [
          ...chatRef.current,
          { role: "ai", text: "❌ PDF upload failed. Please try again." },
        ];
        setChat([...chatRef.current]);
        setLoading(false);
        return;
      }
    }

    const aiIndex = chatRef.current.length;
    chatRef.current = [
      ...chatRef.current,
      { role: "ai", text: "", contextUsed: false },
    ];
    setChat([...chatRef.current]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:
            userMessage ||
            (uploadedFileName
              ? `I have uploaded a PDF: ${uploadedFileName}. Please analyze it.`
              : ""),
          pdfUploaded: !!uploadedFileName,
          fileName: uploadedFileName,
          uploadedFiles: uploadedFileName
            ? [...uploadedFiles, uploadedFileName]
            : uploadedFiles,
          history: historyBeforeThisMessage.slice(-10),
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamedText = "";
      let contextUsed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;

          try {
            const parsed = JSON.parse(raw);
            if (parsed.contextUsed !== undefined) {
              contextUsed = parsed.contextUsed;
            }
            if (parsed.token) {
              streamedText += parsed.token;
              // Update the AI bubble in place
              chatRef.current = chatRef.current.map((msg, i) =>
                i === aiIndex
                  ? { ...msg, text: streamedText, contextUsed }
                  : msg,
              );
              setChat([...chatRef.current]);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setError(err.message);
      chatRef.current = chatRef.current.map((msg, i) =>
        i === aiIndex ? { ...msg, text: `Error: ${err.message}` } : msg,
      );
      setChat([...chatRef.current]);
    } finally {
      setLoading(false);
      localStorage.setItem("chat_history", JSON.stringify(chatRef.current));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    e.target.value = "";
  };

  const removePendingFile = () => setPendingFile(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = async () => {
    chatRef.current = [];
    setChat([]);
    setUploadedFiles([]);
    setPendingFile(null);
    setError("");
    localStorage.removeItem("chat_history");
    try {
      await fetch("/api/clear-context", { method: "POST" });
    } catch (err) {
      console.error("Error clearing Qdrant context:", err);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gradient-to-b from-black via-gray-950 to-black text-white overflow-hidden">
      <div className="flex justify-between items-center w-full flex-shrink-0">
        {chat.length > 0 && (
          <div className="md:max-w-7xl mx-auto w-full md:px-4 px-2 md:pt-2 pt-1 pb-2 flex flex-wrap gap-2 justify-end">
            <button
              className="px-4 py-2 bg-green-600 hover:bg-green-500 cursor-pointer rounded-lg text-white"
              onClick={startNewChat}
            >
              Start New Chat
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto md:max-w-7xl w-full mx-auto flex flex-col gap-2 p-2 scrollbar-hide">
        {chat.length === 0 && (
          <div className="text-center mt-32">
            <div className="text-5xl mb-3">🤖</div>
            <p className="text-lg text-gray-300">PDF AI Assistant</p>
          </div>
        )}

        {chat.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`rounded-2xl max-w-[80%] text-sm leading-relaxed overflow-hidden ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-gray-800 text-gray-100 rounded-bl-sm"
              }`}
            >
              {msg.attachedFile && (
                <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-blue-500/40">
                  <FiFile size={14} className="shrink-0" />
                  <span className="text-xs font-medium truncate opacity-90">
                    {msg.attachedFile}
                  </span>
                </div>
              )}

              {msg.role === "user" && msg.text && (
                <div className="px-4 py-3">{msg.text}</div>
              )}

              {msg.role === "ai" && msg.text && (
                <div className="px-4 py-3 prose prose-invert prose-sm max-w-none">
                  <MarkdownMessage text={msg.text} />
                </div>
              )}

              {msg.role === "ai" && loading && i === chat.length - 1 && (
                <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1 rounded-sm align-middle" />
              )}

              {!msg.text && msg.attachedFile && (
                <div className="px-4 py-3 opacity-75 italic text-xs">
                  Analyze this PDF
                </div>
              )}
            </div>
          </div>
        ))}
        {uploading && (
          <>
            <div className="text-yellow-400 text-center text-xs animate-pulse">
              uploading file...
            </div>
          </>
        )}
        <div ref={bottomRef}></div>
      </div>

      <div className="flex-shrink-0 border-t border-gray-800 bg-black pt-3">
        <div className="max-w-7xl w-full mx-auto px-4">
          {pendingFile && (
            <div className="mb-2">
              <span className="flex w-full justify-between items-center gap-1 text-xs md:text-base bg-blue-500/10 border border-blue-500/30 px-3 py-3 rounded-md text-blue-300">
                <div className="flex gap-2 items-center">
                  <FiFile size={16} />
                  {pendingFile.name}
                </div>
                <button
                  onClick={removePendingFile}
                  className="ml-1 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <FiX size={16} />
                </button>
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              type="file"
              id="pdf-upload"
              className="hidden"
              accept=".pdf"
              onChange={handleFileSelect}
            />
            <label
              htmlFor={loading ? "" : "pdf-upload"}
              className={`p-3 rounded-xl transition-colors ${
                loading
                  ? "bg-gray-700 cursor-not-allowed opacity-50"
                  : "bg-gray-800 hover:bg-gray-700 cursor-pointer"
              }`}
            >
              <FiUpload size={30} />
            </label>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                loading ? "Waiting for response..." : "Ask anything.."
              }
              rows={2}
              disabled={loading}
              className="flex-1 scrollbar-hide bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />

            <button
              onClick={sendMessage}
              disabled={loading}
              className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
            >
              <FiSend size={30} />
            </button>
          </div>
        </div>

        <p className="md:block hidden text-center text-xs text-gray-500 md:mt-2">
          Shift + Enter for new line • Enter to send
        </p>
      </div>
    </div>
  );
}
