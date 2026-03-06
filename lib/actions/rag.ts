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
 * 核心逻辑：将文本存入知识库
 */
export async function ingestDocument(content: string, metadata: any = {}) {
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
 * 🚀 智能递归分片：优先保留段落完整性
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
		await ingestDocument(chunk, { source: file.name, type: "pdf" });
	}
	return { success: true, count: chunks.length };
}

/**
 * 🛠️ 结构化检索：带来源与相似度
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
