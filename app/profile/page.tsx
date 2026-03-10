"use client";

import { useState, useEffect } from "react";
import { getProfile, upsertProfile } from "@/lib/actions/profile";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProfile()
      .then((profile) => {
        if (profile) {
          setNickname(profile.nickname || "");
          setAvatarUrl(profile.avatar_url || "");
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertProfile(nickname, avatarUrl);
      alert("保存成功！");
      router.push("/");
    } catch (err) {
      console.error(err);
      alert("保存失败，请检查网络或联系管理员。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">加载中...</div>;

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-6">完善个人信息</h1>
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-4 w-full max-w-sm border p-6 rounded-xl shadow-sm bg-white"
      >
        <div className="flex flex-col gap-1">
          <label>昵称</label>
          <input
            type="text"
            className="border p-2 rounded"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            placeholder="你是怎么称呼的？"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label>头像 URL (可选)</label>
          <input
            type="url"
            className="border p-2 rounded"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-orange-500 text-white p-2 rounded hover:bg-orange-600 disabled:opacity-50 mt-4"
        >
          {saving ? "保存中..." : "保存设置"}
        </button>
      </form>
    </div>
  );
}
