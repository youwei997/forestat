use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const CONFIG_DIR_NAME: &str = "forestat";
const CONFIG_FILE_NAME: &str = "config.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    /// 自定义 JSON 输出目录。空/None = 安装目录(exe 所在目录)。
    pub json_dir: Option<String>,
    /// 定时写盘间隔(秒)。
    pub write_interval_secs: u64,
    /// 后台轻量模式(开机自启、静默运行)。仅作为 UI 回显,真实开关在注册表。
    pub background_mode: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            json_dir: None,
            write_interval_secs: 30,
            background_mode: false,
        }
    }
}

impl AppConfig {
    /// exe 所在目录(可写时优先,实现“配置跟 exe 走”的便携模式)。
    fn portable_dir() -> Option<PathBuf> {
        let dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
        // 探测可写性:Program Files 等目录会失败,此时回退 %APPDATA%
        let probe = dir.join(".write-probe");
        if fs::write(&probe, b"ok").is_ok() {
            let _ = fs::remove_file(&probe);
            Some(dir)
        } else {
            None
        }
    }

    /// 配置文件路径:exe 旁边(便携)或 %APPDATA%\forestat(回退)。
    fn config_path() -> PathBuf {
        if let Some(dir) = Self::portable_dir() {
            return dir.join(CONFIG_FILE_NAME);
        }
        let base = dirs_next::config_dir().unwrap_or_else(|| PathBuf::from("."));
        base.join(CONFIG_DIR_NAME).join(CONFIG_FILE_NAME)
    }

    /// 是否为首次运行(配置文件不存在)。
    pub fn is_first_run() -> bool {
        !Self::config_path().exists()
    }

    pub fn load() -> Self {
        let path = Self::config_path();
        match fs::read_to_string(&path) {
            Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
            Err(_) => Self::default(),
        }
    }

    pub fn save(&self) -> std::io::Result<()> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let text = serde_json::to_string_pretty(self)?;
        fs::write(&path, text)
    }

    /// 解析 JSON 输出目录:自定义目录存在则用之,否则 exe 所在目录(安装目录)。
    pub fn resolved_json_dir(&self) -> PathBuf {
        if let Some(dir) = &self.json_dir {
            let p = PathBuf::from(dir);
            if p.is_dir() {
                return p;
            }
        }
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."))
    }

    pub fn current_json_path(&self) -> PathBuf {
        self.resolved_json_dir().join("app-usage.json")
    }

    pub fn backup_json_path(&self) -> PathBuf {
        self.resolved_json_dir().join("app-usage.backup.json")
    }
}

/// 更新注册表自启项:后台模式 = `exe --background`,关闭 = 删除 Run 键值。
pub fn set_registry_autostart(enable: bool) -> Result<(), String> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_SET_VALUE};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let run_key = hkcu
        .open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Run", KEY_SET_VALUE)
        .map_err(|e| format!("打开注册表 Run 键失败: {e}"))?;

    if enable {
        let exe = std::env::current_exe().map_err(|e| format!("获取 exe 路径失败: {e}"))?;
        let value = format!("\"{}\" --background", exe.display());
        run_key
            .set_value("forestat", &value)
            .map_err(|e| format!("写入自启键失败: {e}"))?;
    } else {
        // 键值不存在时 delete 会报错,忽略即可
        let _ = run_key.delete_value("forestat");
    }
    Ok(())
}

/// 读取注册表自启项是否已启用。
pub fn get_registry_autostart() -> bool {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let Ok(run_key) = hkcu.open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Run") else {
        return false;
    };
    run_key.get_value::<String, _>("forestat").is_ok()
}
