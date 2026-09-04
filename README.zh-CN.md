# YouTube Digest

[English](README.md) | [简体中文](README.zh-CN.md)

> [!IMPORTANT]
> **项目来源：** 本增强版直接基于 [Zara Zhang 的 YouTube Digest 项目（@zarazhangrui）](https://github.com/zarazhangrui/youtube-digest)继续完善，是对原代码库的扩展，并非无关的重新实现。Zara Zhang 是原作者；项目保留完整上游 Git 历史和原 MIT 版权声明。本增强版由我们独立维护，不代表原作者对增强版背书。详见 [NOTICE](NOTICE.md) 和[贡献者说明](CONTRIBUTORS.md)。

把每个 YouTube 视频变成一份可以深入学习的资料。YouTube Digest 把字幕、双语翻译、AI 概览、内容讲解和时间戳笔记放进同一个 Chrome 侧边栏，让你可以持续学习视频中的知识和语言，同时不丢失原视频上下文。

- 把零碎字幕变成清晰、可搜索的学习资料。
- 查看原文、简体中文翻译，或中英双语对照字幕来学习语言。
- 把原文和中文译文叠加到视频底部，像观看双语电影一样持续观看。
- 通过 AI 概览、章节、重点引用和选中文本讲解建立系统理解。
- 点击字幕、概览或笔记中的时间戳，快速跳转到对应位置。
- 保存自动润色的时间戳笔记，方便之后复习。
- 使用自己的 API Key，数据保存在本地 Chrome 中，不包含分析统计或行为追踪。

YouTube Digest 是一个需要自行提供 API Key 的开源项目，通过 GitHub 安装。目前没有上架 Chrome 应用商店，不赠送 API 额度，也没有开发者运营的服务器。

这个增强版基于 [Zara Zhang 的原始 YouTube Digest 项目（@zarazhangrui）](https://github.com/zarazhangrui/youtube-digest)继续开发，完整保留上游 Git 历史和 MIT 许可证，由增强版维护者独立维护，不代表上游官方发布。原作者、历史贡献者以及 OpenAI Codex 的协助说明见 [Contributors and attribution](CONTRIBUTORS.md)。

**快速导航：** [增强功能](#增强版-v130-新增功能) · [手动安装](#手动安装) · [API-Key 设置](#设置-api-key) · [播放器双语](#使用-youtube-digest) · [单词本与 Obsidian](#使用-obsidian-建立单词本) · [审核报告](AUDIT.zh-CN.md) · [隐私说明](PRIVACY.md)

点击查看演示和教学视频（小白友好）：[https://www.bilibili.com/video/BV1dnuq6dEak/](https://www.bilibili.com/video/BV1dnuq6dEak/)

![YouTube Digest 双语演示](YouTube%20Digest%20demo%20bilingual.png)

## 增强版 v1.3.0 新增功能

| 新增功能 | 如何使用 | 实际效果 |
| --- | --- | --- |
| 收集生词 | 在 Transcript 中选中单词或短语，再点击 **Add word**。 | 保存单词、完整原句、视频、频道和时间戳。 |
| 自动去重与追加语境 | 在另一句话或另一个视频中再次添加同一单词。 | 只保留一个词条，只追加新的语境；同一时间点重复添加会被忽略。 |
| 双语词典信息 | 保存时保留 **Generate dictionary details**，也可之后点击 **Generate details**。 | 补充音标、多个义项、中英文释义、对应例句、原句翻译和本句含义。 |
| Obsidian 单词笔记 | 在 Settings 中填写 Vault 和文件夹，再到 Words 点击 **Send to Obsidian**。 | 通过官方 Obsidian URI，为每个标准化单词创建或更新一份易读的 Markdown 笔记。 |
| 播放器底部双语字幕 | 点击 Full Transcript 上方的 **播放器双语**。 | 在普通、剧院和全屏模式中显示原文与中文，右侧面板功能继续保留。 |
| 共用翻译缓存 | 同时使用播放器字幕和 Full Transcript。 | 两者复用相同的字幕分段、缓存和正在进行的请求，同一句不会重复调用 DeepSeek。 |

以上功能全部采用新增方式实现。原有 Transcript、Overview、Notes、搜索、选中文本讲解、导出、设置和时间跳转都保留。完整功能保留矩阵和测试证据见[功能审核报告](AUDIT.zh-CN.md)。

### 保留的上游 v1.2.0 功能

- 搜索字幕中的单词或短语，并依次查看所有匹配位置。
- 在 Transcript、Overview 和 Notes 中共用 Original、中文和双语设置。新视频默认保持 Original，不会自动消耗翻译 token。
- 只翻译当前可见的 Overview 和 Notes 内容，并通过小批次渐进显示和缓存结果。
- 选中字幕后，可以直接讲解内容或保存带时间戳的笔记。
- 页面跳转后保留字幕阅读位置，并在离开 YouTube 视频页面时自动关闭侧边栏。

## 五分钟开始使用

1. [下载增强版项目 ZIP](https://github.com/guoduan3727-alt/youtube-digest-enhanced/archive/refs/heads/main.zip)，解压到一个长期保留的文件夹。
2. 打开 `chrome://extensions`，启用“开发者模式”，点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的文件夹。
3. 打开 **Settings**，亲自在设置页面填写 Supadata 和 DeepSeek API Key。不要把 Key 写入文件、AI 对话、截图或 GitHub Issue。
4. 打开一个带字幕的普通 YouTube 视频，点击 YouTube Digest 扩展图标。
5. 在右侧使用 Transcript、Overview、Notes 和 Words；需要视频底部双语字幕时点击 **播放器双语**。
6. 使用 Obsidian 时，只需在 Settings 中填写 Vault 名称或 ID 和目标文件夹，再对已保存单词点击 **Send to Obsidian**。

下方继续提供完整安装、服务配置、功能行为、费用、隐私说明和故障排查。

## 让你的编程 Agent 帮你安装

你不需要看懂代码，也不需要会使用命令行。把下面这段话发送给你的编程 Agent：

> 请把这个项目下载或克隆到我选择的长期保留文件夹，告诉我准确的完整路径，并让 Chrome“加载已解压的扩展程序”使用同一个文件夹。如果我在第一次安装时需要位置建议，可以推荐 macOS 或 Linux 上的 `~/Documents/youtube-digest`，或 Windows 上的 `%USERPROFILE%\Documents\youtube-digest`，但不要假设我一定使用这些路径。请用简单易懂的语言一步一步指导我完成安装和配置。https://github.com/guoduan3727-alt/youtube-digest-enhanced

你的 Agent 应该帮你：

1. 先询问你想把项目长期保存在哪里，再下载或克隆到那里，并告诉你准确的完整路径。如果你需要建议，可以推荐 macOS 或 Linux 上的 `~/Documents/youtube-digest`，或 Windows 上的 `%USERPROFILE%\Documents\youtube-digest`。
2. 打开下方 Supadata 和 DeepSeek 官方页面，指导你创建自己的账号。
3. 指导你在 Chrome 中通过“加载已解压的扩展程序”选择你刚才确定的那个准确项目文件夹。
4. 告诉你应该在扩展的“设置”页面哪个位置填写 API Key。
5. 打开一个带字幕的 YouTube 视频，确认字幕和翻译功能可以使用。

安装后请让这个文件夹留在原位。如果移动或删除它，Chrome 中加载的本地扩展会失效，需要从新的长期存放位置重新加载。

不要把 API Key 发送到 AI 对话、源代码、截图或公开消息中。请你自己在 YouTube Digest 的设置页面直接填写。编程 Agent 可以告诉你填写位置，但不需要看到 Key。

## 手动安装

如果你想自己操作：

1. 打开 [github.com/guoduan3727-alt/youtube-digest-enhanced](https://github.com/guoduan3727-alt/youtube-digest-enhanced)。
2. 点击 **Code**，再选择 **Download ZIP**。
3. 选择一个长期保留的文件夹，并把项目解压到这里。可选建议是 macOS 或 Linux 上的 `~/Documents/youtube-digest`，或 Windows 上的 `%USERPROFILE%\Documents\youtube-digest`。你也可以使用其他文件夹。
4. 在 Chrome 地址栏打开 `chrome://extensions`。
5. 打开右上角的“开发者模式”。
6. 点击“加载已解压的扩展程序”。
7. 选择你刚才确定的那个准确项目文件夹，其中必须包含 `manifest.json`。
8. 如果需要，可以在 Chrome 扩展菜单中固定 YouTube Digest。

这是一个本地加载的扩展，不会自动更新。下载新版或让 Agent 修改代码后，请在 `chrome://extensions` 中找到 YouTube Digest 并点击“重新加载”，然后刷新已经打开的 YouTube 页面。如果移动或删除源代码文件夹，Chrome 中加载的扩展会失效，需要从新的位置重新加载。

## 设置 API Key

YouTube Digest 需要你在自己的服务账号中准备两个 Key：

1. **Supadata API Key**，用于获取 YouTube 字幕。
2. **DeepSeek API Key**，用于生成概览、讲解内容、翻译和自动润色笔记。

### 获取 Supadata API Key

1. 打开 Supadata 官方[注册页面](https://dash.supadata.ai/auth/sign-up)。
2. 创建账号并完成简短的新手引导。
3. Supadata 会在新手引导过程中自动生成 API Key。
4. 之后可以随时打开 [Supadata 控制台](https://dash.supadata.ai/)查找或管理 Key。
5. 复制 Key，并粘贴到 YouTube Digest 设置中的 **Supadata API key**。

如果页面流程发生变化，请查看 [Supadata 官方文档](https://docs.supadata.ai/)。

### 获取 DeepSeek API Key

1. 打开 DeepSeek 官方 [API Keys 页面](https://platform.deepseek.com/api_keys)。
2. 按照提示登录，或创建 DeepSeek 开放平台账号。
3. 点击 **Create new API key**，填写容易识别的名称，例如 `YouTube Digest`，然后创建 Key。
4. 立即复制 Key。完整 Key 可能只会显示一次。
5. 把 Key 粘贴到 YouTube Digest 设置中的 **DeepSeek API key**。
6. 如果 DeepSeek 提示余额不足，请在 DeepSeek 开放平台账号中充值后再试。

当前账号和接口说明请查看 [DeepSeek 官方 API 文档](https://api-docs.deepseek.com/)。

在侧边栏中打开 **Settings**。你也可以在 `chrome://extensions` 的 YouTube Digest 卡片中打开扩展选项。Key 只能粘贴到这些设置输入框中。不要把 Key 发送到 AI 对话、项目文件、截图或公开消息中。

发布版本只支持 DeepSeek V4 Flash：

```text
Base URL: https://api.deepseek.com
Model: deepseek-v4-flash
```

YouTube Digest 会让所有 DeepSeek 请求使用非思考模式，以获得更快、更稳定的交互。设置中的接口地址和模型固定，只需要填写 DeepSeek API Key。如果想使用其他服务或模型，请在设置中复制安全的自定义 prompt，让编程 Agent 修改你自己的本地副本。不要把任何 API Key 放进 prompt 或对话。

API Key 和设置保存在你设备上的 Chrome 扩展本地存储中。发布包不会包含或使用 `config.js`。

## 使用 YouTube Digest

1. 打开一个有字幕的普通 YouTube 视频页面。
2. 点击 YouTube Digest 扩展图标，打开侧边栏。
3. 阅读带时间戳的字幕，或选择 **Original**、**中文**、**双语**。
4. 点击字幕区域右上方的 **播放器双语**，在视频底部显示原文和中文译文；再次点击即可关闭。这个开关不会改变右侧字幕当前选择的模式。
5. 打开 **Overview**，查看 AI 生成的章节和重点引用。
6. 选中字幕，获取 AI 内容讲解。
7. 从播放器或重点引用中保存笔记，之后可以在 **Notes** 中查看。

播放器双语字幕会隐藏 YouTube 原生字幕，避免同一行原文重叠；关闭后会恢复原生字幕。字幕层位于播放器内部，因此普通模式、剧院模式和全屏模式都会随视频一起显示。开启后会优先翻译当前播放位置，再逐步补齐整段视频。播放器与右侧 Full Transcript 共用同一套基础字幕翻译和本地缓存；两处同时请求同一句时只会调用一次 DeepSeek。旧版播放器翻译缓存会自动迁移复用。

## 使用 Obsidian 建立单词本

1. 在字幕中选中一个单词或短语，然后点击 **Add word**。
2. 检查自动保存的原句和时间戳，也可以填写个人释义；需要 DeepSeek 自动补全双语词典时，保留 **Generate dictionary details** 选项。
3. 打开 **Words**，可以跳回视频原位置、复制 Markdown，或导出完整单词本。
4. 在 YouTube Digest 设置中填写 Obsidian 知识库名称或 Vault ID，并设置文件夹，例如 `YouTube Digest/Vocabulary`。
5. 在某个单词上点击 **Send to Obsidian**。Obsidian 会创建或更新 `单词.md`；Properties 中包含学习状态、首次添加日期、更新时间、语境数量和视频数量。

生成的笔记分成两部分。**Dictionary** 包含原形、音标、多个常用义项、中英文释义，以及每个义项对应的中英文例句。**Video contexts** 按收集时间列出不同视频中的原句、完整中文翻译、本句含义、可选语言说明和时间戳来源。以前保存的旧单词也可以通过 **Generate details** 补全。

相同的标准化单词只保留一个词条。同一视频时间点的重复添加会被忽略；在新视频或新位置再次遇到该词时，只追加一条语境。如果词典信息已经存在，DeepSeek 只分析新句子，不重新生成义项和通用例句。历史重复词条会在读取时自动合并且不丢失视频语境。

此功能使用 Obsidian 官方 `obsidian://` URI。为了可靠传递包含多个义项和例句的长笔记，点击 **Send to Obsidian** 时会短暂把生成的 Markdown 写入剪贴板，再让 Obsidian 读取剪贴板内容，避免 URI 过长。不需要安装 Obsidian 社区插件，也不需要额外 API 密钥。每个标准化单词是一份稳定命名的笔记，例如 `serendipity.md`，因此再次发送会更新同一个文件。可以使用 Obsidian Bases 或 Dataview 按学习状态、日期、语境数或视频数筛选、分组和计数。首次使用时，Chrome 可能会询问是否允许打开 Obsidian。

升级前按“单词 - 日期 - 编号”生成的旧 Obsidian 文件不会被 URI 自动删除。确认新的 `单词.md` 已包含全部语境后，可以在 Obsidian 中手动归档或删除旧文件。

## 当前支持范围

- Chrome 116 或更高版本。
- 标准的 `youtube.com/watch` 视频页面。
- Supadata 能够返回的原生字幕。YouTube Digest 会优先请求英文字幕，也可能显示其他可用的原生语言。
- 原文、简体中文和双语对照字幕。
- 可单独开关的播放器底部双语字幕，不改变右侧面板原有功能。
- AI 概览、选中文本讲解、翻译和自动润色笔记。
- 本地笔记，以及最近字幕、概览和翻译的本地缓存。
- 发布版本的所有 AI 功能都使用 DeepSeek V4 Flash。其他服务需要修改本地代码，不属于发布版本的支持范围。

Shorts、直播、私密视频、受访问限制的视频，以及没有原生字幕的视频可能无法使用。目前没有测试 Firefox、Safari、移动浏览器或其他 Chromium 浏览器。

YouTube Digest 强制使用 Supadata 的 `mode=native`，不会在没有原生字幕时请求 AI 生成转录，也不会在本地转录音频。

## Supadata 免费额度和请求成本

截至 2026 年 8 月 9 日，[Supadata 价格页面](https://supadata.ai/pricing)显示免费版每月提供 **100 credits**，不需要信用卡，未使用的额度不会结转。价格可能变化，使用前请查看最新页面。

[Supadata 字幕接口文档](https://docs.supadata.ai/get-transcript)说明了不同模式的计费方式：

- 获取一次原生字幕消耗 **1 credit**，与视频时长无关。
- AI 生成字幕每分钟消耗 **2 credits**。YouTube Digest 不会使用这条路径，因为它强制使用 `mode=native`。
- 如果没有可用原生字幕并返回 HTTP `206`，仍会消耗 **1 credit**。

按照当前只获取原生字幕的方式，如果每次请求都成功，免费版每月大约可以查询 100 个视频。重试和没有字幕的查询也会消耗额度，所以实际成功数量可能更少。

DeepSeek 的额度与 Supadata 分开计算。YouTube Digest 不收款，也不转售 API 服务。建议为两个账号设置消费上限并定期查看用量。

## DeepSeek V4 Flash 价格

截至 2026 年 8 月 27 日，DeepSeek 官方[价格页面](https://api-docs.deepseek.com/quick_start/pricing/)列出的每 100 万 token 美元价格如下：

| Token 类型 | 非高峰 | 高峰 |
| --- | ---: | ---: |
| 缓存命中输入 | $0.007 | $0.014 |
| 缓存未命中输入 | $0.22 | $0.44 |
| 输出 | $0.66 | $1.32 |

高峰时段为周一至周五 UTC 01:00–04:00 和 06:00–10:00，其他时间使用非高峰价格。

一个实测的 20 分钟英文视频使用约 **32,600 个输入 token**，并在 43 个小批次中产生约 **3,500 到 4,500 个输出 token**。按当前价格，完整翻译该视频的费用约为：

- **非高峰：$0.003 到 $0.010 USD**。
- **高峰：$0.005 到 $0.020 USD**。

低值假设大部分重复输入命中 DeepSeek 缓存，高值假设输入未命中缓存。右侧面板翻译是延迟按需和渐进式的，只有滚动到并请求的字幕行才会发起调用。开启 **播放器双语** 后，为了连续观看，插件会从当前播放位置开始并逐步翻译完整视频。两种方式共用基础字幕缓存和正在进行的翻译请求，同一句不会因为两个入口同时开启而重复调用 API；重试、服务商行为和价格变化仍可能增加最终成本，使用前请查看官方页面确认最新价格。

## 用编程 Agent 改造成自己的版本

这是一个个人 Remix 项目，不接受上游 Issue 或 Pull Request。如果功能出错，或者你想增加新功能，请下载或 Fork 自己的副本，再让你的编程 Agent 帮你修复、改造和个性化。

YouTube Digest 使用原生 HTML、CSS 和 JavaScript，没有构建步骤，很适合用编程 Agent 做个人项目。你可以尝试：

- 增加更多翻译语言，并让每个人选择自己的学习语言。
- 为课程、访谈、教程、测评或研究视频增加自定义总结模板。
- 增加生词本，保存单词、原句、解释和视频时间戳。
- 把笔记和生词导出到 Markdown、CSV、Anki 或其他学习工具。
- 增加个人主题筛选，只突出与你目标相关的章节。
- 增加本地模型选项，获得不同的隐私和成本方案。
- 改善键盘操作、字体大小和高对比度等无障碍体验。

请让 Agent 保留用户自带 API Key 的模式，不要把秘密写入源代码，并运行下方检查。分享自己的版本前，也要在真实视频上测试。

如果想使用其他 AI 服务或模型，请先在编程 Agent 中打开 Chrome 通过“加载已解压的扩展程序”使用的那个准确的 YouTube Digest 项目文件夹。然后打开 YouTube Digest 设置并点击 **Copy customization prompt**。发送前替换 `[PROVIDER]` 和 `[MODEL]`，但不要加入任何 API Key。Agent 完成本地代码修改后，请你自己在它指出的设置位置填写 Key。

## 隐私和数据流向

YouTube Digest 会直接从扩展向服务商发送请求：

1. 把标准化的 YouTube 视频地址发送给 Supadata，用于获取原生字幕。
2. 当你使用 AI 功能时，把字幕和相关视频信息发送给 DeepSeek。
3. 翻译或讲解等功能只发送当前需要的内容，例如选中的文本和上下文，或少量字幕分段。
4. 首次生成词典信息时，会把选中的单词、所在句子和视频标题发送给 DeepSeek，用于生成双语义项、例句和整句语境分析。同一单词已有词典时，只发送新句子和视频标题进行语境分析。
5. API Key、设置、笔记和最近缓存保存在 Chrome 本地。
6. 生词也保存在 Chrome 本地。只有在你点击 **Send to Obsidian** 时，扩展才会通过设备上生成的 `obsidian://` URI 将该生词发送到 Obsidian。

YouTube Digest 没有账号系统、广告、分析统计或行为追踪。Supadata 和 DeepSeek 仍会按照各自的条款和隐私政策处理数据。详情请查看 [PRIVACY.md](PRIVACY.md)。

## 常见问题

### YouTube 视频页面没有显示 Digest 按钮

- 在 `chrome://extensions` 中找到 YouTube Digest，点击“重新加载”，然后刷新 YouTube 页面。
- 确认当前页面是标准 `https://www.youtube.com/watch?...` 页面，而不是 Shorts、嵌入页面或直播页面。
- 当前版本会在 YouTube 响应式操作栏变化时自动重新定位按钮。页面加载完成后可以稍等片刻。
- 如果你使用的是较早下载的版本，可以先横向调整一次 YouTube 窗口宽度让按钮出现，然后下载最新版，这样之后不再需要调整窗口。
- 如果按钮仍然没有出现，让你的编程 Agent 在这个具体视频页面检查 content script。

### 侧边栏无法打开

- 确认你打开的是标准 `https://www.youtube.com/watch?...` 页面。
- 在 `chrome://extensions` 中确认 YouTube Digest 已启用，并点击“重新加载”。
- 重新加载扩展后，刷新 YouTube 页面。
- 如果问题仍然存在，让你的编程 Agent 检查扩展。

### YouTube Digest 提示需要设置

- 打开 **Settings**，保存 Supadata Key 和 DeepSeek Key。
- 发布版本固定使用 DeepSeek V4 Flash，没有需要填写的 Base URL 或 Model 字段。
- 如果设置提示旧的自定义服务已移除，请重新填写 DeepSeek Key。旧 AI Key 已安全清除，避免被错误用于 DeepSeek。

### 找不到字幕

- 确认视频是公开的，并且有原生字幕。
- 检查 Supadata Key、剩余额度、限速和账号状态。
- 没有字幕的查询和手动重试也可能消耗额度。

YouTube Digest 不会自动改用 AI 生成字幕。

### AI 请求失败

- `401` 或 `403` 通常表示 DeepSeek Key 或账号权限有问题。
- `429` 通常表示达到了 DeepSeek 服务限速或消费上限。
- 确认 Key 来自上方链接的 DeepSeek 开放平台账号，并且账号有可用额度。
- 如果你把本地副本改成了其他模型，请再次使用设置中的自定义 prompt，让编程 Agent 检查本地实现。

不要在对话、截图或日志中分享 API Key、私密字幕或个人笔记。

## 给编程 Agent 的检查命令

修改项目后，让你的编程 Agent 运行：

```bash
npm test
npm run check
npm run package
```

Agent 还应该在 Chrome 中重新加载扩展，并测试多个真实 YouTube 视频。自动检查通过，不代表真实服务请求和 YouTube 交互一定正常。

## 开源许可

MIT，详见 [LICENSE](LICENSE)。
