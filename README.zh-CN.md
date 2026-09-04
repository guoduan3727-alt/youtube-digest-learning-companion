# YouTube Digest Learning Companion

[English](README.md) | [简体中文](README.zh-CN.md)

> [!IMPORTANT]
> **项目来源：** 本项目是在 [Zara Zhang（@zarazhangrui）](https://github.com/zarazhangrui)创建的原始 [YouTube Digest](https://github.com/zarazhangrui/youtube-digest) 项目基础上继续完善，是对她原代码库的直接扩展，并非无关的重新实现。项目保留完整上游 Git 历史和 Zara Zhang 的原 MIT 版权声明。本增强版由我们独立维护，不代表原作者对增强版背书。

YouTube Digest Learning Companion 保留原插件的 Chrome 右侧面板工作方式，重点增加语言学习功能：播放器底部双语字幕、可复用的单词本、双语词典、多视频语境和易读的 Obsidian 笔记。

为了保持与上游项目的兼容性，Chrome 中的扩展名称仍为 **YouTube Digest**。

![YouTube Digest 双语演示](YouTube%20Digest%20demo%20bilingual.png)

## 开发贡献

| 贡献者 | 身份 | 主要贡献 |
| --- | --- | --- |
| [Zara Zhang (@zarazhangrui)](https://github.com/zarazhangrui) | 原作者、上游维护者 | 创建本增强版直接基于的原始 [YouTube Digest](https://github.com/zarazhangrui/youtube-digest) 项目。 |
| [Guoduan37 (@guoduan3727-alt)](https://github.com/guoduan3727-alt) | Learning Companion 维护者 | 提出增强需求，负责整合、测试、文档和公开发布。 |
| [OpenAI Codex](https://openai.com/codex/) | AI 开发协助 | 协助功能实现、上游合并、回归测试、安全审查和文档整理。 |

GitHub 自动生成的 [Contributors 图](https://github.com/guoduan3727-alt/youtube-digest-learning-companion/graphs/contributors)按照已关联的提交身份统计。Codex 没有供本项目使用的 GitHub 身份或验证提交邮箱，因此通过本表、[CONTRIBUTORS.md](CONTRIBUTORS.md)、[NOTICE.md](NOTICE.md)和提交说明准确署名，不创建虚假账号。

## 本增强版新增内容

| 新增功能 | 使用入口 | 实际效果 |
| --- | --- | --- |
| 播放器底部双语字幕 | 点击 Full Transcript 上方的 **播放器双语**。 | 在普通、剧院和全屏模式中直接显示原文与中文。 |
| 共用翻译缓存 | 同时使用播放器字幕和 Full Transcript。 | 两者复用相同字幕分段、缓存和正在执行的请求，同一句不会重复调用 DeepSeek。 |
| 单词本 | 在 Transcript 中选中文本并点击 **Add word**。 | 保存单词或短语、完整原句、视频、频道和时间戳。 |
| 单词去重与多语境 | 在其他句子或视频中再次添加同一单词。 | 只保留一个词条并追加不同语境；同一时间点重复添加会被忽略。 |
| 双语词典 | 保存时保留 **Generate dictionary details**，也可以之后生成。 | 补充音标、多个义项、中英文释义、对应例句、整句翻译和本句含义。 |
| Obsidian 单词笔记 | 设置 Vault 与文件夹，再点击 **Send to Obsidian**。 | 通过 Obsidian 官方 URI，为每个标准化单词创建或更新一份易读 Markdown 笔记。 |

这些功能都是新增功能，不会删除原有 Transcript、Overview、Notes、搜索、选中文本讲解、导出和时间跳转。

## 安装

1. 下载[最新 Release](https://github.com/guoduan3727-alt/youtube-digest-learning-companion/releases/latest)或 [main 分支 ZIP](https://github.com/guoduan3727-alt/youtube-digest-learning-companion/archive/refs/heads/main.zip)。
2. 解压到一个长期保留的文件夹。
3. 打开 `chrome://extensions`，启用“开发者模式”，点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的文件夹。
4. 打开 YouTube Digest **Settings**，亲自填写 [Supadata API Key](https://dash.supadata.ai/)和 [DeepSeek API Key](https://platform.deepseek.com/api_keys)。
5. 打开一个带原生字幕的普通 YouTube 视频，再点击扩展图标。

API Key 只能填写在扩展 Settings 页面。不要把 Key 放进源代码、AI 对话、截图、GitHub Issue 或提交。Key 保存在 Chrome 扩展本地存储中，不包含在仓库和发布 ZIP 里。

## 原有功能概述

原插件功能全部保留，这里只作简要说明：

- **Transcript：** 阅读、搜索、复制、导出、翻译字幕，并点击时间戳跳转。
- **Overview：** 生成 AI 总结、章节和重点引用。
- **Notes：** 保存和回看时间戳笔记。
- **选中文本：** 对选中内容进行讲解，或直接保存为笔记。
- **语言模式：** 在 Transcript、Overview 和 Notes 中使用 Original、中文或双语。

原有功能的详细操作、服务背景和设计说明，请直接查看 [Zara Zhang 原项目 README](https://github.com/zarazhangrui/youtube-digest#readme)。下面重点介绍本增强版新增功能。

## 使用播放器底部双语字幕

1. 打开带字幕的 YouTube 视频，并在右侧面板加载 Transcript。
2. 点击 Full Transcript 上方的 **播放器双语**。
3. 在普通、剧院或全屏模式下继续观看。
4. 再次点击该按钮即可关闭。

开启后会优先翻译当前播放位置，再逐步补齐整段视频。字幕层会暂时隐藏 YouTube 原生字幕，避免原文重复；关闭时会恢复原生字幕。

播放器字幕与 Full Transcript 使用相同的语义字幕分段和本地翻译缓存。如果两处请求同一句，也会共用正在执行的请求，不会为同一句向 DeepSeek 调用两次。

## 建立单词本

1. 在 Transcript 中选中一个单词或短语。
2. 点击 **Add word**。
3. 检查自动捕获的完整原句和时间戳，也可以填写个人释义。
4. 需要双语词典时保留 **Generate dictionary details**，也可以之后在 **Words** 中生成。
5. 打开 **Words**，可以播放原视频位置、复制 Markdown、刷新词典、删除词条或导出完整单词本。

每个单词词条可以包含：

- 原形与音标。
- 多个常用义项及中英文释义。
- 每个义项对应的中英文例句。
- 所有已保存的视频原句、完整翻译、本句含义、可选语言说明和时间戳来源链接。

### 重复单词与多个视频

保存前会对单词进行标准化，同一单词不会生成第二张卡片：

- 同一单词、同一视频时间点的重复添加会被忽略。
- 同一单词出现在其他时间点或其他视频时，会追加新语境。
- 已有词典义项会直接复用，DeepSeek 只分析新句子，不重新生成整份词典。
- 历史重复词条会在读取时自动合并，不丢失任何视频语境。

## 把单词发送到 Obsidian

1. 在 YouTube Digest Settings 中填写 Obsidian Vault 名称或 Vault ID。
2. 设置文件夹，例如 `YouTube Digest/Vocabulary`。如果文件夹不存在，发送笔记时 Obsidian 会创建它。
3. 在 **Words** 中对某个单词点击 **Send to Obsidian**。
4. 如果 Chrome 询问是否打开 Obsidian，请允许。

此功能使用 Obsidian 官方 `obsidian://` URI，不需要社区插件，也不需要额外 API Key。为了可靠传递较长的多义项笔记，扩展会先把 Markdown 写入剪贴板，再让 Obsidian 使用剪贴板内容创建或更新笔记。

每个标准化单词使用一个稳定文件名，例如 `serendipity.md`。再次发送时会更新同一文件，不会重复创建。笔记分为：

1. **Dictionary：** 音标、多个双语义项和对应例句。
2. **Video contexts：** 所有收集到的原句、翻译、本句含义、可选语言说明和视频时间戳链接。

Obsidian Properties 包含学习状态、首次添加日期、更新时间、语境数和视频数，可以直接用于 Bases 或 Dataview 的筛选与统计。

## 数据、服务与限制

- Supadata 接收 YouTube 地址，用于获取原生字幕。
- DeepSeek 只接收当前 AI 功能需要的内容，例如少量字幕分段，或选中的单词与原句。
- API Key、笔记、单词本和最近缓存保存在 Chrome 本地。
- 只有点击 **Send to Obsidian** 时，词条才会发送给 Obsidian。
- 扩展没有开发者运营的账号系统、广告、分析统计或行为追踪。

发布版本支持 Chrome 116 或更高版本、普通 `youtube.com/watch` 页面、Supadata 返回的原生字幕和 DeepSeek V4 Flash。Shorts、直播、私密视频、受访问限制的视频以及没有原生字幕的视频可能无法使用。详情见 [PRIVACY.md](PRIVACY.md) 和 [SECURITY.md](SECURITY.md)。

## 审核与发布

- 自动测试：**83 项通过，0 项失败**。
- 发布包：**25 个明确白名单文件**。
- 检查范围包括 JavaScript 语法、功能回归、凭据模式、私钥块、GitHub Token 和 Obsidian Vault ID。
- 自动测试不能替代使用用户自己服务账号完成的真实视频冒烟测试。

完整结果见 [AUDIT.zh-CN.md](AUDIT.zh-CN.md)。下载 [YouTube Digest Learning Companion v1.3.0](https://github.com/guoduan3727-alt/youtube-digest-learning-companion/releases/tag/v1.3.0)。

## 来源、贡献者与许可证

本仓库保留原项目历史和 Zara Zhang 的 MIT 版权声明。详见 [NOTICE.md](NOTICE.md)、[CONTRIBUTORS.md](CONTRIBUTORS.md)、上游 [Contributors 图](https://github.com/zarazhangrui/youtube-digest/graphs/contributors)和 [LICENSE](LICENSE)。
