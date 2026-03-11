"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * 获取当前用户的个人信息档案 (Profile)
 *
 * 该方法会在获取档案对象前先行校验用户的真实授权身份（Supabase Auth Session），
 * 并根据 user.id 查询公开档案库中的记录。
 *
 * @returns {Promise<any | null>} 返回档案对象；若用户未登录或无档案记录则返回 null
 */
export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error("fetch profile error", error);
    return null;
  }
  return data;
}

/**
 * 更新或创建当前用户的个人信息档案 (Upsert)
 *
 * 此动作将根据授权凭证直接向 Profiles 表插入/覆盖关联用户 ID 的专属记录。
 * 针对需要修改头像、设定自定义称呼的设置页 (ProfilePage) 提供写入操作。
 *
 * @param nickname 用户希望展示的昵称
 * @param avatarUrl 已经上传至 Storage 并获得公开读取权限的图片链接
 * @throws {Error} 未授权时抛出 HTTP Error 或直接外抛 Supabase DB Error
 */
export async function upsertProfile(nickname: string, avatarUrl: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    nickname,
    avatar_url: avatarUrl,
    updated_at: new Date().toISOString()
  });

  if (error) {
    console.error("upsert profile error", error);
    throw error;
  }
}
