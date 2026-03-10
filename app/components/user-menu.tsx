"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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

  return (
    <div className="fixed top-4 right-4 z-50" ref={menuRef}>
      {/* 头像按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 flex items-center justify-center rounded-full overflow-hidden border-2 border-orange-500 shadow-md transition-transform hover:scale-105 cursor-pointer bg-orange-50"
      >
        <img
          src="/lulu-avatar.png"
          alt="噜噜头像"
          className="w-10 h-10 object-cover"
        />
      </button>

      {/* 气泡菜单 */}
      {isOpen && (
        <div className="absolute top-12 right-0 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-2 border-b border-orange-500 mb-1">
            <p className="text-sm font-extrabold text-orange-600">噜噜</p>
            <p className="text-xs text-orange-500">水豚 AI 助手</p>
          </div>

          <div className="py-1">
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer"
              onClick={() => {
                setIsOpen(false);
                // 暂不跳转
              }}
            >
              <span>👤</span> 个人信息
            </button>

            {pathname === "/" ? (
              <Link
                href="/knowledge"
                className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                onClick={() => setIsOpen(false)}
              >
                <span>📚</span> 前往知识库
              </Link>
            ) : (
              <Link
                href="/"
                className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                onClick={() => setIsOpen(false)}
              >
                <span>🤖</span> 返回对话
              </Link>
            )}
          </div>

          <div className="py-1 border-t border-gray-100 mt-1">
            <button
              className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-red-50 transition-colors flex items-center gap-2 cursor-pointer"
              onClick={() => {
                setIsOpen(false);
                // 暂不跳转
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
