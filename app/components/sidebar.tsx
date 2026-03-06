"use client";

import { ChatSession } from "@/lib/utils/chat";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
}

/** 侧边栏：新建对话按钮 + 会话列表 */
export function Sidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}: SidebarProps) {
  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onNewChat}
          className="w-full py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors cursor-pointer text-sm font-medium shadow-sm"
        >
          + 新对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-4 text-center text-orange-300 text-sm mt-4">
            还没有历史对话，和噜噜聊聊吧！
          </div>
        ) : (
          [...sessions]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((s) => (
              <div
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={`p-3 cursor-pointer flex justify-between items-center group transition-colors ${
                  activeSessionId === s.id
                    ? "border-l-4 border-l-orange-500 bg-orange-50"
                    : ""
                }`}
              >
                <div className="flex-1 overflow-hidden pl-1">
                  <div className="text-sm font-medium text-gray-700 truncate">
                    {s.title}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(s.updatedAt).toLocaleString(undefined, {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <button
                  onClick={(e) => onDeleteSession(s.id, e)}
                  className="text-gray-400 hover:text-orange-500 opacity-0 group-hover:opacity-100 p-1 cursor-pointer transition-opacity"
                  title="删除对话"
                >
                  ✕
                </button>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
