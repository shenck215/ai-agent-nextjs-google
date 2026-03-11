"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * 获取当前用户所有的对话列表 (Chat Sessions)
 *
 * 默认按照更新时间降序排列，仅返回对话的元数据（标题、模型型号、更新时刻）。
 * 实际消息记录 (messages) 数组将在此被初始化为空，待进入特定会话时按需懒加载。
 *
 * @returns {Promise<any[]>} 会话概要列表
 */
export async function getChats(): Promise<any[]> {
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

/**
 * 获取特定对话 (Chat) 的完整历史消息记录
 *
 * 按照消息创建时间戳进行正序排列，用于还原聊天上下文流。
 * 
 * @param {string} chatId - 对话的唯一标识符
 * @returns {Promise<any[]>} 该对话下的所有历史消息
 */
export async function getMessages(chatId: string) {
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

/**
 * 新增或更新对话元信息 (Upsert Chat)
 *
 * 会先行检索系统中的当前用户凭证，并自动建立外键关联。
 * 如果给定 chatId 在数据库中已存在，则更新标题及模型偏好；反之则插入一条新会话。
 *
 * @param {string} chatId - 客户端提供或生成的唯一对话ID
 * @param {string} title - AI 智能推导出的标题或用户自定义标题
 * @param {string} model - 用户在此会话偏好使用的模型型号
 */
export async function saveChat(chatId: string, title: string, model: string) {
  const supabase = await createClient();
  
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

/**
 * 彻底删除指定的对话
 *
 * 这将会依靠 Supabase DB 层面的外键 CASCADED 设置连带清除属于该对话的所有对应 Messages 消息。
 *
 * @param {string} chatId - 需要抹除的对话ID
 */
export async function deleteChat(chatId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("chats").delete().eq("id", chatId);
  if (error) {
    console.error("delete chat error", error);
  }
}
