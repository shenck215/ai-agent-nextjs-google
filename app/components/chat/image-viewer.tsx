"use client";

import { useEffect } from "react";
import { downloadBase64 } from "@/lib/utils/chat";

interface ImageViewerProps {
  src: string;
  onClose: () => void;
}

/** 图片灯箱：全屏预览 + 下载 + ESC 关闭 */
export function ImageViewer({ src, onClose }: ImageViewerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt="预览图片"
          className="max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain"
        />
        <div className="flex gap-3">
          <button
            onClick={() => downloadBase64(src)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors cursor-pointer"
          >
            ↓ 下载图片
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors cursor-pointer"
          >
            ✕ 关闭
          </button>
        </div>
      </div>
    </div>
  );
}
