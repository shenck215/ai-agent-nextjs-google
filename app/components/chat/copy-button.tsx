"use client";

import { useState, useCallback } from "react";
import { copyToClipboard } from "@/lib/utils/chat";

/** AI 回复底部的「复制回答」按钮 */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="mt-2 px-2 py-0.5 text-xs rounded border border-orange-500 text-orange-500 hover:bg-orange-50 transition-colors cursor-pointer"
    >
      {copied ? "✓ 已复制" : "复制回答"}
    </button>
  );
}
