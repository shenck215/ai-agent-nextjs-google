"use server";

import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";
import pdfParse from "pdf-parse";

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
 * 核心逻辑：解析 PDF 并分片入库
 */
export async function ingestPdf(formData: FormData) {
	try {
		const file = formData.get("file") as File;
		if (!file) throw new Error("未找到文件");

		// 1. 读取文件 Buffer
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// 2. 解析 PDF 文字
		const data = await pdfParse(buffer);
		const fullText = data.text;

		// 3. 文本分片 (Simple Chunking)
		// 作为 Lead，我们按 1000 字左右切分，保证向量检索的精准度
		const chunks = fullText.match(/[\s\S]{1,1000}/g) || [];

		console.log(`PDF 解析完成，准备投喂 ${chunks.length} 个片段...`);

		// 4. 循环投喂每一个片段
		for (const chunk of chunks) {
			await ingestDocument(chunk, {
				source: file.name,
				type: "pdf",
				timestamp: Date.now(),
			});
		}

		return { success: true, count: chunks.length };
	} catch (err) {
		console.error("PDF Ingestion Error:", err);
		return { success: false, error: String(err) };
	}
}

/**
 * 语义搜索：根据用户提问找回相关知识片段
 */
export async function retrieveContext(query: string) {
	try {
		// 1. 将用户的提问向量化
		const { embedding } = await embed({
			model: google.embedding("gemini-embedding-001"),
			value: query,
		});

		// 2. 调用我们在 Supabase 里定义的 RPC 函数
		const { data: documents, error } = await supabase.rpc("match_documents", {
			query_embedding: embedding,
			match_threshold: 0.5, // 相似度超过 50% 的才要
			match_count: 3, // 取最相关的 3 条
		});

		if (error || !documents) return { text: "", sources: [] };

		// 3. 返回拼接后的文本用于 AI 阅读，同时返回 sources 用于前端显示
		const contextText = documents.map((doc: any) => doc.content).join("\n\n");
		const sources = documents.map((doc: any) => ({
			content: doc.content,
			source: doc.metadata?.source || "本地知识库",
			similarity: (doc.similarity * 100).toFixed(1),
		}));
		return { text: contextText, sources };
	} catch (err) {
		console.error("Retrieval Error:", err);
		return { text: "", sources: [] };
	}
}
