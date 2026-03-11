"use client";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { message } from "@/app/components/ui/message";

export default function LoginPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 检查 URL 中的 hash 错误（例如因邮箱自动扫描导致链接在用户点击前已失效）
    const hash = window.location.hash;
    if (hash && hash.includes("error=access_denied")) {
      if (hash.includes("otp_expired")) {
        message.warning(
          "登录链接已失效。如果您的邮箱会自动扫描链接，请尝试右键复制链接并在浏览器中打开。",
          5000,
        );
      } else {
        message.error("登录验证失败，请重新尝试。", 5000);
      }
      // 避免刷新页面后再次提示报错
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const email = new FormData(e.currentTarget).get("email") as string;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      message.error("发送失败：" + error.message);
    } else {
      message.success("✨ 登录魔法链接已发送到您的邮箱，请查收！");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-4xl shadow-2xl overflow-hidden p-8 sm:p-12 transition-all duration-300">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex rounded-full items-center justify-center mb-4">
            <img
              src="/lulu-avatar.png"
              alt="水豚噜噜"
              width={80}
              height={80}
              className="rounded-full shadow-inner object-cover"
            />
          </div>
          <h1 className="text-3xl font-extrabold text-orange-900 tracking-tight mb-2">
            水豚噜噜
          </h1>
          <p className="text-orange-600/80 font-medium">
            欢迎回来，准备好聊天了吗？
          </p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="text-sm font-semibold text-orange-800 ml-1"
            >
              邮箱地址
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="capybara@example.com"
              className="w-full px-4 py-3 bg-orange-50 border border-orange-200 text-orange-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all placeholder:text-orange-300"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-orange-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                正在发送...
              </>
            ) : (
              "获取神奇登录链接 ✨"
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-8 flex items-center text-orange-400 text-sm font-medium">
        Powered by AI Agent & Capybara Love
        <img className="w-5 h-5 ml-1" src="/icon.png" alt="icon" />
      </p>
    </div>
  );
}
