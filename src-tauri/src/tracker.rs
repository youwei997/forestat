use std::collections::HashMap;
use std::fs;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use chrono::{Datelike, Local, NaiveDate};
use serde::{Deserialize, Serialize};

use crate::config::AppConfig;

const POLL_INTERVAL_MS: u64 = 1000;

/// 单个应用的统计行(给前端)。
#[derive(Debug, Clone, Serialize)]
pub struct StatRow {
    pub app: String,
    /// 今日秒数
    pub today_secs: u64,
    /// 今年秒数
    pub year_secs: u64,
    /// 历史总计秒数
    pub total_secs: u64,
}

/// 磁盘 JSON 结构(当前/备份共用)。
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct UsageFile {
    version: u32,
    updated_at: String,
    /// "YYYY-MM-DD" -> { app名: 当日秒数 }
    days: HashMap<String, HashMap<String, u64>>,
    /// app名 -> 历史总秒数
    totals: HashMap<String, u64>,
}

/// 内存中的聚合数据。
#[derive(Debug, Default)]
pub struct UsageData {
    days: HashMap<NaiveDate, HashMap<String, u64>>,
    totals: HashMap<String, u64>,
}

pub struct Tracker {
    pub data: Mutex<UsageData>,
    /// 上次写盘时的日期,用于"每日首次写入时轮转备份"。
    last_write_date: Mutex<NaiveDate>,
    write_tick: AtomicU64,
}

impl Tracker {
    pub fn new(cfg: &AppConfig) -> Self {
        let data = load_from_disk(cfg);
        Self {
            data: Mutex::new(data),
            last_write_date: Mutex::new(Local::now().date_naive()),
            write_tick: AtomicU64::new(0),
        }
    }

    /// 取前台进程名(小写、无扩展名)。非 Windows 或取不到时返回 None。
    #[cfg(windows)]
    fn foreground_app() -> Option<String> {
        use windows::core::PWSTR;
        use windows::Win32::Foundation::{CloseHandle, HWND};
        use windows::Win32::System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
            PROCESS_QUERY_LIMITED_INFORMATION,
        };
        use windows::Win32::UI::WindowsAndMessaging::{
            GetForegroundWindow, GetWindowThreadProcessId,
        };

