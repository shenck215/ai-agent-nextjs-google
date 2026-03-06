"use client";

import { UIMessage } from "ai";

interface UserMessageProps {
  message: UIMessage;
  msgIndex: number;
  editingId: string | null;
  editingText: string;
  onEditStart: (id: string, text: string) => void;
  onEditChange: (text: string) => void;
  onEditSubmit: (msgIndex: number) => void;
  onEditCancel: () => void;
}

/** 用户消息气泡（含内联编辑） */
export function UserMessage({
  message: m,
  msgIndex,
  editingId,
  editingText,
  onEditStart,
  onEditChange,
  onEditSubmit,
  onEditCancel,
}: UserMessageProps) {
  const isEditing = editingId === m.id;

  return (
    <div className="group relative flex justify-end w-full">
      {isEditing ? (
        // 编辑模式
        <div className="flex flex-col gap-2 items-end w-full max-w-lg">
          <textarea
            autoFocus
            className="w-full min-w-[200px] p-2 border border-orange-400 rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-orange-400 text-gray-800"
            rows={3}
            value={editingText}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onEditSubmit(msgIndex);
              }
              if (e.key === "Escape") onEditCancel();
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={onEditCancel}
              className="px-3 py-1 text-xs rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={() => onEditSubmit(msgIndex)}
              className="px-3 py-1 text-xs rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors cursor-pointer"
            >
              重新发送
            </button>
          </div>
        </div>
      ) : (
        // 静态气泡模式
        <div className="flex flex-col gap-2 items-end">
          {/* 图片 parts */}
          {m.parts.filter((p) => p.type === "file").length > 0 && (
            <div className="flex flex-wrap gap-2 justify-end mb-1">
              {m.parts
                .filter((p) => p.type === "file")
                .map((p, fi) => (
                  <img
                    key={fi}
                    src={(p as any).url}
                    alt={(p as any).filename ?? `image-${fi}`}
                    className="max-h-48 max-w-xs rounded-xl border border-gray-200 object-contain shadow-sm"
                  />
                ))}
            </div>
          )}
          {/* 文字 + 编辑按钮 */}
          <div className="flex items-center gap-2 group/bubble">
            <button
              onClick={() => {
                const text = m.parts
                  .filter((p) => p.type === "text")
                  .map((p) => (p as any).text as string)
                  .join("\n");
                onEditStart(m.id, text);
              }}
              className="shrink-0 opacity-0 group-hover/bubble:opacity-100 transition-opacity px-2 py-1 flex items-center justify-center text-xs rounded-full bg-white border border-orange-500 text-orange-500 hover:bg-orange-50 cursor-pointer shadow-sm"
              title="修改"
            >
              ✎
            </button>
            <div className="bg-orange-500 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm inline-block max-w-[100%] break-words">
              {m.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as any).text as string)
                .join("\n")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
