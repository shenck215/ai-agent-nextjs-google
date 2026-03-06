"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useCallback, useEffect, useRef } from "react";

import {
  ChatSession,
  generateId,
  filesToFileUIParts,
} from "@/lib/utils/chat";

// 子组件
import { LoadingSpinner } from "./components/chat/loading-spinner";
import { ErrorToast } from "./components/chat/error-toast";
import { CopyButton } from "./components/chat/copy-button";
import { ImageViewer } from "./components/chat/image-viewer";
import { UserMessage } from "./components/chat/user-message";
import { AssistantMessage } from "./components/chat/assistant-message";
import { ChatInput } from "./components/chat/chat-input";
import { Sidebar } from "./components/sidebar";

function ChatWindow({
  session,
  onSaveSession,
}: {
  session: ChatSession;
  onSaveSession: (session: ChatSession) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isUserScrolled = useRef(false);
  const stoppedByUser = useRef(false);
  const [bgColor, setBgColor] = useState<string>("#ffffff");
  const [model, setModel] = useState<"fast" | "thinking" | "image">(
    session.model || "fast",
  );
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
    error,
    clearError,
  } = useChat({
    id: session.id,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isInitialized = useRef(false);

  useEffect(() => {
    if (session.messages?.length > 0) {
      setMessages(session.messages);
    }
    isInitialized.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  useEffect(() => {
    if (!isInitialized.current) return;
    if (
      messages.length > 0 ||
      session.messages.length === 0 ||
      session.model !== model
    ) {
      onSaveSession({ ...session, messages, model });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, model]);

  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback((files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setSelectedFiles((prev) => [...prev, ...images]);
    setPreviewUrls((prev) => [
      ...prev,
      ...images.map((f) => URL.createObjectURL(f)),
    ]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const clearFiles = useCallback(() => {
    setPreviewUrls((prev) => {
      prev.forEach(URL.revokeObjectURL);
      return [];
    });
    setSelectedFiles([]);
  }, []);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const handleEditSubmit = useCallback(
    (msgIndex: number) => {
      const text = editingText.trim();
      if (!text) return;
      setMessages(messages.slice(0, msgIndex));
      setEditingId(null);
      setEditingText("");
      isUserScrolled.current = false;
      setTimeout(() => sendMessage({ text }, { body: { model } }), 0);
    },
    [editingText, messages, model, sendMessage, setMessages],
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageFiles = items
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter(Boolean) as File[];
      if (imageFiles.length) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addFiles]);

  useEffect(() => {
    if (!error) return;
    let msg = error.message;
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      // keep original
    }
    setToastMsg(msg);
    clearError();
    const t = setTimeout(() => setToastMsg(null), 5000);
    return () => clearTimeout(t);
  }, [error, clearError]);

  const [reasoningTimers, setReasoningTimers] = useState<
    Map<string, { startMs: number; doneMs?: number }>
  >(() => new Map());

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    let lastScrollTop = container.scrollTop;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceToBottom <= 50) {
        isUserScrolled.current = false;
      } else if (lastScrollTop - scrollTop > 5) {
        isUserScrolled.current = true;
      }
      lastScrollTop = scrollTop;
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isUserScrolled.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status]);

  useEffect(() => {
    if (status === "ready") {
      isUserScrolled.current = false;
      if (stoppedByUser.current) {
        stoppedByUser.current = false;
        setMessages((prev) => {
          if (!prev.length) return prev;
          const last = prev[prev.length - 1];
          if (last.role === "assistant") {
            const updated = {
              ...last,
              parts: [...last.parts, { type: "stopped-notice" as any }],
            };
            return [...prev.slice(0, -1), updated];
          }
          return [
            ...prev,
            {
              id: generateId(),
              role: "assistant" as const,
              content: "",
              parts: [{ type: "stopped-notice" as any }],
              createdAt: new Date(),
            },
          ];
        });
      }
    }
  }, [status, setMessages]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === "assistant") {
      lastMessage.parts.forEach((part: any) => {
        const aiColor = part.output?.activeColor;
        if (
          part.type === "tool-updateTheme" &&
          aiColor !== bgColor &&
          CSS.supports("color", aiColor)
        ) {
          setBgColor(aiColor);
        }
      });
    }
  }, [bgColor, messages]);

  useEffect(() => {
    setReasoningTimers((prev) => {
      const next = new Map(prev);
      let changed = false;
      messages.forEach((msg) => {
        msg.parts.forEach((part: any, idx: number) => {
          if (part.type !== "reasoning") return;
          const key = `${msg.id}-${idx}`;
          const entry = next.get(key);
          if (!entry) {
            next.set(key, { startMs: Date.now() });
            changed = true;
          } else if (part.state === "done" && !entry.doneMs) {
            next.set(key, { ...entry, doneMs: Date.now() });
            changed = true;
          }
        });
      });
      return changed ? next : prev;
    });
  }, [messages]);

  return (
    <div
      className="transition-colors duration-700 h-full flex flex-col relative"
      style={{ backgroundColor: bgColor }}
    >
      {viewingImage && (
        <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />
      )}

      {toastMsg && (
        <ErrorToast msg={toastMsg} onClose={() => setToastMsg(null)} />
      )}

      <div
        ref={scrollContainerRef}
        className="flex flex-col w-full max-w-3xl pt-16 pb-6 mx-auto flex-1 overflow-y-auto [scrollbar-width:none]"
      >
        {messages.map((m, msgIndex) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`whitespace-pre-wrap mb-4 flex w-full ${
                isUser ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`flex flex-col gap-1 w-full max-w-[90%] ${
                  isUser ? "items-end" : "items-start"
                }`}
              >
                {!isUser && (
                  <div className="font-bold flex items-center gap-2 mb-1">
                    <span className="font-extrabold text-orange-500">噜噜:</span>
                    {msgIndex === messages.length - 1 &&
                      (status === "streaming" || status === "submitted") && (
                        <LoadingSpinner />
                      )}
                  </div>
                )}

                {isUser ? (
                  <UserMessage
                    message={m}
                    msgIndex={msgIndex}
                    editingId={editingId}
                    editingText={editingText}
                    onEditStart={(id, text) => {
                      setEditingId(id);
                      setEditingText(text);
                    }}
                    onEditChange={setEditingText}
                    onEditSubmit={handleEditSubmit}
                    onEditCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <AssistantMessage
                      message={m}
                      status={status}
                      reasoningTimers={reasoningTimers}
                      onViewImage={setViewingImage}
                    />
                    {!(msgIndex === messages.length - 1 && status !== "ready") && (
                      <CopyButton
                        text={m.parts
                          .filter((p) => p.type === "text")
                          .map((p) => (p as any).text as string)
                          .join("\n")}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {status === "submitted" && (
          <div className="whitespace-pre-wrap mb-4">
            <div className="font-bold mb-1 flex items-center gap-2">
              <span className="font-extrabold text-orange-500">噜噜:</span>
              <LoadingSpinner />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <ChatInput
        input={input}
        status={status}
        model={model}
        selectedFiles={selectedFiles}
        previewUrls={previewUrls}
        isDragging={isDragging}
        onInputChange={setInput}
        onModelChange={setModel}
        onSubmit={async (e) => {
          e.preventDefault();
          const hasText = !!input.trim();
          const hasFiles = selectedFiles.length > 0;
          if ((!hasText && !hasFiles) || status !== "ready") return;
          const filesParts = hasFiles
            ? await filesToFileUIParts(selectedFiles)
            : [];
          isUserScrolled.current = false;
          if (hasText && hasFiles) {
            sendMessage({ text: input, files: filesParts }, { body: { model } });
          } else if (hasText) {
            sendMessage({ text: input }, { body: { model } });
          } else {
            sendMessage({ files: filesParts }, { body: { model } });
          }
          setInput("");
          clearFiles();
        }}
        onStop={() => {
          stoppedByUser.current = true;
          stop();
        }}
        onAddFiles={addFiles}
        onRemoveFile={removeFile}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
        fileInputRef={fileInputRef}
      />
    </div>
  );
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("chat_sessions");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        const sanitizedSessions = sessions.map((session) => ({
          ...session,
          messages: session.messages.map((msg) => ({
            ...msg,
            parts: msg.parts
              ? msg.parts.map((p: any) => {
                  if (
                    p.type === "file" &&
                    typeof p.url === "string" &&
                    p.url.startsWith("data:")
                  ) {
                    return { ...p, url: "" };
                  }
                  return p;
                })
              : [],
          })),
        }));
        localStorage.setItem("chat_sessions", JSON.stringify(sanitizedSessions));
      } catch (e) {
        console.error("Failed to save to localStorage:", e);
      }
    }
  }, [sessions, isLoaded]);

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: generateId(),
      title: "新对话",
      updatedAt: Date.now(),
      messages: [],
      model: "fast",
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeSessionId === id) {
        setActiveSessionId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  if (!isLoaded)
    return (
      <div
        className="h-screen w-full flex items-center justify-center"
        style={{ background: "#FFFBF0" }}
      >
        <span className="text-orange-500 text-2xl animate-pulse">噜噜来啦…</span>
      </div>
    );

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={setActiveSessionId}
        onDeleteSession={handleDeleteChat}
      />

      <div
        className="flex-1 relative h-full flex flex-col"
        style={{ background: "#FFFBF0" }}
      >
        {activeSession ? (
          <>
            <div className="h-14 flex justify-center items-center px-6 shrink-0 bg-white/90 backdrop-blur z-10 absolute top-0 w-full">
              <h2
                className="text-xl text-gray-800 truncate"
                title={activeSession.title}
              >
                {activeSession.title}
              </h2>
            </div>
            <ChatWindow
              key={activeSession.id}
              session={activeSession}
              onSaveSession={(updated) => {
                setSessions((prev) =>
                  prev.map((s) => {
                    if (s.id === updated.id) {
                      let newTitle = s.title;
                      if (updated.messages.length > 0 && s.title === "新对话") {
                        const firstUserMsg = updated.messages.find(
                          (m) => m.role === "user",
                        );
                        if (firstUserMsg) {
                          const textParts = firstUserMsg.parts.filter(
                            (p: any) => p.type === "text",
                          );
                          const text = textParts
                            .map((p: any) => p.text)
                            .join(" ")
                            .trim();
                          if (text) {
                            newTitle =
                              text.substring(0, 15) +
                              (text.length > 15 ? "..." : "");
                          } else {
                            newTitle = "图片对话";
                          }
                        }
                      }

                      let newUpdatedAt = Math.max(
                        updated.updatedAt,
                        s.updatedAt,
                      );
                      if (updated.messages.length > s.messages.length) {
                        newUpdatedAt = Date.now();
                      }

                      return {
                        ...updated,
                        title: newTitle,
                        updatedAt: newUpdatedAt,
                      };
                    }
                    return s;
                  }),
                );
              }}
            />
          </>
        ) : (
          <div className="h-full flex items-center justify-center flex-col gap-4 bg-gray-50">
            <div className="text-gray-400">没有选中的对话</div>
            <button
              onClick={handleNewChat}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors cursor-pointer shadow-sm text-sm"
            >
              新建对话
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
