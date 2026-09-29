#![allow(dead_code)]

use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};

pub const DEFAULT_WIDTH: f64 = 1000.0;
pub const DEFAULT_HEIGHT: f64 = 700.0;
pub const MIN_WIDTH: f64 = 480.0;
pub const MIN_HEIGHT: f64 = 320.0;

const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WindowState {
    pub width: f64,
    pub height: f64,
    pub maximized: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<i32>,
}

impl Default for WindowState {
    fn default() -> Self {
        WindowState {
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            maximized: false,
            x: None,
            y: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StateFile {
    schema: u32,
    #[serde(flatten)]
    state: WindowState,
}

pub fn load(path: &Path) -> Option<WindowState> {
    let contents = fs::read_to_string(path).ok()?;
    let file: StateFile = serde_json::from_str(&contents).ok()?;
    if file.schema != SCHEMA_VERSION {
        return None;
    }
    Some(file.state)
}

pub fn save(path: &Path, state: &WindowState) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let file = StateFile {
        schema: SCHEMA_VERSION,
        state: state.clone(),
    };
    let json = serde_json::to_string_pretty(&file).map_err(io::Error::other)?;

    let file_name = path
        .file_name()
        .unwrap_or_else(|| OsStr::new("window-state.json"));
    let mut tmp_name = file_name.to_os_string();
    tmp_name.push(".tmp");
    let tmp_path = path.with_file_name(tmp_name);

    fs::write(&tmp_path, &json)?;
    fs::rename(&tmp_path, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    fn temp_path(name: &str) -> PathBuf {
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        std::env::temp_dir()
            .join(format!(
                "quiro-window-state-test-{}-{}-{}",
                std::process::id(),
                n,
                name
            ))
            .join("window-state.json")
    }

    #[test]
    fn round_trip_save_then_load() {
        let path = temp_path("round-trip");
        let state = WindowState {
            width: 1200.0,
            height: 800.0,
            maximized: true,
            x: Some(120),
            y: Some(80),
        };

        save(&path, &state).expect("save should succeed");
        let loaded = load(&path).expect("load should return the saved state");

        assert_eq!(loaded, state);
    }

    #[test]
    fn round_trip_without_position_omits_x_y() {
        let path = temp_path("no-position");
        let state = WindowState {
            width: 1000.0,
            height: 700.0,
            maximized: false,
            x: None,
            y: None,
        };

        save(&path, &state).expect("save should succeed");

        let contents = fs::read_to_string(&path).expect("file should exist");
        assert!(!contents.contains("\"x\""));
        assert!(!contents.contains("\"y\""));
        assert!(contents.contains("\"schema\": 1"));

        let loaded = load(&path).expect("load should return the saved state");
        assert_eq!(loaded, state);
    }

    #[test]
    fn missing_file_returns_none() {
        let path = temp_path("missing");
        assert!(load(&path).is_none());
    }

    #[test]
    fn malformed_json_returns_none() {
        let path = temp_path("malformed");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "not json at all").unwrap();

        assert!(load(&path).is_none());
    }

    #[test]
    fn unknown_schema_returns_none() {
        let path = temp_path("unknown-schema");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(
            &path,
            r#"{"schema": 999, "width": 1000.0, "height": 700.0, "maximized": false}"#,
        )
        .unwrap();

        assert!(load(&path).is_none());
    }
}
