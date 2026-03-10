import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // 浏览器环境下，supabase 会自动处理 cookie
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
