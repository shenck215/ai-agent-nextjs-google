/**
 * User Store (Zustand)
 *
 * 统一管理用户 profile 和每日调用次数状态，替代之前的自定义事件方案。
 * 无需 Provider 包裹，任何客户端组件直接 import useUserStore 即可使用。
 */
import { create } from "zustand";
import { getProfile, getDailyCallsStatus } from "@/lib/actions/profile";

interface Profile {
  nickname?: string;
  avatar_url?: string;
}

interface CallsStatus {
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
}

interface UserStore {
  /** 当前用户 profile，null 表示未登录或尚未加载 */
  profile: Profile | null;
  /** 今日调用次数状态，null 表示尚未加载 */
  callsStatus: CallsStatus | null;

  /** 拉取 profile + 次数（登录后调用） */
  fetchUserData: () => Promise<void>;
  /** 仅刷新次数（AI 调用完成后触发） */
  refreshCallsStatus: () => Promise<void>;
  /** 清空所有状态（登出时调用） */
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  profile: null,
  callsStatus: null,

  fetchUserData: async () => {
    const p = await getProfile().catch(() => null);
    if (p) {
      set({ profile: { nickname: p.nickname, avatar_url: p.avatar_url } });
      const s = await getDailyCallsStatus().catch(() => null);
      if (s) set({ callsStatus: s });
    } else {
      set({ profile: null, callsStatus: null });
    }
  },

  refreshCallsStatus: async () => {
    const s = await getDailyCallsStatus().catch(() => null);
    if (s) set({ callsStatus: s });
  },

  clearUser: () => set({ profile: null, callsStatus: null }),
}));
