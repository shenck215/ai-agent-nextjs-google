"use server";

import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";

// 初始化 Supabase 客户端
const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * 核心逻辑：将纯文本切片转化为高维向量并存入 Supabase 的 Knowledge Base 中
 *
 * 通过调用 Google SDK 的 gemini-embedding-001 提取文本的 3072 维浮点数组，
 * 并携带原始元数据 (Metadata，如时间、来源) 形成最终的知识向量点阵。
 *
 * @param {string} content - 需要被大语言模型检索记忆的原材料字符串
 * @param {any} metadata - 可附加的任何元数据对象，结构如 { source: "xxx", author: "xxx" }
 * @returns {Promise<{success: boolean, error?: string}>} 针对数据库的插入操作反馈结果
 */
export async function ingestText(content: string, metadata: any = {}) {
	try {
		// 1. 生成向量 (Embedding)
		// 使用 Google 的 gemini-embedding-001 模型，它生成的是 3072 维向量
		const { embedding } = await embed({
			model: google.embedding("gemini-embedding-001"),
			value: content,
		});

		// 2. 将原始文字 + 向量 存入 Supabase
		const { error } = await supabase.from("documents").insert({
			content: content,
			metadata: metadata,
			embedding: embedding, // 这里的数组长度必须是 3072
		});

		if (error) throw error;

		return { success: true };
	} catch (err) {
		console.error("Ingestion Error:", err);
		return { success: false, error: String(err) };
	}
}

/**
 * 🚀 智能递归分片：在提取知识块时优先保留人类语言段落的完整性
 * 
 * 若强行基于字符串长度裁剪，极易导致语义截断，破坏基于连续上下文的向量相似度。
 * 故系统依次以双换行(段)、单换行(短句)、句号以及空格尝试拆分，在边界逼近 threshold 时切分。
 * 
 * @param {string} text - 需要被拆解的长篇巨著源文本
 * @param {number} chunkSize - 切片的预估字符长度上限约束，默认 800 字
 * @returns {string[]} 一组清洗过、被切分开保留完整语境语义的字符切片数组
 */
function recursiveSplit(text: string, chunkSize = 800): string[] {
	// 分隔符优先级：双换行(段落) > 单换行 > 句号 > 空格
	const separators = ["\n\n", "\n", "。", "！", "？", " ", ""];

	function split(content: string): string[] {
		if (content.length <= chunkSize) return [content];

		const sep = separators.find((s) => content.includes(s)) || "";
		const parts = content.split(sep);
		const result: string[] = [];
		let current = "";

		for (const part of parts) {
			if ((current + sep + part).length <= chunkSize) {
				current += (current ? sep : "") + part;
			} else {
				if (current) result.push(current);
				current = part;
			}
		}
		if (current) result.push(current);
		return result;
	}
	return split(text);
}

/**
 * 📁 PDF 投喂：集成递归分片
 */
export async function ingestPdf(formData: FormData) {
	const file = formData.get("file") as File;
	const pdfParse = (await import("pdf-parse")).default;
	const data = await pdfParse(Buffer.from(await file.arrayBuffer()));

	// 使用智能分片
	const chunks = recursiveSplit(data.text, 800);

	for (const chunk of chunks) {
		if (chunk.trim().length < 10) continue;
		await ingestText(chunk, { source: file.name, type: "pdf" });
	}
	return { success: true, count: chunks.length };
}

/**
 * 🛠️ 结构化检索（Retrieval）：携带原文及其相似度比分的向量寻路算法
 *
 * 将用户提问临时 Embed 化之后，扔进 Supabase DB 去执行内建距离匹配函数 (match_documents)。
 * 若有吻合的历史录入条目，它提取该文本，用于后续系统对 Gemini 发起的拼接构造，达成生成式的 RAG。
 *
 * @param {string} query - 经由主模型润色抽取出的独立搜索短语或关键字
 * @returns {Promise<{text: string, sources: any[]}>} 拼接后可以直接塞入 Prompt 的格式化引文文本块
 */
export async function retrieveContext(query: string) {
	const { embedding } = await embed({
		model: google.embedding("gemini-embedding-001"),
		value: query,
	});

	const { data: documents } = await supabase.rpc("match_documents", {
		query_embedding: embedding,
		match_threshold: 0.45,
		match_count: 3,
	});

	if (!documents) return { text: "", sources: [] };

	return {
		text: documents
			.map((doc: any) => `[事实片段]: ${doc.content}`)
			.join("\n\n"),
		sources: documents.map((doc: any) => ({
			content: doc.content,
			source: doc.metadata?.source || "未知来源",
			similarity: (doc.similarity * 100).toFixed(1),
		})),
	};
}
