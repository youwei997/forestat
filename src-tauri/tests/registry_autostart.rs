//! 真实注册表读写集成测试(自清理:测完恢复原状)。
use forestat_lib::config::{get_registry_autostart, set_registry_autostart};

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const VALUE_NAME: &str = "forestat";

fn read_raw_value() -> Option<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu.open_subkey(RUN_KEY).ok()?;
    key.get_value::<String, _>(VALUE_NAME).ok()
}

#[test]
#[cfg(windows)]
fn registry_autostart_roundtrip() {
    // 记录原状态,测完还原
    let original = read_raw_value();
    let originally_enabled = get_registry_autostart();

    // 开启:写注册表
    set_registry_autostart(true).expect("写入自启键失败");
    assert!(get_registry_autostart(), "开启后应读到 true");
    let raw = read_raw_value().expect("键值应存在");
    assert!(raw.ends_with("--background"), "键值应带 --background 参数,实际: {raw}");
    assert!(
        raw.to_lowercase().contains("forestat") || raw.to_lowercase().contains("registry_autostart"),
        "键值应指向 forestat 测试 exe,实际: {raw}"
    );

    // 关闭:删注册表
    set_registry_autostart(false).expect("删除自启键失败");
    assert!(!get_registry_autostart(), "关闭后应读到 false");
    assert!(read_raw_value().is_none(), "键值应已删除");

    // 还原测试前的状态
    if originally_enabled {
        if let Some(v) = original {
            use winreg::enums::{HKEY_CURRENT_USER, KEY_SET_VALUE};
            use winreg::RegKey;
            let hkcu = RegKey::predef(HKEY_CURRENT_USER);
            let key = hkcu
                .open_subkey_with_flags(RUN_KEY, KEY_SET_VALUE)
                .expect("还原时打开 Run 键失败");
            key.set_value(VALUE_NAME, &v).expect("还原键值失败");
        }
    }
}
