/**
 * AI Agent 聊天 API 路由
 *
 * 这是后端的核心文件，负责：
 * 1. 接收前端发来的消息
 * 2. 调用 AI 模型（Google Gemini）
 * 3. 为 AI 提供可用的工具
 * 4. 将 AI 的响应流式返回给前端
 */
import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText, tool, UIMessage } from "ai";
import { z } from "zod";
// 1. 导入你之前写的检索函数
import { retrieveContext } from "@/lib/actions/rag";

export const runtime = "edge";

export async function POST(req: Request) {
  const { messages, model }: { messages: UIMessage[]; model?: string } =
    await req.json();

  const isThinking = model === "thinking";
  const isImage = model === "image";
  const modelId = isImage
    ? "gemini-3-pro-image-preview"
    : isThinking
      ? "gemini-3-pro-preview"
      : "gemini-3-flash-preview";

  // 知识库检索现已作为工具(searchKnowledgeBase)提供给模型

  // 3. 消息过滤逻辑（保持你原有的逻辑，解决 thought_signature 报错）
  const filteredMessages = messages.map((m) => {
    if (m.role === "assistant" && m.parts) {
      const newParts = m.parts.filter(
        (p) =>
          p.type === "text" ||
          p.type.startsWith("tool-") ||
          (isThinking && p.type === "reasoning"),
      );
      if (newParts.length === 0) {
        newParts.push({ type: "text", text: "[已生成了一张图片]" } as any);
      }
      return { ...m, parts: newParts };
    }
    return m;
  });

  const result = streamText({
    model: google(modelId),
    messages: await convertToModelMessages(filteredMessages),

    system: `你叫"噜噜"，是一只超级可爱的水豚 AI 助手 🦦，性格活泼、温暖、充满好奇心。
      在对话中，你始终以第一人称"噜噜"自称（例如"噜噜觉得..."、"你问的这个问题，噜噜来帮你查一查！"），语气轻松亲切，喜欢用可爱的表情和语气词，但回答要准确专业。

      【多轮对话与知识库使用指引（人情味 RAG）】
      1. 当用户询问业务相关问题、事实背景时，请使用 searchKnowledgeBase 工具。
      2. 即使你在调用工具，也应该在给用户的回答中结合用户的历史情绪。在提供死板的知识前，先用富有人情味的话语回应、安抚或接茬（例如“噜噜刚才查了一下关于XX的资料，发现…”）。
      3. 【关键改写】如果用户正在连贯追问之前的话题，在使用 searchKnowledgeBase 的 \`query\` 参数时，务必自己内部进行多轮对话改写，将用户的简意、代词（如“他”、“这个”）还原为完整、独立的一句话搜索词（Standalone Query），提高检索精度！

      当用户要求修改主题时，请使用 updateTheme 工具。
      当用户询问房价时，请使用 getHousingPrice 工具。`,

    // 思考模式配置
    ...(isThinking && {
      providerOptions: {
        google: { thinkingConfig: { includeThoughts: true } },
      },
    }),

    // 图片生成模式配置
    ...(isImage && {
      providerOptions: {
        google: {
          responseModalities: ["TEXT", "IMAGE"] as ("TEXT" | "IMAGE")[],
        },
      },
    }),

    // 工具定义逻辑
    ...(!isImage && {
      tools: {
        searchKnowledgeBase: tool({
          description:
            "当需要回答业务知识、特定规则或事实背景时，调用此工具搜索本地知识库。",
          inputSchema: z.object({
            query: z
              .string()
              .describe(
                "【非常重要】结合上下文多轮对话结构，将用户的简意、代词等改写为完整、独立的搜索词（Standalone Query），必须包含所有必要的背景信息才可以触发检索",
              ),
          }),
          execute: async ({ query }) => {
            console.log(`AI 正在搜索知识库: ${query}`);
            // 结构化解构
            const { text, sources } = await retrieveContext(query);
            return {
              foundInfo: text ? true : false,
              content: text || "未找到相关知识",
              sources: sources, // 将来源传递给前端
            };
          },
        }),
        getHousingPrice: tool({
          description: "获取指定区域的平均房价",
          inputSchema: z.object({
            location: z.string().describe("区域名称，如：西湖区、未来科技城"),
          }),
          execute: async ({ location }) => {
            console.log(`正在查询 ${location} 的数据...`);
            return { price: 45000, unit: "CNY/sqm", trend: "stable" };
          },
        }),
        updateTheme: tool({
          description: "修改应用界面主题颜色",
          inputSchema: z.object({
            color: z.string().describe("十六进制颜色值或 CSS 标准颜色名称"),
            reason: z.string().describe("为什么要选择这个颜色的简短说明"),
          }),
          execute: async ({ color, reason }) => {
            return { success: true, activeColor: color, reason };
          },
        }),
      },
    }),
  });

  return result.toUIMessageStreamResponse();
}
