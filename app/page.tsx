/**
 * AI Agent 聊天界面组件
 */
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, FileUIPart, UIMessage } from "ai";
import { useState, useCallback, useEffect, useRef } from "react";

export type ChatSession = {
	id: string;
	title: string;
	updatedAt: number;
	messages: UIMessage[];
	model?: "fast" | "thinking" | "image";
};

function generateId() {
	return Math.random().toString(36).substring(2, 10);
}
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

const downloadBase64 = (base64String: string, customName = "ai_image") => {
	// 提取后缀
	const mimeType = base64String.match(/:(.*?);/)?.[1];
	const extension = mimeType?.split("/")[1];
	const fullFileName = `${customName}_${Math.random().toString(36).substring(2, 7)}.${extension}`;

	// Base64 转 Blob
	fetch(base64String)
		.then((res) => res.blob())
		.then((blob) => {
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = fullFileName; // 核心：在这里定义文件名
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
		});
};

/** 图片灯箱：全屏预览 + 下载 */
function ImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
				onClick={(e) => e.stopPropagation()}
			>
				<img
					src={src}
					alt="预览图片"
					className="max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain"
				/>
				<div className="flex gap-3">
					<button
						onClick={() => downloadBase64(src)}
						className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors cursor-pointer"
					>
						↓ 下载图片
					</button>
					<button
						onClick={onClose}
						className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors cursor-pointer"
					>
						✕ 关闭
					</button>
				</div>
			</div>
		</div>
	);
}

