"use server";
// lib/actions/storage.ts
import { createClient } from "@/lib/supabase/server";

// 这里不需要在顶层初始化 supabase，因为 createClient() 是异步的，
// 我们在每个具体的函数内部去调用 await createClient()。
/** 获取所有对话列表 */
export async function getChatsFromDB(): Promise<any[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .order("updated_at", { ascending: false });
    
  if (error) {
    console.error("fetch chats error", error);
    return [];
  }
  return data.map(dbChat => ({
    id: dbChat.id,
    title: dbChat.title,
    updatedAt: new Date(dbChat.updated_at).getTime(),
    model: dbChat.model_id as any,
    messages: [] // 后续用到时再加载
  }));
}

/** 获取特定对话的消息记录 */
export async function getMessagesFromDB(chatId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
    
  if (error) {
    console.error("fetch messages error", error);
    return [];
  }
  return data.map(dbMsg => ({
    id: dbMsg.id,
    role: dbMsg.role,
    content: dbMsg.content || "",
    parts: dbMsg.parts || [],
    createdAt: new Date(dbMsg.created_at)
  }));
}

/** 新增或更新对话（标题、模型等信息） */
export async function upsertChatInDB(chatId: string, title: string, model: string) {
  const supabase = await createClient();
  
  // 必须指定 user_id 或者是走数据库 default auth.uid()
  // 但 upsert 如果不存在会自动 insert，由于我们开启了 RLS，所以会自动填入 default 的 auth.uid() （前提是 auth() 有效）。
  // 为了安全和明确，我们可以明确传入 user_id，或者依赖 default。
  // 我们这里先获取一下 session 确认
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("upsert chat error: unauthorized");
    return;
  }

  const { error } = await supabase.from("chats").upsert({
    id: chatId,
    title,
    model_id: model,
    user_id: user.id, // 明确关联当前用户
    updated_at: new Date().toISOString()
  });
  if (error) {
    console.error("upsert chat error", error);
  }
}

/** 删除指定对话 */
export async function deleteChatInDB(chatId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("chats").delete().eq("id", chatId);
  if (error) {
    console.error("delete chat error", error);
  }
}

