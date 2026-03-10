"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ChatSession, generateId, filesToFileUIParts } from "@/lib/utils/chat";

import {
  getChatsFromDB,
  getMessagesFromDB,
  upsertChatInDB,
  deleteChatInDB,
} from "@/lib/actions/storage";
import { uploadImageClient, syncMessagesClient } from "@/lib/utils/upload";

// 子组件
import { LoadingSpinner } from "@/app/components/chat/loading-spinner";
import { ErrorToast } from "@/app/components/chat/error-toast";
import { CopyButton } from "@/app/components/chat/copy-button";
import { ImageViewer } from "@/app/components/chat/image-viewer";
import { UserMessage } from "@/app/components/chat/user-message";
import { AssistantMessage } from "@/app/components/chat/assistant-message";
import { ChatInput } from "@/app/components/chat/chat-input";
import { Sidebar } from "@/app/components/sidebar";

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
  const prevStatus = useRef(status);

  useEffect(() => {
    if (session.messages?.length > 0) {
      setMessages(session.messages);
    }
    isInitialized.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // 仅更新 React 状态（标题/model 等），不触发 DB 写入
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

  // 仅在 streaming 结束（status 变为 ready）时才写入 DB，避免流式过程中频繁请求
  useEffect(() => {
    const wasStreaming =
      prevStatus.current === "streaming" || prevStatus.current === "submitted";
    prevStatus.current = status;
    if (status === "ready" && wasStreaming && messages.length > 0) {
      // 计算最新标题（如果还是"新对话"，就取第一条用户消息前 15 字）
      let title = session.title;
      if (title === "新对话") {
        const firstUserMsg = messages.find((m) => m.role === "user");
        if (firstUserMsg) {
          const textParts = firstUserMsg.parts.filter(
            (p: any) => p.type === "text",
          );
          const text = textParts
            .map((p: any) => p.text)
            .join(" ")
            .trim();
          title = text
            ? text.substring(0, 15) + (text.length > 15 ? "..." : "")
            : "图片对话";
        }
      }
      upsertChatInDB(session.id, title, model).catch(console.error);

      // 只处理最后一条 assistant 消息里 AI 生成的图片（历史消息已是公开 URL）
      const uploadAiImages = async () => {
        const lastMsg = messages[messages.length - 1];

        // 最后一条不是 assistant，或者没有 base64 图片，直接同步
        const base64Parts =
          lastMsg?.role === "assistant"
            ? (lastMsg.parts as any[]).filter(
                (p: any) =>
                  p.type === "file" &&
                  typeof p.url === "string" &&
                  p.url.startsWith("data:image"),
              )
            : [];

        if (base64Parts.length === 0) {
          syncMessagesClient(session.id, messages).catch(console.error);
          return;
        }

        // 有 base64 图片，尝试全部上传
        let uploadedCount = 0;
        const newParts = await Promise.all(
          (lastMsg.parts as any[]).map(async (p: any) => {
            if (
              p.type === "file" &&
              typeof p.url === "string" &&
              p.url.startsWith("data:image")
            ) {
              try {
                const publicUrl = await uploadImageClient(
                  p.url,
                  `ai_image_${Date.now()}.png`,
                  p.mediaType || "image/png",
                );
                uploadedCount++;
                return { ...p, url: publicUrl };
              } catch (err) {
                console.error("AI image upload failed:", err);
              }
            }
            return p;
          }),
        );

        if (uploadedCount > 0) {
          // 至少有一张上传成功，更新 state 并同步 DB
          const patched = [
            ...messages.slice(0, -1),
            { ...lastMsg, parts: newParts },
          ];
          setMessages(patched as any);
          syncMessagesClient(session.id, patched).catch(console.error);
        } else {
          // 全部上传失败：跳过本次 DB 同步，避免 DELETE 成功但 INSERT 失败导致数据丢失
          console.error(
            "All AI image uploads failed, skipping DB sync to preserve existing data",
          );
        }
      };
      uploadAiImages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
                    <span className="font-extrabold text-orange-500">
                      噜噜:
                    </span>
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
                      onImageLoad={() => {
                        if (!isUserScrolled.current) {
                          bottomRef.current?.scrollIntoView({
                            behavior: "smooth",
                          });
                        }
                      }}
                    />
                    {!(
                      msgIndex === messages.length - 1 && status !== "ready"
                    ) && (
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

          for (const part of filesParts) {
            if (
              part.type === "file" &&
              typeof part.url === "string" &&
              part.url.startsWith("data:image")
            ) {
              try {
                const publicUrl = await uploadImageClient(
                  part.url,
                  part.filename || `upload_${Date.now()}.png`,
                  part.mediaType,
                );
                part.url = publicUrl;
              } catch (err) {
                console.error("Failed to upload image", err);
              }
            }
          }

          isUserScrolled.current = false;
          if (hasText && hasFiles) {
            sendMessage(
              { text: input, files: filesParts },
              { body: { model } },
            );
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

/**
 * 封装的内部聊天应用，包裹了所有的 state 与 effect
 * 使用 useRouter / useSearchParams 获取活动会话 id
 */
function AppContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSessionId = searchParams.get("id");

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    getChatsFromDB().then(async (dbChats) => {
      // 如果 URL 上已有 id ，就预先加载该会话的消息
      const urlId = new URLSearchParams(window.location.search).get("id");
      if (urlId) {
        const target = dbChats.find((c) => c.id === urlId);
        if (target) {
          const msgs = await getMessagesFromDB(urlId);
          target.messages = msgs as any;
        }
      }
      setSessions(dbChats);
      setIsLoaded(true);
    });
  }, []);

  /**
   * 处理选择左侧会话
   * 1. 根据 URL 加载对应会话的消息
   * 2. 如果之前未加载消息，则从 Supabase 懒加载
   * 3. 推送新 id 到 URL 触发视图更新
   */
  const handleSelectSession = async (id: string) => {
    const session = sessions.find((s) => s.id === id);
    // 先把消息加载进 sessions 状态，再导航，避免 ChatWindow 拿到空消息列表
    if (session && session.messages.length === 0) {
      const msgs = await getMessagesFromDB(id);
      if (msgs.length > 0) {
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, messages: msgs as any } : s)),
        );
      }
    }
    router.push(`?id=${id}`);
  };

  /**
   * 新建对话
   * 初始化一个空聊天，存入 DB，并导航到新 id
   */
  const handleNewChat = async () => {
    const newSession: ChatSession = {
      id: generateId(),
      title: "新对话",
      updatedAt: Date.now(),
      messages: [],
      model: "fast",
    };
    await upsertChatInDB(newSession.id, newSession.title, newSession.model!);
    setSessions((prev) => [newSession, ...prev]);
    router.push(`?id=${newSession.id}`);
  };

  /**
   * 删除指定的对话
   * 清除 DB，并更新 state，若删除的是当前选中的则清空 URL
   */
  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteChatInDB(id);
    // router.push 必须在 setSessions 回调之外调用，否则报渲染期间更新 Router 的错误
    if (activeSessionId === id) {
      router.push("/");
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  if (!isLoaded)
    return (
      <div
        className="h-screen w-full flex items-center justify-center"
        style={{ background: "#FFFBF0" }}
      >
        <span className="text-orange-500 text-2xl animate-pulse">
          噜噜来啦…
        </span>
      </div>
    );

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
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

export default function App() {
  return (
    <Suspense>
      <AppContent />
    </Suspense>
  );
}
