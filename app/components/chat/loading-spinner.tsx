"use client";

/** 暖色旋转加载圆圈（AI 思考中动画） */
export function LoadingSpinner() {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full animate-spin"
      style={{
        background:
          "conic-gradient(from 0deg, #F97316, #FBBF24, #FDE68A, #FCA5A5, #F97316)",
        mask: "radial-gradient(farthest-side, transparent 55%, #000 56%)",
        WebkitMask:
          "radial-gradient(farthest-side, transparent 55%, #000 56%)",
      }}
    />
  );
}
