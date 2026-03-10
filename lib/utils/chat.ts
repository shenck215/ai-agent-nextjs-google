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
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback for older browsers just in case
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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

/**
 * 客户端图片下载实用函数（自适应 Base64 / 网络资源 URL）
 * 
 * 机制：
 * 1. 拦截 URL 或 Base64 字符串。
 * 2. 使用 fetch 将其转换为 blob 对象，以保证跨域兼容性及正确获取扩展名。
 * 3. 动态生成 object URL 并使用虚拟 a 标签触发文件下载。
 * 
 * @param imageUrl 需要下载的图片链接或 Base64 字符串
 * @param customName 默认保存的文件名称前缀（可选）
 */
export const downloadImage = async (imageUrl: string, customName = "ai_image") => {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const extension = blob.type.split("/")[1] || "png";
    const fullFileName = `${customName}_${Math.random().toString(36).substring(2, 7)}.${extension}`;

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fullFileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    console.error("Failed to download image:", err);
  }
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
