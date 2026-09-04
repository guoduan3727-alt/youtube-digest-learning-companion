# YouTube Digest Learning Companion v1.3.0 功能审核

[English audit](AUDIT.md) | [中文 README](README.zh-CN.md) | [贡献者与署名](CONTRIBUTORS.md)

审核日期：2026 年 9 月 4 日

## 审核结论

增强版完整保留了上游 YouTube Digest v1.2.0 的功能，并新增单词本、Obsidian、播放器底部双语字幕和共享翻译缓存。自动发布门槛已通过：**83 项测试全部通过**，扩展发布包只包含 **25 个白名单文件**。

自动测试无法保证未来每一种 YouTube 页面结构，以及实时 Supadata、DeepSeek、Chrome 和 Obsidian 交互始终正常。因此每次发布前仍应在 Chrome 中重新加载扩展，并用真实的带字幕视频完成一次人工冒烟测试。

## 项目来源与署名

- 原始项目：[zarazhangrui/youtube-digest](https://github.com/zarazhangrui/youtube-digest)
- 原作者和上游维护者：[Zara Zhang (@zarazhangrui)](https://github.com/zarazhangrui)
- 已合并的上游版本：v1.2.0，以及本次审核时可用的最新上游文档提交
- 增强版维护者：[Guoduan37 (@guoduan3727-alt)](https://github.com/guoduan3727-alt)
- 开发协助：[OpenAI Codex](https://openai.com/codex/)
- 完整说明：[CONTRIBUTORS.md](CONTRIBUTORS.md) 与上游 [Contributors 图](https://github.com/zarazhangrui/youtube-digest/graphs/contributors)

[LICENSE](LICENSE) 中 Zara Zhang 的原始 MIT 版权声明保持不变。项目保留完整上游 Git 历史，没有用新的根提交覆盖原作者历史。

## 功能保留与新增矩阵

| 范围 | 保留的上游功能 | 增强版新增 | 验证方式 |
| --- | --- | --- | --- |
| YouTube 页面 | Digest 按钮跟随响应式操作栏，点击后打开侧边栏。 | 双语字幕层位于当前播放器内，并在单页跳转时清理。 | 内容脚本与回归测试 |
| Transcript | 原生字幕、时间戳、点击跳转、复制、导出和阅读位置恢复。 | 可从选中文本添加单词；播放器与面板共用语义字幕分段。 | 字幕、选择、导航和导出测试 |
| 字幕搜索 | 按字面匹配、不区分大小写、上一个与下一个结果。 | 翻译行重新渲染后仍能搜索。 | 搜索与翻译测试 |
| 语言显示 | Transcript、Overview、Notes 共用 Original、中文和双语模式。 | 播放器双语字幕保持独立开关。 | 模式持久化与播放器测试 |
| Overview | AI 总结、章节、重点引用、时间戳和渐进翻译。 | 沿用当前翻译流程，不删除概览生成。 | 翻译与功能保留测试 |
| Notes | 播放器时间戳笔记、选中文本笔记、筛选、播放、删除和翻译。 | 单词本作为独立集合，不替代 Notes。 | 笔记、文本选择和回归测试 |
| 选中文本 | Explain 和 Note。 | 新增第三个等宽的 Add word 操作。 | 选择工具栏测试 |
| 单词本 | 上游没有此功能。 | 去重、多个视频语境、词典生成、Markdown 复制与导出、播放、刷新和删除。 | 单词本与词典生成测试 |
| Obsidian | 上游没有此功能。 | 官方 `obsidian://` URI、剪贴板传递长 Markdown、稳定文件名和重复更新。 | URI、文件名、Markdown 与同步测试 |
| 翻译效率 | 渐进翻译和缓存。 | Full Transcript 与播放器共用基础字幕缓存和正在执行的请求。 | 单次请求与缓存复用测试 |
| Settings | 中英文设置、本地 Key 存储和固定 DeepSeek 服务配置。 | 新增 Obsidian Vault/文件夹设置和本地单词本清除。 | 设置与发布测试 |

## 敏感信息与隐私检查

- 源代码不需要真实 API Key。Key 由用户亲自在扩展 Settings 中输入，保存在 Chrome 扩展本地存储中。
- Git 忽略 `config.js`、`.env*`、私钥文件、`node_modules` 和 `dist`。
- 发布脚本会扫描准备公开的已跟踪与未跟踪文件，阻止常见 API Key、Token、私钥、凭据赋值和 Obsidian Vault ID。
- 已提交的 Obsidian 冒烟测试使用无敏感性的虚拟 Vault 名称。
- 扩展 ZIP 只从明确白名单生成，不包含测试、开发工具、本地配置或被忽略文件。
- 独立的 Git 历史模式扫描没有发现 Key、Token、私钥块或真实 Vault ID；扫描器自身的正则定义除外。
- 服务请求和本地存储行为记录在 [PRIVACY.md](PRIVACY.md) 和 [SECURITY.md](SECURITY.md)。

## 验证命令

```bash
npm test
npm run check
npm run package
```

Windows 需要 Git Bash 等 Bash 环境来执行仓库脚本。如果没有 `zip` 工具，只能使用 `scripts/check-release.sh --print-files` 输出的准确文件清单创建 ZIP，并在发布前检查压缩包内容。

## 发布门槛结果

- JavaScript 语法检查：通过
- 自动测试：83 项通过，0 项失败
- Manifest 与 package 版本一致：通过，版本 1.3.0
- 发布文件白名单：通过，共 25 个文件
- 凭据与 Vault ID 扫描：通过
- Git 冲突标记与空白检查：通过
- 实时服务与真实视频冒烟测试：有可用凭据和合适视频时，发布前必须执行
