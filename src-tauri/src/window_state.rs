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

pub fn is_wayland(wayland_display: Option<&str>, gdk_backend: Option<&str>) -> bool {
    if !cfg!(target_os = "linux") {
        return false;
    }

    let has_wayland_display = wayland_display.is_some_and(|s| !s.is_empty());
    if !has_wayland_display {
        return false;
    }

    match gdk_backend {
        None | Some("") => true,
        Some(s) => {
            let first = s.split(',').next().unwrap_or("");
            first == "wayland" || first == "*"
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MonitorInfo {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

impl MonitorInfo {
    fn contains(&self, x: i32, y: i32) -> bool {
        x >= self.x
            && x < self.x + self.width as i32
            && y >= self.y
            && y < self.y + self.height as i32
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Placement {
    Center,
    At(i32, i32),
    Leave,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RestorePlan {
    pub width: f64,
    pub height: f64,
    pub placement: Placement,
    pub maximized: bool,
}

pub fn plan_restore(
    saved: Option<&WindowState>,
    monitors: &[MonitorInfo],
    can_position: bool,
) -> RestorePlan {
    let (raw_width, raw_height, saved_pos, maximized) = match saved {
        Some(s) => (s.width, s.height, s.x.zip(s.y), s.maximized),
        None => (DEFAULT_WIDTH, DEFAULT_HEIGHT, None, false),
    };

    let width = raw_width.max(MIN_WIDTH);
    let height = raw_height.max(MIN_HEIGHT);

    let pos_monitor = saved_pos.and_then(|(x, y)| monitors.iter().find(|m| m.contains(x, y)));
    let size_monitor = pos_monitor.or_else(|| monitors.first());

    let (width, height) = match size_monitor {
        Some(m) => {
            let max_width = m.width as f64 / m.scale_factor;
            let max_height = m.height as f64 / m.scale_factor;
            (width.min(max_width), height.min(max_height))
        }
        None => (width, height),
    };

    let placement = if !can_position {
        Placement::Leave
    } else {
        match (saved_pos, pos_monitor) {
            (Some((x, y)), Some(m)) => {
                let phys_width = (width * m.scale_factor).round() as i32;
                let phys_height = (height * m.scale_factor).round() as i32;
                let min_x = m.x;
                let min_y = m.y;
                let max_x = (m.x + m.width as i32 - phys_width).max(min_x);
                let max_y = (m.y + m.height as i32 - phys_height).max(min_y);
                Placement::At(x.clamp(min_x, max_x), y.clamp(min_y, max_y))
            }
            _ => Placement::Center,
        }
    };

    RestorePlan {
        width,
        height,
        placement,
        maximized,
    }
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

    #[test]
    fn is_wayland_requires_display() {
        assert!(!is_wayland(None, None));
        assert!(!is_wayland(Some(""), None));
    }

    // Wayland only exists on Linux, so elsewhere `is_wayland` is always false.
    const ON_LINUX: bool = cfg!(target_os = "linux");

    #[test]
    fn is_wayland_true_when_backend_unset() {
        assert_eq!(is_wayland(Some("wayland-0"), None), ON_LINUX);
    }

    #[test]
    fn is_wayland_true_for_wayland_backend() {
        assert_eq!(is_wayland(Some("wayland-0"), Some("wayland")), ON_LINUX);
    }

    #[test]
    fn is_wayland_false_for_x11_backend() {
        assert!(!is_wayland(Some("wayland-0"), Some("x11")));
    }

    #[test]
    fn is_wayland_true_when_wayland_first() {
        assert_eq!(
            is_wayland(Some("wayland-0"), Some("wayland,x11,*")),
            ON_LINUX
        );
    }

    #[test]
    fn is_wayland_false_when_x11_first() {
        assert!(!is_wayland(Some("wayland-0"), Some("x11,wayland")));
    }

    #[test]
    fn is_wayland_true_for_wildcard() {
        assert_eq!(is_wayland(Some("wayland-0"), Some("*")), ON_LINUX);
    }

    fn monitor(x: i32, y: i32, width: u32, height: u32, scale_factor: f64) -> MonitorInfo {
        MonitorInfo {
            x,
            y,
            width,
            height,
            scale_factor,
        }
    }

    #[test]
    fn plan_restore_first_run_with_can_position_centers() {
        let plan = plan_restore(None, &[], true);
        assert_eq!(plan.width, DEFAULT_WIDTH);
        assert_eq!(plan.height, DEFAULT_HEIGHT);
        assert_eq!(plan.placement, Placement::Center);
        assert!(!plan.maximized);
    }

    #[test]
    fn plan_restore_first_run_without_can_position_leaves() {
        let plan = plan_restore(None, &[], false);
        assert_eq!(plan.width, DEFAULT_WIDTH);
        assert_eq!(plan.height, DEFAULT_HEIGHT);
        assert_eq!(plan.placement, Placement::Leave);
    }

    #[test]
    fn plan_restore_raises_size_below_minimum() {
        let saved = WindowState {
            width: 100.0,
            height: 50.0,
            maximized: false,
            x: None,
            y: None,
        };
        let plan = plan_restore(Some(&saved), &[], true);
        assert_eq!(plan.width, MIN_WIDTH);
        assert_eq!(plan.height, MIN_HEIGHT);
    }

    #[test]
    fn plan_restore_clamps_size_to_work_area() {
        let saved = WindowState {
            width: 2500.0,
            height: 1600.0,
            maximized: false,
            x: Some(50),
            y: Some(50),
        };
        let monitors = [monitor(0, 0, 1920, 1040, 1.0)];
        let plan = plan_restore(Some(&saved), &monitors, true);
        assert_eq!(plan.width, 1920.0);
        assert_eq!(plan.height, 1040.0);
    }

    #[test]
    fn plan_restore_clamps_size_with_scale_factor() {
        let saved = WindowState {
            width: 3000.0,
            height: 2000.0,
            maximized: false,
            x: Some(100),
            y: Some(100),
        };
        let monitors = [monitor(0, 0, 3840, 2160, 2.0)];
        let plan = plan_restore(Some(&saved), &monitors, true);
        assert_eq!(plan.width, 1920.0);
        assert_eq!(plan.height, 1080.0);
    }

    #[test]
    fn plan_restore_centers_when_position_off_every_monitor() {
        let saved = WindowState {
            width: 1000.0,
            height: 700.0,
            maximized: false,
            x: Some(5000),
            y: Some(5000),
        };
        let monitors = [monitor(0, 0, 1920, 1080, 1.0)];
        let plan = plan_restore(Some(&saved), &monitors, true);
        assert_eq!(plan.placement, Placement::Center);
    }

    #[test]
    fn plan_restore_shifts_partly_off_screen_position() {
        let saved = WindowState {
            width: 1000.0,
            height: 700.0,
            maximized: false,
            x: Some(1900),
            y: Some(1000),
        };
        let monitors = [monitor(0, 0, 1920, 1080, 1.0)];
        let plan = plan_restore(Some(&saved), &monitors, true);
        match plan.placement {
            Placement::At(x, y) => {
                assert!(x + plan.width as i32 <= 1920);
                assert!(y + plan.height as i32 <= 1080);
                assert!(x >= 0);
                assert!(y >= 0);
            }
            other => panic!("expected At placement, got {:?}", other),
        }
    }

    #[test]
    fn plan_restore_can_position_false_never_positions() {
        let saved = WindowState {
            width: 1000.0,
            height: 700.0,
            maximized: false,
            x: Some(100),
            y: Some(100),
        };
        let monitors = [monitor(0, 0, 1920, 1080, 1.0)];
        let plan = plan_restore(Some(&saved), &monitors, false);
        assert_eq!(plan.placement, Placement::Leave);

        let plan_no_pos = plan_restore(None, &monitors, false);
        assert_eq!(plan_no_pos.placement, Placement::Leave);
    }

    #[test]
    fn plan_restore_carries_over_maximized_flag() {
        let saved = WindowState {
            width: 1000.0,
            height: 700.0,
            maximized: true,
            x: None,
            y: None,
        };
        let plan = plan_restore(Some(&saved), &[], true);
        assert!(plan.maximized);

        let saved_not_max = WindowState {
            maximized: false,
            ..saved
        };
        let plan2 = plan_restore(Some(&saved_not_max), &[], true);
        assert!(!plan2.maximized);
    }

    #[test]
    fn plan_restore_empty_monitor_list_skips_clamping() {
        let saved = WindowState {
            width: 5000.0,
            height: 4000.0,
            maximized: false,
            x: Some(10),
            y: Some(10),
        };
        let plan = plan_restore(Some(&saved), &[], true);
        assert_eq!(plan.width, 5000.0);
        assert_eq!(plan.height, 4000.0);
        assert_eq!(plan.placement, Placement::Center);
    }
}
