# AI Agent Demo (Next.js)

这是一个基于 Next.js 15 和 React 19 构建的多模态 AI Agent 聊天演示项目，深度集成了 Vercel AI SDK 与 Google Gemini 大语言模型。本项目不仅提供基础的对话能力，还实现了多模型切换、AI 思考过程展示、多模态图文输入、AI 生成图片以及智能工具调用（Function Calling）等高阶特性。

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
- **🏡 房价查询 (`getHousingPrice`)**：AI 会自动提取用户对话中的“地名”，并在前端动态渲染美观的 `<PriceCard />` 组件展示结构化的趋势与价格。
- **🎨 动态换肤 (`updateTheme`)**：当你要求 AI 改变界面主题时，它可以直接修改整个应用系统的背景配色。

### 🎨 极致 UI/UX 体验
项目使用 Tailwind CSS v4 和 `@tailwindcss/forms` 打造：
- **图片全屏灯箱 (Lightbox)**：AI 返回的图片支持点击**全屏沉浸预览**，支持按 `ESC` 或点击背景关闭，内置一件**下载原图**按钮。
- **流式响应 (Streaming)**：自然的打字机效果输出，支持随生成自动平滑滚动触底，并且可以随时点击「⏹ 停止」中断生成。
- **Markdown 渲染**：完美支持表格、代码块高亮及多种富文本格式。
- **内联编辑重发**：鼠标悬停任意历史提问可进行快速修改并重新发送对话。
- **一键复制**：提供「复制回答」便捷功能。

## 🛠️ 技术栈

- **前端框架**：[Next.js 15](https://nextjs.org/) (App Router) + [React 19](https://react.dev/)
- **类型系统**：[TypeScript](https://www.typescriptlang.org/)
- **AI 引擎**：[Vercel AI SDK](https://sdk.vercel.ai/docs) (`ai`, `@ai-sdk/react`, `@ai-sdk/google`)
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
GOOGLE_GENERATIVE_AI_API_KEY="your_actual_api_key_here"
```

### 4. 运行开发服务器

```bash
pnpm dev
# 或 npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可开始体验 AI Agent！

## 📂 项目结构导览

- `app/page.tsx`: 前端聊天主交互界面（包含状态管理、拖拽粘贴逻辑、消息渲染器以及图片灯箱组件）。
- `app/api/chat/route.ts`: Node 后端 API 路由，负责与 Gemini 模型建立链接，定义并执行 Server-side Tools，以及通过流式协议下发结果。
- `app/components/`: 前端复用组件（如 `MarkdownRenderer`、`PriceCard` 等）。
