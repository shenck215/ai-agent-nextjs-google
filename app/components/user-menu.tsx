"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store/user-store";

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const { profile, callsStatus, fetchUserData, refreshCallsStatus, clearUser } =
    useUserStore();

  // 监听 Supabase Auth 状态变化：登录时拉取数据，登出时清空
  useEffect(() => {
    fetchUserData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        fetchUserData();
      } else if (event === "SIGNED_OUT") {
        clearUser();
        setIsOpen(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 点击外部收起气泡
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /** 渲染每日次数角标（仅登录且非无限次时展示） */
  const renderCallsBadge = () => {
    if (!profile || !callsStatus || callsStatus.unlimited) return null;
    const isLow = callsStatus.remaining <= 1;
    return (
      <div
        className={`absolute -bottom-1 -right-1 text-[9px] font-bold rounded-full leading-4 min-w-[18px] text-center shadow-sm ${
          isLow
            ? "bg-red-500 text-white"
            : "bg-orange-100 text-orange-600 border border-orange-300"
        }`}
      >
        {callsStatus.remaining}
      </div>
    );
  };

  return (
    <div className="fixed top-4 right-4 z-50" ref={menuRef}>
      {/* 头像按钮 */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) refreshCallsStatus();
        }}
        className="relative w-11 h-11 flex items-center justify-center rounded-full overflow-visible border-2 border-orange-500 shadow-md transition-transform hover:scale-105 cursor-pointer bg-orange-50"
      >
        <div className="w-10 h-10 rounded-full overflow-hidden">
          <Image
            src={profile?.avatar_url || "/lulu-avatar.png"}
            alt={profile?.nickname || "噜噜头像"}
            width={40}
            height={40}
            className="w-10 h-10 object-cover"
            unoptimized
          />
        </div>
        {renderCallsBadge()}
      </button>

      {/* 气泡菜单 */}
      {isOpen && profile && (
        <div className="absolute top-12 right-0 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2">
          {/* 用户信息区 */}
          <div className="px-4 py-2 border-b border-orange-100 mb-1">
            <p className="text-sm font-extrabold text-orange-600">
              {profile.nickname || "噜噜"}
            </p>

            {/* 今日剩余次数 */}
            {callsStatus && (
              <div className="mt-1.5">
                {callsStatus.unlimited ? (
                  <span className="text-xs text-gray-400">∞ 无限次调用</span>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            callsStatus.remaining <= 1
                              ? "bg-red-400"
                              : callsStatus.remaining <=
                                  Math.ceil(callsStatus.limit / 2)
                                ? "bg-orange-400"
                                : "bg-green-400"
                          }`}
                          style={{
                            width: `${Math.max(0, (callsStatus.remaining / callsStatus.limit) * 100)}%`,
                          }}
                        />
                      </div>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          callsStatus.remaining <= 1
                            ? "text-red-500"
                            : "text-gray-500"
                        }`}
                      >
                        {callsStatus.remaining}/{callsStatus.limit}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      今日剩余次数
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="py-1">
            <Link
              href="/profile"
              className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              onClick={() => setIsOpen(false)}
            >
              <span>👤</span> 个人信息
            </Link>

            {pathname === "/" && (
              <Link
                href="/knowledge"
                className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                onClick={() => setIsOpen(false)}
              >
                <span>📚</span> 前往知识库
              </Link>
            )}
          </div>

          <div className="py-1 border-t border-gray-100 mt-1">
            <button
              className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2 cursor-pointer"
              onClick={async () => {
                setIsOpen(false);
                await supabase.auth.signOut();
                router.push("/login");
              }}
            >
              <span>🚪</span> 退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
