/**
 * AI Agent 聊天 API 路由
 *
 * 这是后端的核心文件，负责：
 * 1. 接收前端发来的消息
 * 2. 调用 AI 模型（Google Gemini）
 * 3. 为 AI 提供可用的工具
 * 4. 将 AI 的响应流式返回给前端
 */

import { google } from "@ai-sdk/google"; // Google Gemini AI 模型
import { convertToModelMessages, streamText, tool, UIMessage } from "ai"; // AI SDK 核心函数
import { z } from "zod"; // Zod 是一个 TypeScript 类型验证库，用于定义工具的输入参数

/**
 * 使用 Edge Runtime
 *
 * Edge Runtime 是一个轻量级的运行时环境，特点：
 * - 启动速度快
 * - 全球分布式部署
 * - 适合流式响应
 *
 * 这对于 AI 应用很重要，因为我们需要实时流式返回 AI 的回复
 */
export const runtime = "edge";

/**
 * POST 请求处理函数
 *
 * 当前端调用 /api/chat 时，这个函数会被执行
 */
export async function POST(req: Request) {
	/**
	 * 1. 解析请求体，获取聊天历史
	 *
	 * messages 包含了所有的对话历史，格式如：
	 * [
	 *   { role: 'user', parts: [{ type: 'text', text: '今天天气怎么样' }] },
	 *   { role: 'assistant', parts: [{ type: 'text', text: '请问您想查询哪个城市的天气？' }] },
	 *   { role: 'user', parts: [{ type: 'text', text: '杭州' }] }
	 * ]
	 */
	const { messages, model }: { messages: UIMessage[]; model?: string } =
		await req.json();

	const isThinking = model === "thinking";
	const modelId = isThinking ? "gemini-3-pro-preview" : "gemini-3-flash-preview";

	/**
	 * 2. 调用 AI 模型生成回复
	 *
	 * streamText 是 AI SDK 的核心函数，它会：
	 * - 调用指定的 AI 模型
	 * - 以流式方式返回结果（一边生成一边返回，不用等全部生成完）
	 * - 自动处理工具调用
	 */
	const result = streamText({
		/**
		 * 指定使用的 AI 模型
		 * 这里使用 Google 的 Gemini Pro 模型
		 */
		model: google(modelId),

		/**
		 * 转换消息格式
		 *
		 * convertToModelMessages 将前端的 UIMessage 格式
		 * 转换为 AI 模型能理解的格式
		 */
		messages: await convertToModelMessages(messages),

		// 思考模式才开启思考功能
		...(isThinking && {
			providerOptions: {
				google: {
					thinkingConfig: { includeThoughts: true },
				},
			},
		}),

		/**
		 * 工具库定义 - AI Agent 的核心！
		 *
		 * 什么是工具（Tool）？
		 * - 工具是 AI 可以调用的函数
		 * - 当 AI 需要获取实时信息或执行操作时，它会选择合适的工具
		 * - AI 会自动决定何时调用工具、传入什么参数
		 *
		 * 工作流程：
		 * 1. 用户问："杭州天气怎么样？"
		 * 2. AI 分析后决定调用 getWeather 工具
		 * 3. AI 自动传入参数 { city: "杭州" }
		 * 4. 工具执行并返回结果 { temperature: 25, condition: "Sunny" }
		 * 5. AI 基于结果生成自然语言回复："今天杭州是晴天，气温25℃"
		 */
		tools: {
			// 定义一个获取房价的工具
			getHousingPrice: tool({
				description: "获取指定区域的平均房价",
				inputSchema: z.object({
					location: z.string().describe("区域名称，如：西湖区、未来科技城"),
				}),
				execute: async ({ location }) => {
					// 这里对接真实的业务接口
					console.log(`正在查询 ${location} 的数据...`);
					// 模拟返回数据
					return { price: 45000, unit: "CNY/sqm", trend: "stable" };
				},
			}),
			updateTheme: tool({
				description:
					"修改应用界面主题颜色，可以指定具体的颜色描述或十六进制色值",
				inputSchema: z.object({
					// 使用 string 替代 enum，并给出详细的描述引导 AI
					color: z
						.string()
						.describe("十六进制颜色值 (如 #FF5733) 或 CSS 标准颜色名称"),
					reason: z.string().describe("为什么要选择这个颜色的简短说明"),
				}),
				execute: async ({ color, reason }) => {
					// 你可以在这里做一些色值校验，或者直接返回
					return { success: true, activeColor: color, reason };
				},
			}),

			/**
			 * 你可以在这里添加更多工具！
			 *
			 * 例如：
			 * - searchDatabase: 搜索数据库
			 * - sendEmail: 发送邮件
			 * - calculatePrice: 计算价格
			 * - bookAppointment: 预约服务
			 *
			 * AI 会根据用户的需求自动选择和组合使用这些工具
			 */
		},
	});

	/**
	 * 3. 将结果以流式响应返回给前端
	 *
	 * toUIMessageStreamResponse() 会：
	 * - 将 AI 的响应转换为前端可以理解的格式
	 * - 以流式方式发送（Server-Sent Events）
	 * - 前端会实时接收并显示
	 *
	 * 这样用户就能看到 AI "一个字一个字地打出来"，体验更好
	 */
	return result.toUIMessageStreamResponse();
}
