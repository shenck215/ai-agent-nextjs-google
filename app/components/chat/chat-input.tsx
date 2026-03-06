"use client";

interface ChatInputProps {
  input: string;
  status: string;
  model: "fast" | "thinking" | "image";
  selectedFiles: globalThis.File[];
  previewUrls: string[];
  isDragging: boolean;
  onInputChange: (text: string) => void;
  onModelChange: (model: "fast" | "thinking" | "image") => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  onAddFiles: (files: globalThis.File[]) => void;
  onRemoveFile: (index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

/** 消息输入区：文件上传 + 图片预览条 + 输入框 + 模型切换 + 发送/停止 */
export function ChatInput({
  input,
  status,
  model,
  selectedFiles,
  previewUrls,
  isDragging,
  onInputChange,
  onModelChange,
  onSubmit,
  onStop,
  onAddFiles,
  onRemoveFile,
  onDragOver,
  onDragLeave,
  onDrop,
  fileInputRef,
}: ChatInputProps) {
  return (
    <div
      className={`w-full max-w-3xl mx-auto py-4 flex flex-col gap-2 border-t border-gray-200 transition-all ${
        isDragging ? "opacity-80" : ""
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* 图片预览条 */}
      {previewUrls.length > 0 && (
        <div className="flex gap-2 flex-wrap bg-white rounded-xl shadow-xl border border-gray-200 p-2">
          {previewUrls.map((url, i) => (
            <div key={i} className="relative group">
              <img
                src={url}
                alt={selectedFiles[i]?.name ?? `image-${i}`}
                className="h-16 w-16 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => onRemoveFile(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer leading-none"
              >
                ✕
              </button>
            </div>
          ))}
          {isDragging && (
            <div className="h-16 w-16 rounded-lg border-2 border-dashed border-blue-400 flex items-center justify-center text-blue-400 text-xl">
              +
            </div>
          )}
        </div>
      )}

      {/* 拖拽放置提示（无预览图时） */}
      {isDragging && previewUrls.length === 0 && (
        <div className="flex items-center justify-center h-16 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50 text-blue-500 text-sm">
          📷 松开鼠标上传图片
        </div>
      )}

      {/* 隐藏文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onAddFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <form onSubmit={onSubmit} className="flex gap-2">
        {/* 上传图片按钮 */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={status !== "ready"}
          className="px-3 py-2 rounded border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors cursor-pointer shadow-xl text-base disabled:opacity-40 disabled:cursor-not-allowed"
          title="上传图片（也支持粘贴 / 拖拽）"
        >
          📎
        </button>

        {/* 文字输入框 */}
        <input
          className="flex-1 p-2 border border-gray-300 rounded shadow-xl bg-white focus:ring-orange-500 focus:border-transparent"
          value={input}
          placeholder={
            status !== "ready"
              ? "噜噜正在思考中，请稍等或点击停止…"
              : "和噜噜聊聊吧～（支持粘贴或拖拽图片）"
          }
          onChange={(e) => onInputChange(e.target.value)}
          disabled={status !== "ready"}
        />

        {status !== "ready" ? (
          <button
            type="button"
            onClick={onStop}
            className="px-4 py-2 rounded bg-red-500 text-white text-sm hover:bg-red-600 transition-colors cursor-pointer shadow-xl whitespace-nowrap"
          >
            ⏹ 停止
          </button>
        ) : (
          <div className="flex gap-2">
            {/* 模型切换 */}
            <select
              value={model}
              onChange={(e) =>
                onModelChange(e.target.value as "fast" | "thinking" | "image")
              }
              className="rounded shadow-xl border border-gray-300 bg-white text-gray-600 cursor-pointer transition-colors hover:bg-gray-50 focus:outline-none focus:ring-orange-500 focus:border-transparent"
            >
              <option value="fast">⚡ 快速</option>
              <option value="thinking">💭 思考</option>
              <option value="image">🖼️ 生图</option>
            </select>
            {/* 发送按钮 */}
            <button
              type="submit"
              disabled={!input.trim() && selectedFiles.length === 0}
              className="px-4 py-2 rounded bg-orange-500 text-white text-sm hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-lg whitespace-nowrap font-bold"
            >
              发送
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
