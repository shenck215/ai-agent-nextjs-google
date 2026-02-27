/**
 * AI Agent 聊天界面组件
 */
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useCallback, useEffect, useRef } from "react";
import MarkdownRenderer from "./components/markdown-renderer";
import { PriceCard } from "./components/tools/price-card";

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

/** AI 回复底部的「复制回答」按钮 */
function CopyAllButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		await copyToClipboard(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [text]);

	return (
		<button
			onClick={handleCopy}
			className="mt-2 px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
		>
			{copied ? "✓ 已复制" : "复制回答"}
		</button>
	);
}

export default function Chat() {
	const [bgColor, setBgColor] = useState<string>("#ffffff");
	const [model, setModel] = useState<"fast" | "thinking">("fast");
	const { messages, sendMessage, status, stop, setMessages, error, clearError } = useChat({
		transport: new DefaultChatTransport({
			api: "/api/chat",
		}),
	});

	const [input, setInput] = useState("");
	// Toast 错误提示
	const [toastMsg, setToastMsg] = useState<string | null>(null);

	// 内联编辑状态
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingText, setEditingText] = useState("");

	/** 确认编辑：截断该消息之前的历史，重新发送 */
	const handleEditSubmit = useCallback(
		(msgIndex: number) => {
			const text = editingText.trim();
			if (!text) return;
			setMessages(messages.slice(0, msgIndex));
			setEditingId(null);
			setEditingText("");
			setTimeout(() => sendMessage({ text }, { body: { model } }), 0);
		},
		[editingText, messages, model, sendMessage, setMessages],
	);

	// 监听错误，弹出 toast、清除 error 以恢复可提问
	useEffect(() => {
		if (!error) return;
		// 尝试从 JSON 转换后的消息里取可读错误
		let msg = error.message;
		try {
			const parsed = JSON.parse(msg);
			if (parsed?.error?.message) msg = parsed.error.message;
		} catch {
			// keep original
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setToastMsg(msg);
		clearError(); // 恢复为 ready 状态，可再次提问
		const t = setTimeout(() => setToastMsg(null), 5000);
		return () => clearTimeout(t);
	}, [error]); // eslint-disable-line react-hooks/exhaustive-deps

	// 自动滚动
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const isUserScrolled = useRef(false);

	// reasoning 计时：key = `${msgId}-${partIndex}`, value = { startMs, doneMs? }
	const [reasoningTimers, setReasoningTimers] = useState<
		Map<string, { startMs: number; doneMs?: number }>
	>(() => new Map());

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;
		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = container;
			isUserScrolled.current = scrollHeight - scrollTop - clientHeight > 50;
		};
		container.addEventListener("scroll", handleScroll, { passive: true });
		return () => container.removeEventListener("scroll", handleScroll);
	}, []);

	useEffect(() => {
		if (!isUserScrolled.current) {
			bottomRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages]);

	useEffect(() => {
		if (status === "ready") {
			isUserScrolled.current = false;
		}
	}, [status]);

	useEffect(() => {
		const lastMessage = messages[messages.length - 1];
		if (lastMessage && lastMessage.role === "assistant") {
			lastMessage.parts.forEach((part: any) => {
				const aiColor = part.output?.activeColor;
				if (
					part.type === "tool-updateTheme" &&
					aiColor !== bgColor &&
					CSS.supports("color", aiColor)
				) {
					setBgColor(aiColor);
				}
			});
		}
	}, [bgColor, messages]);

	// 更新 reasoning 计时
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setReasoningTimers((prev) => {
			const next = new Map(prev);
			let changed = false;
			messages.forEach((msg) => {
				msg.parts.forEach((part: any, idx: number) => {
					if (part.type !== "reasoning") return;
					const key = `${msg.id}-${idx}`;
					const entry = next.get(key);
					if (!entry) {
						next.set(key, { startMs: Date.now() });
						changed = true;
					} else if (part.state === "done" && !entry.doneMs) {
						next.set(key, { ...entry, doneMs: Date.now() });
						changed = true;
					}
				});
			});
			return changed ? next : prev;
		});
	}, [messages]);

	return (
		<div
			className="transition-colors duration-700 min-h-screen"
			style={{ backgroundColor: bgColor }}
		>
			{/* 错误 Toast */}
			{toastMsg && (
				<div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 animate-in slide-in-from-top-2">
					<span className="text-lg leading-none mt-0.5">⚠️</span>
					<p className="flex-1 text-sm leading-snug">{toastMsg}</p>
					<button
						onClick={() => setToastMsg(null)}
						className="text-red-400 hover:text-red-600 transition-colors cursor-pointer leading-none"
					>
						✕
					</button>
				</div>
			)}

			<div
				ref={scrollContainerRef}
				className="flex flex-col w-full max-w-3xl pt-16 pb-24 mx-auto stretch h-screen overflow-y-auto [scrollbar-width:none]"
			>
				{messages.map((m, msgIndex) => (
					<div key={m.id} className="whitespace-pre-wrap mb-4">
						{/* 标题行 */}
						<div className="font-bold mb-1 flex items-center gap-2">
							{m.role === "user" ? (
								"User:"
							) : (
								<>
									<span>AI:</span>
									{/* 最后一条消息且正在流式输出时，显示彩色旋转圆圈 */}
									{msgIndex === messages.length - 1 &&
										(status === "streaming" || status === "submitted") && (
											<span
												className="inline-block w-4 h-4 rounded-full animate-spin"
												style={{
													background:
														"conic-gradient(from 0deg, #6366f1, #8b5cf6, #ec4899, #f59e0b, #10b981, #6366f1)",
													mask: "radial-gradient(farthest-side, transparent 55%, #000 56%)",
													WebkitMask:
														"radial-gradient(farthest-side, transparent 55%, #000 56%)",
												}}
											/>
										)}
								</>
							)}
						</div>

						{/* 用户消息：支持内联编辑 */}
						{m.role === "user" && (
							<div className="ml-4 group relative">
								{editingId === m.id ? (
									// 编辑模式
									<div className="flex flex-col gap-2">
										<textarea
											autoFocus
											className="w-full p-2 border border-blue-400 rounded text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
											rows={3}
											value={editingText}
											onChange={(e) => setEditingText(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter" && !e.shiftKey) {
													e.preventDefault();
													handleEditSubmit(msgIndex);
												}
												if (e.key === "Escape") setEditingId(null);
											}}
										/>
										<div className="flex gap-2">
											<button
												onClick={() => handleEditSubmit(msgIndex)}
												className="px-3 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-pointer"
											>
												重新发送
											</button>
											<button
												onClick={() => setEditingId(null)}
												className="px-3 py-1 text-xs rounded border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
											>
												取消
											</button>
										</div>
									</div>
								) : (
									// 静态模式：hover 时在文字后显示编辑按钮
									<div className="flex items-start gap-2">
										<div>
											{m.parts
												.filter((p) => p.type === "text")
												.map((p) => (p as any).text as string)
												.join("\n")}
										</div>
										<button
											onClick={() => {
												const text = m.parts
													.filter((p) => p.type === "text")
													.map((p) => (p as any).text as string)
													.join("\n");
												setEditingId(m.id);
												setEditingText(text);
											}}
											className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer bg-white"
										>
											编辑
										</button>
									</div>
								)}
							</div>
						)}

						{/* AI 消息内容区域 */}
						{m.role === "assistant" && (
							<div className="ml-4">
								{m.parts.map((part, index) => {
									// 思考过程（reasoning）：可折叠展示
									if (part.type === "reasoning") {
										const timerKey = `${m.id}-${index}`;
										const timer = reasoningTimers.get(timerKey);
										const isDone = part.state === "done";
										// 耗时（秒）
										const elapsedSec = timer
											? (
													((timer.doneMs ?? Date.now()) - timer.startMs) /
													1000
												).toFixed(1)
											: null;
										// 思考中：取最后一段非空文字作为预览
										const previewText = !isDone
											? ((part.text as string)
													.split("\n")
													.filter((l: string) => l.trim())
													.at(-1) ?? "")
											: null;
										return (
											<details
												key={index}
												className="mb-3 border border-gray-200 rounded-lg overflow-hidden text-sm"
											>
												<summary className="flex flex-col px-3 py-2 bg-gray-50 cursor-pointer select-none hover:bg-gray-100 transition-colors">
													{/* 第一行：图标 + 标题 + 耗时 */}
													<div className="flex items-center gap-1.5 text-gray-400 text-xs">
														<span>💭</span>
														<span>{isDone ? "思考过程" : "思考中..."}</span>
														{elapsedSec && (
															<span className="ml-1 text-gray-300">
																· {elapsedSec}s
															</span>
														)}
														<span className="ml-auto text-gray-300">
															点击展开
														</span>
													</div>
													{/* 第二行：思考中时显示最后一段预览文字 */}
													{previewText && (
														<div className="mt-1 text-xs text-gray-400 truncate max-w-full">
															{previewText}
														</div>
													)}
												</summary>
												<div className="px-3 py-2 bg-white text-gray-500 text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-72 overflow-y-auto [scrollbar-width:thin]">
													{part.text}
												</div>
											</details>
										);
									}
									if (part.type === "text") {
										return <MarkdownRenderer key={index} content={part.text} />;
									} else if (part.type.startsWith("tool-")) {
										const toolPart = part as any;
										const toolName = toolPart.type.replace("tool-", "");

										// 2. 根据状态进行不同的 UI 渲染
										// 状态 A：AI 正在“打算”调用工具（显示 Skeleton 或加载中）
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
										// 3. 核心分发逻辑
										switch (toolName) {
											case "getHousingPrice":
												return (
													<PriceCard
														key={index}
														data={toolPart.output}
														location={toolPart.input.location}
													/>
												);

											case "updateTheme":
												// 这个工具不需要 UI 渲染（它修改全局 CSS），可以返回 null 或一个小提示
												return (
													<div
														key={index}
														className="text-xs text-gray-400 italic"
													>
														🎨 已切换主题
													</div>
												);

											default:
												// 未定义的工具降级显示 JSON
												return (
													<pre
														key={index}
														className="text-xs bg-gray-100 p-2 rounded"
													>
														{JSON.stringify(toolPart.output, null, 2)}
													</pre>
												);
										}
									}
									return null;
								})}
							</div>
						)}

						{/* AI 消息底部的「复制回答」按钮：回答完成后才显示 */}
						{m.role === "assistant" &&
							!(msgIndex === messages.length - 1 && status !== "ready") && (
								<CopyAllButton
									text={m.parts
										.filter((p) => p.type === "text")
										.map((p) => (p as any).text as string)
										.join("\n")}
								/>
							)}
					</div>
				))}

				{/* submitted 时 AI 消息还未到达，渲染占位标题行 */}
				{status === "submitted" && (
					<div className="whitespace-pre-wrap mb-4">
						<div className="font-bold mb-1 flex items-center gap-2">
							<span>AI:</span>
							<span
								className="inline-block w-4 h-4 rounded-full animate-spin"
								style={{
									background:
										"conic-gradient(from 0deg, #6366f1, #8b5cf6, #ec4899, #f59e0b, #10b981, #6366f1)",
									mask: "radial-gradient(farthest-side, transparent 55%, #000 56%)",
									WebkitMask:
										"radial-gradient(farthest-side, transparent 55%, #000 56%)",
								}}
							/>
						</div>
					</div>
				)}

				{/* 底部锚点 */}
				<div ref={bottomRef} />

				{/* 输入表单 */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (input.trim() && status === "ready") {
							sendMessage({ text: input }, { body: { model } });
							setInput("");
						}
					}}
					className="fixed bottom-0 w-full max-w-3xl mb-8 flex gap-2"
				>
					<input
						className="flex-1 p-2 border border-gray-300 rounded shadow-xl bg-white"
						value={input}
						placeholder={
							status !== "ready"
								? "AI 正在回答中，请等待或点击停止…"
								: "和 Agent 聊聊..."
						}
						onChange={(e) => setInput(e.target.value)}
						disabled={status !== "ready"}
					/>
					{status !== "ready" ? (
						<button
							type="button"
							onClick={stop}
							className="px-4 py-2 rounded bg-red-500 text-white text-sm hover:bg-red-600 transition-colors cursor-pointer shadow-xl whitespace-nowrap"
						>
							⏹ 停止
						</button>
					) : (
						<div className="flex gap-2">
							{/* 模型切换 */}
							<button
								type="button"
								onClick={() => setModel((m) => (m === "fast" ? "thinking" : "fast"))}
								className={`px-3 py-2 rounded text-xs font-medium shadow-xl whitespace-nowrap transition-colors cursor-pointer border ${
									model === "thinking"
										? "bg-violet-600 text-white border-violet-600 hover:bg-violet-700"
										: "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
								}`}
							>
								{model === "thinking" ? "💭 思考" : "⚡ 快速"}
							</button>
							<button
								type="submit"
								disabled={!input.trim()}
								className="px-4 py-2 rounded bg-blue-500 text-white text-sm hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xl whitespace-nowrap"
							>
								发送
							</button>
						</div>
					)}
				</form>
			</div>
		</div>
	);
}
