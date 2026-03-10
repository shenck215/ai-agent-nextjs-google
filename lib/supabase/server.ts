import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // 读取 Cookie
        getAll() {
          return cookieStore.getAll();
        },
        // 写入 Cookie (仅在 Server Actions 或 Route Handlers 中生效)
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component 中无法设置 cookie，这在 Next.js 中是正常的
          }
        },
      },
    },
  );
}