        unsafe {
            let hwnd: HWND = GetForegroundWindow();
            if hwnd.0.is_null() {
                return None;
            }
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == 0 {
                return None;
            }
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
            let mut buf = [0u16; 1024];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                PWSTR(buf.as_mut_ptr()),
                &mut len,
            )
            .is_ok();
            let _ = CloseHandle(handle);
            if !ok || len == 0 {
                return None;
            }
            let path = String::from_utf16_lossy(&buf[..len as usize]);
            let name = std::path::Path::new(&path)
                .file_stem()
                .map(|s| s.to_string_lossy().to_lowercase())
                .unwrap_or_else(|| path.to_lowercase());
            Some(name)
        }
    }

    #[cfg(not(windows))]
    fn foreground_app() -> Option<String> {
        None
    }

    /// 累计 1 秒到指定应用。
    fn tick(&self, app: &str, today: NaiveDate) {
        let mut data = self.data.lock().unwrap();
        *data.days.entry(today).or_default().entry(app.to_string()).or_insert(0) += 1;
        *data.totals.entry(app.to_string()).or_insert(0) += 1;
    }

    /// 写盘:跨天首次写入时先把旧 current 复制为 backup,再原子覆盖 current。
    pub fn persist(&self, cfg: &AppConfig) -> std::io::Result<()> {
        self.persist_on(Local::now().date_naive(), cfg)
    }

    /// persist 的可测试版本:日期由调用方注入。
    fn persist_on(&self, today: NaiveDate, cfg: &AppConfig) -> std::io::Result<()> {
        let current = cfg.current_json_path();
        let backup = cfg.backup_json_path();

        {
            let mut last = self.last_write_date.lock().unwrap();
            if today != *last && current.exists() {
                let _ = fs::copy(&current, &backup);
            }
            *last = today;
        }

        let snapshot: UsageFile = {
            let data = self.data.lock().unwrap();
            UsageFile {
                version: 1,
                updated_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                days: data
                    .days
                    .iter()
                    .map(|(d, apps)| (d.format("%Y-%m-%d").to_string(), apps.clone()))
                    .collect(),
                totals: data.totals.clone(),
            }
        };

        if let Some(parent) = current.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(&snapshot)?;
        let tmp = current.with_extension("json.tmp");
        fs::write(&tmp, json)?;
        // Windows 上 rename 到已存在文件会失败,先移除旧的
        if current.exists() {
            let _ = fs::remove_file(&current);
        }
        fs::rename(&tmp, &current)
    }

    /// 前端查询:每个应用的 今日/今年/总计 秒数,按总计降序。
    pub fn stats(&self) -> Vec<StatRow> {
        self.stats_on(Local::now().date_naive())
    }

    /// stats 的可测试版本:日期由调用方注入。
    fn stats_on(&self, today: NaiveDate) -> Vec<StatRow> {
        let data = self.data.lock().unwrap();
        let mut rows: Vec<StatRow> = data
            .totals
            .iter()
            .map(|(app, &total)| {
                let today_secs = data
                    .days
                    .get(&today)
                    .and_then(|m| m.get(app))
                    .copied()
                    .unwrap_or(0);
                let year_secs = data
                    .days
                    .iter()
                    .filter(|(d, _)| d.year() == today.year())
                    .filter_map(|(_, m)| m.get(app))
                    .sum();
                StatRow {
                    app: app.clone(),
                    today_secs,
                    year_secs,
                    total_secs: total,
                }
            })
            .collect();
        rows.sort_by(|a, b| b.total_secs.cmp(&a.total_secs));
        rows
    }

    /// 后台线程:每秒轮询前台应用并累计,按配置间隔定时写盘。
    pub fn spawn(self: &Arc<Self>, cfg: AppConfig) {
        let tracker = Arc::clone(self);
        thread::spawn(move || loop {
            thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));
            if let Some(app) = Self::foreground_app() {
                tracker.tick(&app, Local::now().date_naive());
            }
            let interval = cfg.write_interval_secs.max(5);
            if tracker.write_tick.fetch_add(1, Ordering::Relaxed) + 1 >= interval {
                let _ = tracker.persist(&cfg);
                tracker.write_tick.store(0, Ordering::Relaxed);
            }
        });
    }
}