function readFileAsDataURL(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

/** 将 File[] 转换为 FileUIPart[] */
async function filesToFileUIParts(files: File[]): Promise<FileUIPart[]> {
	return Promise.all(
		files.map(async (f) => ({
			type: "file" as const,
			mediaType: f.type || "image/png",
			filename: f.name,
			url: await readFileAsDataURL(f),
		})),
	);
}

function ChatWindow({
	session,
	onSaveSession,
}: {
	session: ChatSession;
	onSaveSession: (session: ChatSession) => void;
}) {
	// 自动滚动 Refs (Move to top to fix React Compiler issue)
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const isUserScrolled = useRef(false);
	const [bgColor, setBgColor] = useState<string>("#ffffff");
	const [model, setModel] = useState<"fast" | "thinking" | "image">(
		session.model || "fast",
	);
	// 灯笸预览图片 URL
	const [viewingImage, setViewingImage] = useState<string | null>(null);
	const {
		messages,
		sendMessage,
		status,
		stop,
		setMessages,
		error,
		clearError,
	} = useChat({
		id: session.id,
		transport: new DefaultChatTransport({
			api: "/api/chat",
		}),
	});

	const isInitialized = useRef(false);

	useEffect(() => {
		if (session.messages?.length > 0) {
			setMessages(session.messages);
		}
		isInitialized.current = true;
	}, [session.id]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!isInitialized.current) return;

		if (
			messages.length > 0 ||
			session.messages.length === 0 ||
			session.model !== model
		) {
			onSaveSession({
				...session,
				messages,
				model,
			});
		}

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [messages, model]);

	const [input, setInput] = useState("");
	// 待发送的图片文件列表
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	// 图片预览 URL（objectURL，用于 <img> 标签显示）
	const [previewUrls, setPreviewUrls] = useState<string[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);
	// 输入区容器，用于拖拽检测
	const inputAreaRef = useRef<HTMLDivElement>(null);
	// 拖拽高亮状态
	const [isDragging, setIsDragging] = useState(false);

	/** 追加文件到待发送列表 */
	const addFiles = useCallback((files: File[]) => {
		const images = files.filter((f) => f.type.startsWith("image/"));
		if (!images.length) return;
		setSelectedFiles((prev) => [...prev, ...images]);
		setPreviewUrls((prev) => [
			...prev,
			...images.map((f) => URL.createObjectURL(f)),
		]);
	}, []);

	/** 移除某张图片 */
	const removeFile = useCallback((index: number) => {
		setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
		setPreviewUrls((prev) => {
			URL.revokeObjectURL(prev[index]);
			return prev.filter((_, i) => i !== index);
		});
	}, []);

	/** 清空所有图片 */
	const clearFiles = useCallback(() => {
		setPreviewUrls((prev) => {
			prev.forEach(URL.revokeObjectURL);
			return [];
		});
		setSelectedFiles([]);
	}, []);

	// Toast 错误提示
	const [toastMsg, setToastMsg] = useState<string | null>(null);

	// 内联编辑状态
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingText, setEditingText] = useState("");

	/** 确认编辑：截断该消息之前的历史，重新发送（编辑时不带图片） */
	const handleEditSubmit = useCallback(
		(msgIndex: number) => {
			const text = editingText.trim();
			if (!text) return;
			setMessages(messages.slice(0, msgIndex));
			setEditingId(null);
			setEditingText("");
			isUserScrolled.current = false; // 重发时同样重置向下滚动
			setTimeout(() => sendMessage({ text }, { body: { model } }), 0);
		},
		[editingText, messages, model, sendMessage, setMessages],
	);

	/** 粘贴事件：支持粘贴图片 */
	useEffect(() => {
		const handlePaste = (e: ClipboardEvent) => {
			const items = Array.from(e.clipboardData?.items ?? []);
			const imageFiles = items
				.filter((item) => item.type.startsWith("image/"))
				.map((item) => item.getAsFile())
				.filter(Boolean) as File[];
			if (imageFiles.length) {
				e.preventDefault(); // 阻止浏览器把文件名插入输入框
				addFiles(imageFiles);
			}
		};
		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [addFiles]);

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
		setToastMsg(msg);
		clearError(); // 恢复为 ready 状态，可再次提问
		const t = setTimeout(() => setToastMsg(null), 5000);
		return () => clearTimeout(t);
	}, [error]); // eslint-disable-line react-hooks/exhaustive-deps

	// reasoning 计时：key = `${msgId}-${partIndex}`, value = { startMs, doneMs? }
	const [reasoningTimers, setReasoningTimers] = useState<
		Map<string, { startMs: number; doneMs?: number }>
	>(() => new Map());

	console.log(messages);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;
		let lastScrollTop = container.scrollTop;
		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = container;
			const distanceToBottom = scrollHeight - scrollTop - clientHeight;

			if (distanceToBottom <= 50) {
				// 触底时恢复自动滚动
				isUserScrolled.current = false;
			} else if (lastScrollTop - scrollTop > 5) {
				// 只有当用户确实向上回滚 (>5px) 时才暂停自动滚动，避免大段文本导致 scrollHeight 突变时误判
				isUserScrolled.current = true;
			}
			lastScrollTop = scrollTop;
		};
		container.addEventListener("scroll", handleScroll, { passive: true });
		return () => container.removeEventListener("scroll", handleScroll);
	}, []);

	useEffect(() => {
		if (!isUserScrolled.current) {
			bottomRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages, status]); // 加上 status，确保发消息变成 submitted 时立刻滚动到底部的转圈占位符

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
			className="transition-colors duration-700 h-full flex flex-col relative"
			style={{ backgroundColor: bgColor }}
		>
			{/* 图片灯笸 */}
			{viewingImage && (
				<ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />
			)}
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
				className="flex flex-col w-full max-w-3xl pt-16 pb-6 mx-auto flex-1 overflow-y-auto [scrollbar-width:none]"
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
									<div className="flex flex-col gap-2">
										{/* 图片 parts */}
										{m.parts.filter((p) => p.type === "file").length > 0 && (
											<div className="flex flex-wrap gap-2 mb-1">
												{m.parts
													.filter((p) => p.type === "file")
													.map((p, fi) => (
														<img
															key={fi}
															src={(p as any).url}
															alt={(p as any).filename ?? `image-${fi}`}
															className="max-h-48 max-w-xs rounded-lg border border-gray-200 object-contain"
														/>
													))}
											</div>
										)}
										{/* 文字 + 编辑按钮 */}
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
									} else if (part.type === "file") {
										// AI 生成的图片（图片生成模式返回的 file part）
										const imgUrl = (part as any).url as string;
										return (
											<div
												key={index}
												className="my-2 group relative inline-block"
											>
												<img
													src={imgUrl}
													alt="AI 生成的图片"
													className="max-w-full max-h-96 rounded-xl border border-gray-200 shadow-sm cursor-zoom-in block"
													onClick={() => setViewingImage(imgUrl)}
												/>
												{/* 悬浮操作按钮 */}
												<div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
													<button
														onClick={() => setViewingImage(imgUrl)}
														className="px-2 py-1 rounded bg-black/60 text-white text-xs cursor-pointer hover:bg-black/80 transition-colors"
													>
														⛶ 放大
													</button>
													<button
														onClick={() => downloadBase64(imgUrl)}
														className="px-2 py-1 rounded bg-black/60 text-white text-xs cursor-pointer hover:bg-black/80 transition-colors"
													>
														↓ 下载
													</button>
												</div>
											</div>
										);
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
			</div>

			{/* 输入表单区域 */}
			<div
				ref={inputAreaRef}
				className={`w-full max-w-3xl mx-auto py-4 flex flex-col gap-2 border-t border-gray-200 transition-all ${
					isDragging ? "opacity-80" : ""
				}`}
				onDragOver={(e) => {
					e.preventDefault();
					setIsDragging(true);
				}}
				onDragLeave={() => setIsDragging(false)}
				onDrop={(e) => {
					e.preventDefault();
					setIsDragging(false);
					addFiles(Array.from(e.dataTransfer.files));
				}}
			>
				{/* 图片预览条 */}
				{previewUrls.length > 0 && (
					<div className="flex gap-2 flex-wrap bg-white rounded-xl shadow-xl border border-gray-200 p-2">
						{previewUrls.map((url, i) => (
							<div key={i} className="relative group">
								<img
									src={url}
									alt={selectedFiles[i]?.name ?? `image-${i}`}
									className="h-16 w-16 object-cover rounded-lg border border-gray-200"
								/>
								<button
									type="button"
									onClick={() => removeFile(i)}
									className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer leading-none"
								>
									✕
								</button>
							</div>
						))}
						{isDragging && (
							<div className="h-16 w-16 rounded-lg border-2 border-dashed border-blue-400 flex items-center justify-center text-blue-400 text-xl">
								+
							</div>
						)}
					</div>
				)}
				{/* 拖拽放置提示（无预览图时） */}
				{isDragging && previewUrls.length === 0 && (
					<div className="flex items-center justify-center h-16 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50 text-blue-500 text-sm">
						📷 松开鼠标上传图片
					</div>
				)}
				{/* 隐藏的文件选择器 */}
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					multiple
					className="hidden"
					onChange={(e) => {
						addFiles(Array.from(e.target.files ?? []));
						e.target.value = "";
					}}
				/>
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						const hasText = !!input.trim();
						const hasFiles = selectedFiles.length > 0;
						if ((!hasText && !hasFiles) || status !== "ready") return;
						const filesParts = hasFiles
							? await filesToFileUIParts(selectedFiles)
							: [];
						// 发送前重置滚动状态，确保发送后自动滚到底部
						isUserScrolled.current = false;
						if (hasText && hasFiles) {
							sendMessage(
								{ text: input, files: filesParts },
								{ body: { model } },
							);
						} else if (hasText) {
							sendMessage({ text: input }, { body: { model } });
						} else {
							sendMessage({ files: filesParts }, { body: { model } });
						}
						setInput("");
						clearFiles();
					}}
					className="flex gap-2"
				>
					{/* 上传图片按钮 */}
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						disabled={status !== "ready"}
						className="px-3 py-2 rounded border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors cursor-pointer shadow-xl text-base disabled:opacity-40 disabled:cursor-not-allowed"
						title="上传图片（也支持粘贴 / 拖拽）"
					>
						📎
					</button>
					<input
						className="flex-1 p-2 border border-gray-300 rounded shadow-xl bg-white"
						value={input}
						placeholder={
							status !== "ready"
								? "AI 正在回答中，请等待或点击停止…"
								: "和 Agent 聊聊... （支持粘贴或拖拽图片）"
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
							{/* 模型切换下拉 */}
							<select
								value={model}
								onChange={(e) =>
									setModel(e.target.value as "fast" | "thinking" | "image")
								}
								className="rounded shadow-xl border border-gray-300 bg-white text-gray-600 cursor-pointer transition-colors hover:bg-gray-50 focus:outline-none"
							>
								<option value="fast">⚡ 快速</option>
								<option value="thinking">💭 思考</option>
								<option value="image">🖼️ 生图</option>
							</select>
							<button
								type="submit"
								disabled={!input.trim() && selectedFiles.length === 0}
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

export default function App() {
	const [sessions, setSessions] = useState<ChatSession[]>(() => {
		if (typeof window === "undefined") return [];
		const saved = localStorage.getItem("chat_sessions");
		if (saved) {
			try {
				return JSON.parse(saved);
			} catch {
				return [];
			}
		}
		return [];
	});

	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => setIsLoaded(true), 0);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		if (isLoaded) {
			localStorage.setItem("chat_sessions", JSON.stringify(sessions));
		}
	}, [sessions, isLoaded]);

	const handleNewChat = () => {
		const newSession: ChatSession = {
			id: generateId(),
			title: "新对话",
			updatedAt: Date.now(),
			messages: [],
			model: "fast",
		};
		setSessions((prev) => [newSession, ...prev]);
		setActiveSessionId(newSession.id);
	};

	const handleDeleteChat = (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setSessions((prev) => {
			const next = prev.filter((s) => s.id !== id);
			if (activeSessionId === id) {
				setActiveSessionId(next.length > 0 ? next[0].id : null);
			}
			return next;
		});
	};

	if (!isLoaded)
		return (
			<div className="h-screen w-full bg-gray-50 flex items-center justify-center">
				Loading...
			</div>
		);

	const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

	return (
		<div className="flex h-screen w-full bg-white overflow-hidden">
			{/* 侧边栏 */}
			<div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full shrink-0">
				<div className="p-4 border-b border-gray-200">
					<button
						onClick={handleNewChat}
						className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer text-sm font-medium shadow-sm"
					>
						+ 新对话
					</button>
				</div>
				<div className="flex-1 overflow-y-auto">
					{sessions.length === 0 ? (
						<div className="p-4 text-center text-gray-400 text-sm">
							暂无历史对话
						</div>
					) : (
						[...sessions]
							.sort((a, b) => b.updatedAt - a.updatedAt)
							.map((s) => (
								<div
									key={s.id}
									onClick={() => setActiveSessionId(s.id)}
									className={`p-3 cursor-pointer border-b border-gray-100 flex justify-between items-center group transition-colors ${
										activeSessionId === s.id
											? "bg-blue-50/50 block border-l-4 border-l-blue-500"
											: "hover:bg-gray-100/50 border-l-4 border-transparent"
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
										onClick={(e) => handleDeleteChat(s.id, e)}
										className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1 cursor-pointer transition-opacity"
										title="删除对话"
									>
										✕
									</button>
								</div>
							))
					)}
				</div>
			</div>
			{/* 主内容区 */}
			<div className="flex-1 relative h-full flex flex-col bg-white">
				{activeSession ? (
					<>
						<div className="h-14 flex justify-center items-center px-6 shrink-0 bg-white/90 backdrop-blur z-10 absolute top-0 w-full">
							<h2
								className="text-xl text-gray-800 truncate"
								title={activeSession.title}
							>
								{activeSession.title}
							</h2>
						</div>
						<ChatWindow
							key={activeSession.id}
							session={activeSession}
							onSaveSession={(updated) => {
								setSessions((prev) =>
									prev.map((s) => {
										if (s.id === updated.id) {
											// 提取第一条用户消息的文字作为标题
											let newTitle = s.title;
											if (updated.messages.length > 0 && s.title === "新对话") {
												const firstUserMsg = updated.messages.find(
													(m) => m.role === "user",
												);
												if (firstUserMsg) {
													const textParts = firstUserMsg.parts.filter(
														(p: any) => p.type === "text",
													);
													const text = textParts
														.map((p: any) => p.text)
														.join(" ")
														.trim();
													if (text) {
														newTitle =
															text.substring(0, 15) +
															(text.length > 15 ? "..." : "");
													} else {
														// 若只有图片
														newTitle = "图片对话";
													}
												}
											}

											let newUpdatedAt = Math.max(updated.updatedAt, s.updatedAt);
											if (updated.messages.length > s.messages.length) {
												newUpdatedAt = Date.now();
											}

											return { ...updated, title: newTitle, updatedAt: newUpdatedAt };
										}
										return s;
									}),
								);
							}}
						/>
					</>
				) : (
					<div className="h-full flex items-center justify-center flex-col gap-4 bg-gray-50">
						<div className="text-gray-400">没有选中的对话</div>
						<button
							onClick={handleNewChat}
							className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer shadow-sm text-sm"
						>
							新建对话
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
