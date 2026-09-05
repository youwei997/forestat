//! 首次启动处理:在开始菜单创建快捷方式(可用 `--no-shortcut` 跳过)。

use std::path::PathBuf;

/// 开始菜单快捷方式路径(当前用户)。
fn shortcut_path() -> Option<PathBuf> {
    dirs_next::data_dir().map(|base| {
        base.join(r"Microsoft\Windows\Start Menu\Programs\forestat.lnk")
    })
}

/// 用 PowerShell/COM 创建开始菜单快捷方式。失败不致命,只返回错误信息。
fn create_shortcut() -> Result<(), String> {
    let target = std::env::current_exe().map_err(|e| format!("获取 exe 路径失败: {e}"))?;
    let lnk = shortcut_path().ok_or("无法定位开始菜单目录")?;

    // 幂等:已存在则跳过
    if lnk.exists() {
        return Ok(());
    }
    if let Some(parent) = lnk.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建开始菜单目录失败: {e}"))?;
    }

    let script = format!(
        "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('{}'); \
         $s.TargetPath = '{}'; $s.WorkingDirectory = '{}'; $s.Description = 'forestat 软件使用时长统计'; \
         $s.Save()",
        lnk.display(),
        target.display(),
        target.parent().unwrap_or(&target).display(),
    );
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .output()
        .map_err(|e| format!("启动 PowerShell 失败: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "创建快捷方式失败: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

/// 首次运行入口:返回提示信息(UI 可展示)。非首次运行或带 --no-shortcut 时不做任何事。
pub fn handle_first_run() -> Option<String> {
    if !crate::config::AppConfig::is_first_run() {
        return None;
    }
    if std::env::args().any(|a| a == "--no-shortcut") {
        return None;
    }
    match create_shortcut() {
        Ok(()) => Some("已在开始菜单创建 forestat 快捷方式".to_string()),
        Err(e) => Some(format!("快捷方式创建失败(不影响使用): {e}")),
    }
}
