# Windows 与 PowerShell 经验

- W-001：PowerShell 中出现中文乱码时，先初始化 UTF-8 或显式 UTF-8 读取；显式读取后仍异常，才判断文件编码或内容损坏。
- W-002：本地文档入口为 `AGENTS.md`；外层启动或仓库发现阶段应显式 UTF-8 读取入口，再按其路由读取 `CONTEXT.md` / `LESSONS.md`，不要先用默认编码读中文文件再纠偏。
