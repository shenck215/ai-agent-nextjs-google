"use client";

import { useState, useEffect, useRef } from "react";
import { getProfile, upsertProfile } from "@/lib/actions/profile";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { message } from "@/app/components/ui/message";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const filePath = `avatar_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from("chat-images")
        .getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);
      message.success("✨ 头像上传成功！");
    } catch (err: any) {
      console.error(err);
      message.error("头像上传失败：" + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    getProfile()
      .then((profile) => {
        if (profile) {
          setNickname(profile.nickname || "");
          setAvatarUrl(profile.avatar_url || "");
        }
      })
      .catch((err) => {
        console.error(err);
        message.error("读取个人档案失败，请刷新重试！");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertProfile(nickname, avatarUrl);
      message.success("✨ 个人信息保存成功！");
      router.push("/");
    } catch (err) {
      console.error(err);
      message.error("保存失败，请检查网络或联系管理员。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
        <span className="text-orange-500 text-xl font-medium animate-pulse">
          噜噜正在读取你的档案...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-4xl shadow-2xl overflow-hidden p-8 sm:p-12 transition-all duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex rounded-full items-center justify-center mb-4 bg-orange-100 p-4 shadow-inner">
            <span className="text-4xl mix-blend-multiply">👤</span>
          </div>
          <h1 className="text-3xl font-extrabold text-orange-900 tracking-tight mb-2">
            个人档案
          </h1>
          <p className="text-orange-600/80 font-medium text-sm">
            让噜噜更好地认识你吧！
          </p>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-orange-800 ml-1">
              你的昵称
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 bg-orange-50 border border-orange-200 text-orange-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all placeholder:text-orange-300"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              placeholder="怎么称呼你呢？"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-orange-800 ml-1">
              个人头像
            </label>
            <div className="flex items-center gap-4 mt-2 mb-2">
              <div
                className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center overflow-hidden shrink-0 border-2 border-orange-200 cursor-pointer hover:border-orange-400 transition-colors shadow-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl mix-blend-multiply">👤</span>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="px-4 py-2 bg-orange-50 text-orange-700 rounded-xl border border-orange-200 hover:bg-orange-100 text-sm font-bold transition-all disabled:opacity-50"
                >
                  {uploadingAvatar ? "上传中..." : "点击上传新图片"}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-orange-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
          >
            {saving ? (
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
                正在保存...
              </>
            ) : (
              "保存档案"
            )}
          </button>

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 text-orange-600 hover:text-orange-700 font-medium transition-colors"
            >
              返回首页
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
