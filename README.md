# dsh-mac-mount

> 个人自用插件，代码和文档由 AI 参与编写，不承诺维护。使用前请先备份 DSH 配置。

Cowork 式的会话级本地文件夹挂载：给会话挂上你 Mac 上的某个文件夹，agent 就知道用 `mcp__dshmac__*` 工具读写那里的文件，而不是去找服务器本机路径。

## 用法

输入框侧边的「挂载文件夹」按钮，或 `/macmount` 命令：

| 命令 | 作用 |
| --- | --- |
| `/macmount <路径>` | 挂载一个本地（macOS）文件夹到本会话 |
| `/macmount list` | 列出当前会话已挂载的文件夹 |
| `/macmount off <路径>` | 卸载某一个 |
| `/macmount clear` | 卸载全部 |

## 工作原理

挂载状态不单独存储，而是从会话日志自身派生：每次调用都会往会话里写一条 `command/run` 事件，路径作为参数。好处是 fork / replay 会话时挂载状态原样带走。

派生出的挂载列表在会话创建时（`agent/created`）和每次挂载/卸载后，以一条 `source: mac-mount` 的用户消息注入 agent，指示模型对该路径的读写一律走 dshmac MCP 工具。

## 安装

```bash
dsh plugin --profile web add @huakirax/dsh-mac-mount
```

前置条件：DSH 里已配置 dshmac MCP 服务器（本服务器把信任文件夹暴露给会话），否则挂载本身无意义。

## License

MIT