/// 启动时从磁盘恢复累计数据(优先 current,损坏则尝试 backup)。
fn load_from_disk(cfg: &AppConfig) -> UsageData {
    for path in [cfg.current_json_path(), cfg.backup_json_path()] {
        if let Ok(text) = fs::read_to_string(&path) {
            if let Ok(file) = serde_json::from_str::<UsageFile>(&text) {
                let days = file
                    .days
                    .into_iter()
                    .filter_map(|(d, apps)| {
                        NaiveDate::parse_from_str(&d, "%Y-%m-%d")
                            .ok()
                            .map(|date| (date, apps))
                    })
                    .collect();
                return UsageData {
                    days,
                    totals: file.totals,
                };
            }
        }
    }
    UsageData::default()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试专用 Tracker + 临时目录配置。
    fn test_setup() -> (Tracker, AppConfig, tempdir::TempDir) {
        let dir = tempdir::TempDir::new("forestat-test").expect("create tempdir");
        let cfg = AppConfig {
            json_dir: Some(dir.path().to_string_lossy().to_string()),
            ..AppConfig::default()
        };
        let tracker = Tracker {
            data: Mutex::new(UsageData::default()),
            last_write_date: Mutex::new(NaiveDate::from_ymd_opt(2026, 9, 1).unwrap()),
            write_tick: AtomicU64::new(0),
        };
        (tracker, cfg, dir)
    }

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    #[test]
    fn tick_accumulates_today_and_total() {
        let (tracker, _cfg, _dir) = test_setup();
        let today = date(2026, 9, 6);
        tracker.tick("vscode", today);
        tracker.tick("vscode", today);
        tracker.tick("aseprite", today);

        let rows = tracker.stats_on(today);
        assert_eq!(rows.len(), 2);
        // 按总计降序
        assert_eq!(rows[0].app, "vscode");
        assert_eq!(rows[0].today_secs, 2);
        assert_eq!(rows[0].year_secs, 2);
        assert_eq!(rows[0].total_secs, 2);
        assert_eq!(rows[1].app, "aseprite");
        assert_eq!(rows[1].total_secs, 1);
    }

    #[test]
    fn year_secs_only_counts_same_year() {
        let (tracker, _cfg, _dir) = test_setup();
        tracker.tick("vscode", date(2025, 12, 31));
        tracker.tick("vscode", date(2026, 1, 1));
        tracker.tick("vscode", date(2026, 9, 6));

        let rows = tracker.stats_on(date(2026, 9, 6));
        assert_eq!(rows[0].total_secs, 3);
        assert_eq!(rows[0].year_secs, 2); // 2025 年的不算今年
        assert_eq!(rows[0].today_secs, 1);
    }

    #[test]
    fn persist_writes_current_json_and_reloads() {
        let (tracker, cfg, _dir) = test_setup();
        let today = date(2026, 9, 6);
        tracker.tick("vscode", today);
        tracker.tick("vscode", today);

        tracker.persist_on(today, &cfg).expect("persist");

        let text = fs::read_to_string(cfg.current_json_path()).unwrap();
        let file: UsageFile = serde_json::from_str(&text).unwrap();
        assert_eq!(file.days.len(), 1);
        assert_eq!(file.days.values().next().unwrap()["vscode"], 2);
        assert_eq!(file.totals["vscode"], 2);

        // 模拟重启:从磁盘恢复
        let reloaded = load_from_disk(&cfg);
        assert_eq!(reloaded.totals["vscode"], 2);
    }

    #[test]
    fn backup_rollover_happens_only_on_first_write_of_new_day() {
        let (tracker, cfg, _dir) = test_setup();
        let day1 = date(2026, 9, 5);
        let day2 = date(2026, 9, 6);

        // 第一天:写入两次,backup 不应产生
        tracker.tick("vscode", day1);
        tracker.persist_on(day1, &cfg).expect("persist day1");
        tracker.tick("vscode", day1);
        tracker.persist_on(day1, &cfg).expect("persist day1 again");
        assert!(!cfg.backup_json_path().exists());

        // 第二天首次写入:应把 day1 的 current 轮转为 backup
        tracker.tick("aseprite", day2);
        tracker.persist_on(day2, &cfg).expect("persist day2");
        assert!(cfg.backup_json_path().exists());

        let backup: UsageFile =
            serde_json::from_str(&fs::read_to_string(cfg.backup_json_path()).unwrap()).unwrap();
        assert_eq!(backup.totals["vscode"], 2); // day1 的快照(day1 共 2 次 tick)
        assert!(!backup.totals.contains_key("aseprite"));
    }

    #[test]
    fn corrupted_current_falls_back_to_backup() {
        let (tracker, cfg, _dir) = test_setup();
        let day1 = date(2026, 9, 5);
        let day2 = date(2026, 9, 6);
        tracker.tick("vscode", day1);
        tracker.persist_on(day1, &cfg).expect("persist day1");
        // 第二天写入,产生 backup
        tracker.persist_on(day2, &cfg).expect("persist day2");
        // 损坏 current(模拟写一半崩溃等)
        fs::write(cfg.current_json_path(), "{corrupted!!!").unwrap();

        let reloaded = load_from_disk(&cfg);
        assert_eq!(reloaded.totals["vscode"], 1);
    }
}
