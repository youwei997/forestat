# forestat

Windows 前台应用时长统计器 —— Steam 式"每个软件用了多少小时"。

> 本项目参考了 [ActivityWatch/aw-tauri](https://github.com/ActivityWatch/aw-tauri) 项目的架构思路,业务代码为全新实现,遵循 [MPL-2.0](LICENSE.txt) 许可。

**绿色单 exe,免安装**:把 `forestat.exe` 放到任意可写目录(如 OneDrive 文件夹)直接运行即可。exe、config.json、app-usage.json 全部自包含在同一目录,整个文件夹可随 OneDrive 同步。

## 完整使用流程

### 1. 首次运行

```
双击 forestat.exe
  → 自动在开始菜单创建快捷方式(--no-shortcut 可跳过)
  → 打开统计界面
  → 后台开始计时
```

### 2. 日常使用

- **看统计**:双击图标(或开始菜单快捷方式)打开界面,表格显示每个软件的 今日 / 今年 / 总计 时长,5 秒自动刷新
- **关窗口** = 只是隐藏,计时继续;下次双击图标唤起
- **重复启动**:自动唤起已有实例的窗口,不会出现第二个进程

### 3. 开启后台轻量模式(推荐)

设置页勾选"后台轻量模式"后:

- 注册表 `HKCU\...\Run` 写入 `forestat.exe --background`,开机自动静默启动
- 静默状态:无窗口、无托盘,任务管理器中可见 `forestat.exe` 进程(这就是"认出它"的方式)
- 再次双击图标 → 唤起后台实例的窗口查看数据
- 想"卸载"?设置页点"完全退出"结束进程,再删 Run 键即可

### 4. 数据与同步

每 1 秒轮询前台窗口进程名累计;每 30 秒原子写盘;每天首次写入前把旧的轮转为备份。

```
exe 所在目录
├── forestat.exe            ← 程序本体
├── config.json             ← 配置(首次改设置后出现)
├── app-usage.json          ← 当日 + 历史总计数据(30 秒覆盖)
└── app-usage.backup.json   ← 每日轮转的备份
```

- 整个文件夹拷走 = 数据带走;放入 OneDrive 即多机同步
- 数据损坏自动回退 backup,重启不丢累计
- JSON 目录可在设置里改到任意文件夹,恢复默认即 exe 旁
- 注意:开机自启的注册表键是每台机器本地的,新机器上需重新开启一次后台模式

## 命令行参数

| 参数 | 作用 |
|---|---|
| (无参数) | 打开统计界面,后台计时 |
| `--background` | 静默启动:无窗口无托盘,仅后台计时(开机自启用此参数) |
| `--no-shortcut` | 首次启动不创建开始菜单快捷方式 |

## 功能一览

- 前台时长统计:今日 / 今年 / 总计,按总计排序
- JSON 定时写盘:原子覆盖 + 每日轮转备份 + 损坏回退
- JSON 目录可自定义(OneDrive 同步友好)
- 后台轻量模式:注册表自启、静默运行、任务管理器可辨认
- 单实例 + 按需窗口 + 完全退出

## 开发

```powershell
npm install
cd ui && npm install && cd ..
npm run tauri dev
```

## 构建

```powershell
npm run tauri build                # 裸 exe:src-tauri/target/release/forestat.exe
npm run tauri build -- --no-bundle # 只要裸 exe,不打安装包
```

NSIS 安装包(per-user)为可选项,需要分发给别人时再打。

## 测试

```powershell
cd src-tauri
cargo test        # 单元测试(聚合/写盘/轮转/损坏回退)+ 注册表自启集成测试
```

## 许可

[MPL-2.0](LICENSE.txt)
