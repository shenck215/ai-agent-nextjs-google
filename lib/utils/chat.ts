import { FileUIPart, UIMessage } from "ai";

/** 聊天会话类型 */
export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
  model?: "fast" | "thinking" | "image";
};

/** 生成随机短 ID */
export function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

/** 复制文本到剪贴板（兼容 HTTP 环境） */
export async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.cssText = "position:fixed;top:-9999px;left:-9999px";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

/** Base64 图片下载 */
export const downloadBase64 = (base64String: string, customName = "ai_image") => {
  const mimeType = base64String.match(/:(.*?);/)?.[1];
  const extension = mimeType?.split("/")[1];
  const fullFileName = `${customName}_${Math.random().toString(36).substring(2, 7)}.${extension}`;

  fetch(base64String)
    .then((res) => res.blob())
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fullFileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    });
};

/** File → DataURL */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** File[] → FileUIPart[] */
export async function filesToFileUIParts(files: File[]): Promise<FileUIPart[]> {
  return Promise.all(
    files.map(async (f) => ({
      type: "file" as const,
      mediaType: f.type || "image/png",
      filename: f.name,
      url: await readFileAsDataURL(f),
    })),
  );
}
