"use client";

import { useEffect, useState } from "react";

type MessageType = "success" | "error" | "info" | "warning";

interface MessageEvent {
  id: string;
  type: MessageType;
  content: string;
  duration?: number;
}

type Listener = (msg: MessageEvent) => void;

class MessageBus {
  private listeners: Listener[] = [];

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit(msg: Omit<MessageEvent, "id">) {
    const id = Math.random().toString(36).slice(2, 9);
    const event: MessageEvent = { ...msg, id };
    this.listeners.forEach((l) => l(event));
  }

  success(content: string, duration = 3000) {
    this.emit({ type: "success", content, duration });
  }

  error(content: string, duration = 3000) {
    this.emit({ type: "error", content, duration });
  }

  info(content: string, duration = 3000) {
    this.emit({ type: "info", content, duration });
  }

  warning(content: string, duration = 3000) {
    this.emit({ type: "warning", content, duration });
  }
}

export const message = new MessageBus();

export function MessageProvider() {
  const [messages, setMessages] = useState<MessageEvent[]>([]);

  useEffect(() => {
    const unsubscribe = message.subscribe((msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.duration && msg.duration > 0) {
        setTimeout(() => {
          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        }, msg.duration);
      }
    });

    return () => unsubscribe();
  }, []);

  if (messages.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {messages.map((msg) => {
        let bgStyle = "";
        if (msg.type === "error") {
          bgStyle = "bg-red-50 text-red-800 border-red-200";
        } else if (msg.type === "success") {
          bgStyle = "bg-green-50 text-green-800 border-green-200";
        } else if (msg.type === "warning") {
          bgStyle = "bg-orange-50 text-orange-800 border-orange-200";
        } else {
          bgStyle = "bg-blue-50 text-blue-800 border-blue-200";
        }

        return (
          <div
            key={msg.id}
            className={`px-4 py-2 rounded-2xl shadow-lg border text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-300 ${bgStyle}`}
          >
            {msg.content}
          </div>
        );
      })}
    </div>
  );
}
