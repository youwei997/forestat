pub mod config;
mod first_run;
pub mod tracker;

use std::sync::{Arc, Mutex};

use tauri::{Manager, WebviewWindowBuilder, WindowEvent};
use tracker::Tracker;

struct AppState {
    tracker: Arc<Tracker>,
    config: Mutex<config::AppConfig>,
}

#[tauri::command]
fn get_stats(state: tauri::State<AppState>) -> Vec<tracker::StatRow> {
    state.tracker.stats()
}

#[tauri::command]
fn get_config(state: tauri::State<AppState>) -> config::AppConfig {
    state.config.lock().unwrap().clone()
}

/// 设置 JSON 输出目录(None = 恢复默认安装目录)。
#[tauri::command]
fn set_json_dir(state: tauri::State<AppState>, dir: Option<String>) -> Result<(), String> {
    {
        let mut cfg = state.config.lock().unwrap();
        cfg.json_dir = dir.filter(|d| !d.trim().is_empty());
        cfg.save().map_err(|e| e.to_string())?;
    }
    // 立刻按新路径写一次,便于用户确认
    let cfg = state.config.lock().unwrap().clone();
    state.tracker.persist(&cfg).map_err(|e| e.to_string())
}

/// 开关后台轻量模式(注册表自启,带 --background 参数)。
#[tauri::command]
fn set_background_mode(state: tauri::State<AppState>, enable: bool) -> Result<(), String> {
    config::set_registry_autostart(enable)?;
    let mut cfg = state.config.lock().unwrap();
    cfg.background_mode = enable;
    cfg.save().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_background_mode(_state: tauri::State<AppState>) -> bool {
    // 以注册表为准(UI 可信回显)
    config::get_registry_autostart()
}

#[tauri::command]
fn write_now(state: tauri::State<AppState>) -> Result<(), String> {
    let cfg = state.config.lock().unwrap().clone();
    state.tracker.persist(&cfg).map_err(|e| e.to_string())
}

/// 完全退出(终止后台计时)。
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// 把一次性提示(如首启结果)发给前端展示;窗口未就绪时静默丢弃。
fn log_to_ui(app: tauri::AppHandle, msg: &str) {
    use tauri::Emitter;
    let _ = app.emit("first-run-msg", msg.to_string());
}

/// 从托盘/前端请求显示主窗口(后台模式下首次调用时动态创建窗口)。
fn show_main_window(app: &tauri::AppHandle, background_start: bool) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    let builder = WebviewWindowBuilder::new(
        app,
        "main",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("forestat")
    .inner_size(900.0, 640.0)
    .center();
    let win = if background_start {
        // 后台模式启动的进程第一次被唤起时,先隐藏创建再显示,避免闪烁
        builder.visible(false).build().expect("Failed to create main window")
    } else {
        builder.build().expect("Failed to create main window")
    };
    let _ = win.show();
    let _ = win.set_focus();
}

pub fn run() {
    let background = std::env::args().any(|a| a == "--background");

    let cfg = config::AppConfig::load();
    let tracker = Arc::new(Tracker::new(&cfg));
    tracker.spawn(cfg.clone());

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 第二次启动:若后台模式实例已存在,唤起其主窗口
            show_main_window(app, false);
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            tracker,
            config: Mutex::new(cfg),
        })
        .setup(move |app| {
            if let Some(msg) = first_run::handle_first_run() {
                log_to_ui(app.handle().clone(), &msg);
            }
            if !background {
                show_main_window(&app.handle(), false);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // 关闭窗口 = 只隐藏(不退出),后台计时继续
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = &event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_stats,
            get_config,
            set_json_dir,
            set_background_mode,
            get_background_mode,
            write_now,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
