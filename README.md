# AI Agent Demo (Next.js)

这是一个基于 Next.js 15 和 React 19 构建的多模态 AI Agent 聊天演示项目，深度集成了 Vercel AI SDK 与 Google Gemini 大语言模型。本项目不仅提供基础的对话能力，还实现了多模型切换、AI 思考过程展示、多模态图文输入、AI 生成图片以及智能工具调用（Function Calling）等高阶特性。除此之外，它还具备了完善的 **Supabase 认证登录**、**云端历史消息同步**以及**动态个人信息与头像上传**机制。

## ✨ 核心特性

### 🤖 多模型无缝切换
聊天输入框右侧提供下拉菜单，支持在三种专为不同场景设计的模式间自由切换：
- **⚡ 快速模式 (Fast)**：使用 `gemini-3-flash-preview`，提供低延迟的极速对话体验。
- **💭 思考模式 (Thinking)**：使用 `gemini-3-pro-preview`，展示 AI 强大的深度推理能力。界面会以可折叠的 UI 渲染出 AI 的“思考过程（Thinking Process）”及其耗时。
- **🖼️ 生图模式 (Image)**：使用 `gemini-3-pro-image-preview`，允许用户通过自然语言描述让 AI 实时作画，并直接在聊天流中返回图片。

### 👁️ 多模态输入（视觉交互）
前端集成了强大的文件交互功能，支持让 AI “看到”图片：
- **拖拽上传**：将图片文件直接拖入输入区域，带有高亮指示器。
- **快捷粘贴**：支持全局监听 `Cmd/Ctrl + V`，快速将剪贴板的截图放入发送队列。
- **按钮上传**：传统的 `📎` 按钮选取文件。
- **图片预览**：发送前会在输入框上方显示带有移除按钮的缩略图队列，同时支持图文混合发送。

### 🛠️ 智能工具调用 (Function Calling / Agentic Capabilities)
AI 能够自动诊断用户意图，并在需要时自主调用后端定义的工具链，最后将结构化数据渲染为沉浸式 React 组件：
- **🔍 知识库检索 (`searchKnowledgeBase`)**：集成了检索增强生成 (RAG) 能力。AI 可在需要时使用多轮对话信息进行**自动语境消解与改写（Standalone Query）**，准确从知识库检索背景资料。而且，基于精心编排的 System Prompt，AI 在吐出检索结果之前，会用具有“人情味”的交互语言进行情绪安抚与自然转折，给用户带来极其流畅细腻的沟通体验。界面会结构化展示命中的资料来源、相似度及支持折叠的原文内容。
- **🏡 房价查询 (`getHousingPrice`)**：AI 会自动提取用户对话中的“地名”，并在前端动态渲染美观的 `<PriceCard />` 组件展示结构化的趋势与价格。
- **🎨 动态换肤 (`updateTheme`)**：当你要求 AI 改变界面主题时，它可以直接修改整个应用系统的背景配色。

> **💡 进阶：RAG 多轮查询独立改写（Query Rewrite 备选方案）**
> 目前系统基于 Agentic Schema 的约束，利用主模型在工具生成时的主题关联瞬间（Zero-latency）完成了多轮重写。若用于长而复杂的真实业务生产，或选用推理能力较弱的开源模型，**建议在检索流程的最前端，挂载一个独立且专门只负责清洗重写词句的廉价低延迟小模型节点**（如 `gemini-1.5-flash`），这种显式流水线的消解成功率通常逼近 100%：
>
> ```typescript
> import { generateText } from "ai";
> import { google } from "@ai-sdk/google";
>
> /**
>  * 🧠 多轮对话重写：补全指代词 (Standalone Query)
>  */
> export async function generateStandaloneQuery(messages: any[]) {
>   const { text } = await generateText({
>     model: google("gemini-1.5-flash"),
>     system: `你是一个搜索优化专家。根据对话历史，将用户最新的提问重写为一个独立的搜索语句。
>     要求：补全所有指代词（它、那个政策等），只输出重写后的句子。`,
>     messages: messages.slice(-5), // 取最近5轮
>   });
>   return text.trim();
> }
> ```
>
> **调用位置示例（在你的 `app/api/chat/route.ts` 的 `execute` 方法中最前端拦截）：**
> ```typescript
> searchKnowledgeBase: tool({
>   description: "搜索本地知识库",
>   inputSchema: z.object({ query: z.string() }),
>   execute: async ({ query }) => {
>     // 1. 显式前置拦截：把原词丢进便宜极速的 Flash 小模型做多轮指代消除
>     const rewrittenQuery = await generateStandaloneQuery(messages);
>     console.log(`[RAG] 原始意图: ${query} => 独立搜索词: ${rewrittenQuery}`);
>
>     // 2. 用洗干净的、信息完整的文本去查数据库
>     const { text, sources } = await retrieveContext(rewrittenQuery);
>     return { foundInfo: !!text, content: text, sources };
>   },
> }),
> ```

