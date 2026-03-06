'use client';

import { useState, useRef } from 'react';
import { ingestDocument, ingestPdf } from '@/lib/actions/rag';

export function IngestTest() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理纯文本投喂
  const handleTextIngest = async () => {
    setLoading(true);
    const res = await ingestDocument(text, { source: 'manual-input' });
    if (res.success) { alert("文字知识点已存入！"); setText(""); }
    setLoading(false);
  };

  // 处理 PDF 投喂
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    const res = await ingestPdf(formData);
    if (res.success) {
      alert(`解析成功！已将 PDF 拆分为 ${res.count} 个知识片段存入数据库。`);
    } else {
      alert("解析失败:！");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoading(false);
  };

  return (
    <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm max-w-xl mx-auto my-10">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        🧠 知识库管理中心
      </h2>

      {/* PDF 上传区 */}
      <div className="mb-6 p-4 border-2 border-dashed border-violet-200 rounded-xl bg-violet-50/30 flex flex-col items-center">
        <p className="text-sm text-violet-600 mb-3 font-medium">支持 PDF 政策文件批量录入</p>
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 cursor-pointer text-sm shadow-md"
        >
          {loading ? "正在解析并向量化..." : "📁 选择 PDF 文件"}
        </button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100"></span></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">或者手动录入</span></div>
      </div>

      {/* 文本录入区 */}
      <textarea
        className="w-full p-3 text-sm border border-gray-200 rounded-xl mb-3 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
        rows={4}
        placeholder="输入一段购房笔记或知识片段..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={handleTextIngest}
        disabled={loading || !text.trim()}
        className="w-full py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 cursor-pointer text-sm font-medium"
      >
        保存纯文本知识
      </button>
    </div>
  );
}