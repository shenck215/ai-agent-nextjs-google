// components/markdown-renderer.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import React, { useState, useCallback } from "react";

type CodeProps = React.ComponentPropsWithoutRef<"code"> & {
	node?: unknown;
};

/** 复制文本到剪贴板（兼容 HTTP 环境） */
async function copyToClipboard(text: string) {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
	} else {
		const el = document.createElement("textarea");
		el.value = text;
		el.style.cssText = "position:fixed;top:-9999px;left:-9999px";
		document.body.appendChild(el);
		el.select();
		document.execCommand("copy");
		document.body.removeChild(el);
	}
}

/** 代码块复制按钮 */
function CopyCodeButton({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		await copyToClipboard(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [code]);

	return (
		<button
			onClick={handleCopy}
			className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors cursor-pointer"
		>
			{copied ? "✓ 已复制" : "复制"}
		</button>
	);
}

const MarkdownRenderer = React.memo(({ content }: { content: string }) => {
	return (
		<div className="prose prose-sm dark:prose-invert max-w-none">
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			components={{
				// 自定义代码块渲染
				// react-markdown v10 移除了 inline prop，改为通过 className 判断：
				// - 块级代码（```lang```）会有 language-xxx 的 className
				// - 行内代码（`code`）没有 language-xxx 的 className
				code({ className, children }: CodeProps) {
					const match = /language-(\w+)/.exec(className || "");
					const codeText = String(children).replace(/\n$/, "");
					return match ? (
						// 块级代码：用相对定位容器包裹，放置复制按钮
						<div className="relative group">
							<CopyCodeButton code={codeText} />
							<SyntaxHighlighter
								style={vscDarkPlus}
								language={match[1]}
								PreTag="div"
							>
								{codeText}
							</SyntaxHighlighter>
						</div>
					) : (
						// 行内代码：没有语言标识，普通渲染
						<code className={className}>{children}</code>
					);
				},
			}}
		>
			{content}
		</ReactMarkdown>
		</div>
	);
});

MarkdownRenderer.displayName = "MarkdownRenderer";
export default MarkdownRenderer;
