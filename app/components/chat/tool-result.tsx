"use client";

import MarkdownRenderer from "@/app/components/markdown-renderer";
import { PriceCard } from "@/app/components/tools/price-card";

interface ToolResultProps {
  part: any;
  index: number;
  onViewImage: (url: string) => void;
}

/** 工具调用结果渲染（含 Skeleton、各工具 UI、fallback JSON） */
export function ToolResult({ part: toolPart, index, onViewImage }: ToolResultProps) {
  const toolName = toolPart.type.replace("tool-", "");

  // 状态 A：正在调用工具（Skeleton）
  if (toolPart.state === "call" || !toolPart.output) {
    return (
      <div
        key={index}
        className="animate-pulse flex space-x-4 my-4 p-4 border rounded-xl bg-gray-50"
      >
        <div className="flex-1 space-y-4 py-1">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // 状态 B：执行结果已返回
  switch (toolName) {
    case "searchKnowledgeBase": {
      const result = toolPart.output;
      return (
        <div
          key={index}
          className="my-2 p-3 bg-violet-50/50 border border-violet-100 rounded-xl shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-violet-600 font-bold text-xs">
              <span>🔍 知识库检索完成</span>
              {result.foundInfo && (
                <span className="bg-violet-100 px-1.5 py-0.5 rounded text-[10px]">
                  命中 {result.sources?.length} 条
                </span>
              )}
            </div>
          </div>

          {result.foundInfo && result.sources && (
            <div className="flex flex-wrap gap-2 mb-3">
              {result.sources.map((src: any, si: number) => (
                <div
                  key={si}
                  className="px-2 py-1 bg-white border border-violet-200 rounded text-[10px] text-gray-500 flex items-center gap-1"
                >
                  📄 {src.source}{" "}
                  <span className="text-gray-300 font-normal">| {src.similarity}%</span>
                </div>
              ))}
            </div>
          )}

          {result.foundInfo ? (
            <details className="text-xs group">
              <summary className="cursor-pointer text-violet-500 hover:text-violet-700 select-none flex items-center gap-1 transition-colors">
                <span className="group-open:rotate-90 transition-transform">▶</span>
                查看检索到的原文内容
              </summary>
              <div className="mt-2 p-2 bg-white/80 rounded-lg border border-violet-100 text-gray-600 leading-relaxed max-h-60 overflow-y-auto [scrollbar-width:thin]">
                <MarkdownRenderer content={result.content} />
              </div>
            </details>
          ) : (
            <div className="text-xs text-gray-400 italic">
              未能从知识库中找到相关匹配信息
            </div>
          )}
        </div>
      );
    }

    case "getHousingPrice":
      return (
        <PriceCard
          key={index}
          data={toolPart.output}
          location={toolPart.input.location}
        />
      );

    case "updateTheme":
      return (
        <div key={index} className="text-xs text-gray-400 italic">
          🎨 已切换主题
        </div>
      );

    default:
      return (
        <pre key={index} className="text-xs bg-gray-100 p-2 rounded">
          {JSON.stringify(toolPart.output, null, 2)}
        </pre>
      );
  }
}
