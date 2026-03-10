/**
 * 客户端 Supabase 工具：图片上传 + 消息同步
 * 直接在浏览器中操作，不经过 Server Action 通道，无 1MB 体积限制
 */
import { createClient } from "@/lib/supabase/client";
/**
 * 将 base64 图片上传到 Supabase Storage 并返回公开访问链接
 */
export async function uploadImageClient(
  base64Data: string,
  fileName: string,
  mediaType: string,
): Promise<string> {
  const supabase = createClient();
  const base64Str = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const ext = mediaType.split("/")[1];
  const path = `${Date.now()}_${fileName.replace(/\.[^.]+$/, "")}.${ext}`;

  const byteString = atob(base64Str);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mediaType });

  const { error } = await supabase.storage
    .from("chat-images")
    .upload(path, blob, { contentType: mediaType });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("chat-images").getPublicUrl(path);

  return publicUrl;
}

/**
 * 将消息列表同步到 Supabase messages 表（客户端调用，无体积限制）
 * 策略：先 DELETE 该对话的旧消息，再 INSERT 新消息，不依赖 AI SDK 的消息 id
 */
export async function syncMessagesClient(
  chatId: string,
  messages: any[],
): Promise<void> {
  if (!messages || messages.length === 0) return;
  const supabase = createClient();

  // 先删除旧消息
  const { error: delError } = await supabase
    .from("messages")
    .delete()
    .eq("chat_id", chatId);

  if (delError) {
    console.error("[syncMessages] delete error:", delError);
    return;
  }

  // 直接存入完整 parts（含公开 URL 或 base64 占位），客户端调用无体积限制
  const records = messages.map((msg, index) => ({
    chat_id: chatId,
    role: msg.role,
    content: msg.content || "",
    parts: msg.parts || [],
    created_at: msg.createdAt
      ? new Date(msg.createdAt).toISOString()
      : new Date(Date.now() + index).toISOString(),
  }));

  const { error } = await supabase.from("messages").insert(records);
  if (error) {
    console.error("[syncMessages] insert error:", error);
  }
}
