"use client";

interface ErrorToastProps {
  msg: string;
  onClose: () => void;
}

/** 固定定位错误提示 Toast */
export function ErrorToast({ msg, onClose }: ErrorToastProps) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 animate-in slide-in-from-top-2">
      <span className="text-lg leading-none mt-0.5">⚠️</span>
      <p className="flex-1 text-sm leading-snug">{msg}</p>
      <button
        onClick={onClose}
        className="text-red-400 hover:text-red-600 transition-colors cursor-pointer leading-none"
      >
        ✕
      </button>
    </div>
  );
}