### 🔐 身份认证与个人档案 (Authentication & Profile)
系统接入了完整的 Supabase Auth 工作流，为每一位用户提供专属的、被保护的对话环境：
- **OTP 验证码安全登录**：采用 8 位数字 OTP 验证码模式，无需繁琐的密码，输入邮箱接收验证码即可完成安全注册/登录。彻底抛弃了易受邮件防火墙“预消费”影响的链接形式，保障了 100% 的登录成功率与真实跨端连贯体验。
- **自定义个人档案**：登录后，用户可前往设定专属于自己的昵称与自定义头像。
- **直通云对象存储 (Storage)**：所有的用户上传的操作（如头像更新），都可以完全经由客户端直传至 Supabase Storage 安全存储桶中，减少服务器负担。
- **每日调用次数限制 (Rate Limiting)**：为保护 API 资源，系统内置了每日 AI 调用限额机制（默认为 5 次）。支持跨日自动重置计数，并在 UI 侧集成实时剩余次数进度条，超过限额时会给予友好的交互引导。

### 🗂️ 历史会话归档 (Session Persistence)
全面接入云端数据库，安全可靠地存储你的所有对局与高分辨率图片：
- **Supabase 持久化**：彻底告别本地 `localStorage` 的体积限制，基于 Supabase PostgreSQL 数据库结合 Row Level Security (RLS) 行级隔离策略，实现安全、跨设备同步。无论是长文本、还是大规模图片文件，均能被无缝安全地持久化。
- **多会话管理**：支持侧边栏一键新建、快速切换和删除聊天历史。
- **智能标题**：根据第一条发出的消息智能推导当前会话的前缀标题。
- **自动记忆模型**：切换聊天时自动复原该聊天的专有预设模型类型。
- **动态按时序排序**：所有历史记录根据最新互动的时间戳智能调整展示排序。

### 🎨 极致 UI/UX 体验
项目使用 Tailwind CSS v4 和 `@tailwindcss/forms` 打造：
- **图片全屏灯箱 (Lightbox)**：AI 返回的图片支持点击**全屏沉浸预览**，支持按 `ESC` 或点击背景关闭，内置一键**下载原图**按钮。
- **流式响应 (Streaming)**：自然的打字机效果输出，支持随生成自动平滑滚动触底；并且可以随时点击「⏹ 停止」中断生成，系统将以醒目的 UI 状态提示“你已让系统停止这条回答”。
- **Markdown 渲染**：完美支持表格、代码块高亮及多种富文本格式。
- **内联编辑重发**：鼠标悬停任意历史提问可进行快速修改并重新发送对话。
- **一键复制**：提供「复制回答」便捷功能。

## 🛠️ 技术栈

- **前端框架**：[Next.js 15](https://nextjs.org/) (App Router) + [React 19](https://react.dev/)
- **类型系统**：[TypeScript](https://www.typescriptlang.org/)
- **AI 引擎**：[Vercel AI SDK](https://sdk.vercel.ai/docs) (`ai`, `@ai-sdk/react`, `@ai-sdk/google`)
- **状态管理**：[Zustand](https://zustand-demo.pmnd.rs/) (轻量级全局状态一致性方案)
- **样式方案**：[Tailwind CSS v4](https://tailwindcss.com/) + `@tailwindcss/forms`

## 🚀 快速开始

### 1. 环境准备
你需要 Node.js (推荐 18+) 和一个 `Google Gemini API Key`。
去 [Google AI Studio](https://aistudio.google.com/) 申请你的 API Key。

### 2. 初始化项目

```bash
# 获取代码库后，安装依赖
pnpm install
# 或者使用 npm / yarn
```

### 3. 配置环境变量
在项目根目录下创建一个 `.env.local` 文件，并填入你的 API 密钥：

```env
GOOGLE_GENERATIVE_AI_API_KEY="your_google_api_key_here"
NEXT_PUBLIC_SUPABASE_URL="your_supabase_url_here"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key_here"
```

### 4. 运行开发服务器

```bash
pnpm dev
# 或 npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可开始体验 AI Agent！

## 📂 项目结构导览

- `app/page.tsx`: 前端聊天主交互界面（骨架布局与 Session/Hooks 状态管理）。
- `app/login/page.tsx`: 基于 Supabase OTP 实现的 8 位数字验证码双步验证体系与安全无密码登录门户。
- `app/profile/page.tsx`: 个性化主页，支持管理昵称和通过存储桶上传专属头像。
- `app/knowledge/page.tsx`: RAG 知识库管理面板，可以在此导入 PDF 或粘贴长文本让系统自动执行 Split 并写入高维向量库。
- `app/api/chat/route.ts`: Node 后端 API 路由，负责与 Gemini 模型建立链接，注入“人情味（Human Touch）”提示词，定义并执行 Server-side Tools（如知识库检索、风格更新），以及通过流式协议下发结果。
- `app/components/`: 前端其他复用组件（抽离出的各个消息与交互气泡组件 `Message`，侧边栏、工具卡片等）。
- `lib/actions/`: （已分类精简）Server Action 服务端核心动作层
  - `chat.ts`: 实现关于对话会话记录（Chats）及长历史消息（Messages）的数据查询、保存与删除。
  - `knowledge.ts`: 处理大模型（Gemini Embedding）的向量转化、超千字长文的智能递归分片、以及知识相似度检索匹配（`retrieveContext`）。
  - `profile.ts`: 用户基础信息的服务端鉴权修改，包括每日调用次数的校验（`checkAndIncrementDailyCall`）。
- `lib/store/`: 客户端全局状态管理
  - `user-store.ts`: 基于 Zustand 实现的用户档案与调用次数状态中心，确保 UI 跨组件同步。
- `lib/utils/`: 客户端通用的独立计算方法、数据转换及浏览器直接调用 Supabase 上传等工具。
