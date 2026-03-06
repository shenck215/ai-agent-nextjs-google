"use client";

import React, { useState, useEffect } from "react";

import { UIMessage } from "ai";
import MarkdownRenderer from "@/app/components/markdown-renderer";
import { ToolResult } from "./tool-result";
import { downloadBase64 } from "@/lib/utils/chat";

interface AssistantMessageProps {
  message: UIMessage;
  status: string;
  reasoningTimers: Map<string, { startMs: number; doneMs?: number }>;
  onViewImage: (url: string) => void;
}

/** AI 消息内容区：遍历 parts，分发渲染各类型 */
export function AssistantMessage({
  message: m,
  status,
  reasoningTimers,
  onViewImage,
}: AssistantMessageProps) {
  // 利用 state 管理当前时间以规避 Date.now() 在 render 中的不纯调用警告
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    // 只有在存在未完成的 reasoning 块且处于流式输出时才更新时间
    if (status === "streaming" || status === "submitted") {
      const timer = setInterval(() => setNowMs(Date.now()), 100);
      return () => clearInterval(timer);
    }
  }, [status]);

  return (
    <div className="ml-4 w-full">
      {m.parts.map((part, index) => {
        // reasoning 思考过程
        if (part.type === "reasoning") {
          const timerKey = `${m.id}-${index}`;
          const timer = reasoningTimers.get(timerKey);
          const isDone = part.state === "done";
          const elapsedSec = timer
            ? (((timer.doneMs ?? nowMs) - timer.startMs) / 1000).toFixed(1)
            : null;
          const previewText = !isDone
            ? ((part.text as string)
                .split("\n")
                .filter((l: string) => l.trim())
                .at(-1) ?? "")
            : null;

          return (
            <details
              key={index}
              className="mb-3 border border-gray-200 rounded-lg overflow-hidden text-sm"
            >
              <summary className="flex flex-col px-3 py-2 bg-gray-50 cursor-pointer select-none hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                  <span>💭</span>
                  <span>{isDone ? "思考过程" : "思考中..."}</span>
                  {elapsedSec && (
                    <span className="ml-1 text-gray-300">· {elapsedSec}s</span>
                  )}
                  <span className="ml-auto text-gray-300">点击展开</span>
                </div>
                {previewText && (
                  <div className="mt-1 text-xs text-gray-400 truncate max-w-full whitespace-pre-wrap">
                    {previewText}
                  </div>
                )}
              </summary>
              <div className="px-3 py-2 bg-white text-gray-500 text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-72 overflow-y-auto [scrollbar-width:thin]">
                {part.text}
              </div>
            </details>
          );
        }

        // 停止提示
        if ((part as any).type === "stopped-notice") {
          return (
            <p
              key={index}
              className="mt-3 text-xs italic text-orange-500/80 flex items-center gap-1.5 select-none"
            >
              <span>⏹</span>
              <span>你已让系统停止这条回答</span>
            </p>
          );
        }

        // 文本
        if (part.type === "text") {
          return <MarkdownRenderer key={index} content={part.text} />;
        }

        // AI 生成的图片
        if (part.type === "file") {
          const imgUrl = (part as any).url as string;
          return (
            <div key={index} className="my-2 group relative inline-block">
              <img
                src={imgUrl}
                alt="AI 生成的图片"
                className="max-w-full max-h-96 rounded-xl border border-gray-200 shadow-sm cursor-zoom-in block"
                onClick={() => onViewImage(imgUrl)}
              />
              <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onViewImage(imgUrl)}
                  className="px-2 py-1 rounded bg-black/60 text-white text-xs cursor-pointer hover:bg-black/80 transition-colors"
                >
                  ⛶ 放大
                </button>
                <button
                  onClick={() => downloadBase64(imgUrl)}
                  className="px-2 py-1 rounded bg-black/60 text-white text-xs cursor-pointer hover:bg-black/80 transition-colors"
                >
                  ↓ 下载
                </button>
              </div>
            </div>
          );
        }

        // 工具调用
        if (part.type.startsWith("tool-")) {
          return (
            <ToolResult
              key={index}
              part={part}
              index={index}
              onViewImage={onViewImage}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
