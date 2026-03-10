"use server";

import { createClient } from "@/lib/supabase/server";

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
