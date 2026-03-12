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

/**
 * 检查当前用户今日 AI 调用次数是否在限额内，并在允许时将计数 +1
 *
 * 逻辑：
 * - `max_daily_calls = -1`：无限次，直接放行
 * - `daily_calls_reset_at` 不是今天：自动重置 `daily_calls_count = 0`
 * - `daily_calls_count >= max_daily_calls`：拒绝，返回 allowed=false
 * - 否则：将 `daily_calls_count` +1 后放行
 *
 * @returns {{ allowed: boolean; remaining: number; limit: number }}
 */
export async function checkAndIncrementDailyCall(): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未登录用户直接拒绝
  if (!user) return { allowed: false, remaining: 0, limit: 0 };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("max_daily_calls, daily_calls_count, daily_calls_reset_at")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    console.error("checkAndIncrementDailyCall: fetch profile error", error);
    // 获取 profile 失败时默认放行，避免因 DB 异常阻断用户
    return { allowed: true, remaining: -1, limit: -1 };
  }

  const limit: number = profile.max_daily_calls ?? 5;

  // -1 表示无限调用，直接放行，无需写库
  if (limit === -1) {
    return { allowed: true, remaining: -1, limit: -1 };
  }

  // 计算今天的日期字符串（UTC+8 下与服务器时区保持一致，使用 ISO date 前10位）
  const todayStr = new Date().toISOString().slice(0, 10);
  const resetAtStr: string = profile.daily_calls_reset_at
    ? String(profile.daily_calls_reset_at).slice(0, 10)
    : "";

  // 跨日自动重置
  const currentCount: number =
    resetAtStr === todayStr ? (profile.daily_calls_count ?? 0) : 0;

  // 次数已达上限
  if (currentCount >= limit) {
    return { allowed: false, remaining: 0, limit };
  }

  // 次数 +1 并写回数据库
  const newCount = currentCount + 1;
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      daily_calls_count: newCount,
      daily_calls_reset_at: todayStr,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("checkAndIncrementDailyCall: update error", updateError);
  }

  return { allowed: true, remaining: limit - newCount, limit };
}

/**
 * 查询当前用户今日 AI 调用次数状态（只读，不写库）
 *
 * 用于在 UI 中展示剩余次数信息。
 *
 * @returns {{ used: number; limit: number; remaining: number; unlimited: boolean }}
 */
export async function getDailyCallsStatus(): Promise<{
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { used: 0, limit: 5, remaining: 5, unlimited: false };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("max_daily_calls, daily_calls_count, daily_calls_reset_at")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return { used: 0, limit: 5, remaining: 5, unlimited: false };
  }

  const limit: number = profile.max_daily_calls ?? 5;

  if (limit === -1) {
    return { used: 0, limit: -1, remaining: -1, unlimited: true };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const resetAtStr: string = profile.daily_calls_reset_at
    ? String(profile.daily_calls_reset_at).slice(0, 10)
    : "";

  // 若跨天则视为今日已用 0 次
  const used: number =
    resetAtStr === todayStr ? (profile.daily_calls_count ?? 0) : 0;

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    unlimited: false,
  };
}
