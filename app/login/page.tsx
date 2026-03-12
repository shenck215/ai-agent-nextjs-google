"use client";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { message } from "@/app/components/ui/message";

/**
 * 登录页 —— 8 位数字 OTP 双步驱动
 *
 * 流程：
 *   Step 1: 用户填写邮箱 → 调用 signInWithOtp({ shouldCreateUser: true }) 发送验证码
 *   Step 2: 用户填写 OTP → 调用 verifyOtp 完成鉴权，成功后导航至首页
 *
 * 相较于 Magic Link，OTP 验证码不会被邮件客户端的防钓鱼机器人"预消费"，
 * 彻底消除一次性 Token 在用户点击前就已失效的问题。
 */
export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  /** 当前所处步骤，step1 = 填邮箱阶段，step2 = 填验证码阶段 */
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  /** Step 1：请求发送 OTP 验证码到用户邮箱 */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // 禁止自动跳转，完全由前端 verifyOtp 接管流程
        shouldCreateUser: true,
      },
    });

    if (error) {
      message.error("发送失败：" + error.message);
    } else {
      message.success("验证码已发送到您的邮箱，请查收！");
      setStep("otp");
    }
    setLoading(false);
  };

  /** Step 2：用用户填入的 8 位数字验证码完成登录核验 */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: "email",
    });

    if (error) {
      message.error("验证失败：" + error.message);
      setLoading(false); // 失败才重置，让用户重试
    } else {
      // 若 created_at 与 last_sign_in_at 相差不到 10 秒，视为首次注册
      const user = data?.user;
      const isNewUser =
        user?.created_at &&
        user?.last_sign_in_at &&
        Math.abs(
          new Date(user.last_sign_in_at).getTime() -
            new Date(user.created_at).getTime(),
        ) < 10_000;

      message.success(
        isNewUser ? "🎉 注册成功，欢迎加入！" : "🎉 登录成功，欢迎回来！",
      );
      router.push("/");
      router.refresh();
      // 成功后不重置 loading，保持按钮禁用直到页面跳走
    }
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
            {step === "email"
              ? "输入邮箱，验证码一键登录"
              : `验证码已发往 ${email}`}
          </p>
        </div>

        {/* ── Step 1: 邮箱输入 ── */}
        {step === "email" && (
          <form onSubmit={handleSendOtp} className="flex flex-col gap-5">
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="text-sm font-semibold text-orange-800 ml-1"
              >
                邮箱地址
              </label>
              <input
                id="email"
                type="email"
                placeholder="capybara@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                "获取验证码 ✉️"
              )}
            </button>
          </form>
        )}

        {/* ── Step 2: OTP 验证码输入 ── */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5">
            <div className="space-y-1">
              <label
                htmlFor="otp"
                className="text-sm font-semibold text-orange-800 ml-1"
              >
                8 位验证码
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="· · · · · · · ·"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full px-4 py-3 bg-orange-50 border border-orange-200 text-orange-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all placeholder:text-orange-300 text-center text-2xl tracking-[0.5em] font-bold"
                required
              />
              <p className="text-xs text-orange-400 ml-1 mt-1">
                请查收发送到 {email} 的邮件，将 8 位数字填入上方
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 8}
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
                  正在验证...
                </>
              ) : (
                "验证并登录 🎉"
              )}
            </button>

            {/* 重新发送入口 */}
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtp("");
              }}
              className="text-sm text-orange-400 hover:text-orange-600 transition-colors text-center mt-1"
            >
              没收到？返回重新发送
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <p className="mt-8 flex items-center text-orange-400 text-sm font-medium">
        Powered by AI Agent &amp; Capybara Love
        <img className="w-5 h-5 ml-1" src="/icon.png" alt="icon" />
      </p>
    </div>
  );
}
