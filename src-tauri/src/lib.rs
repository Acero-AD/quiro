mod ipc;
mod navigation_guard;
mod window_state;

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{Manager, WindowEvent};
use window_state::{MonitorInfo, Placement};

struct WindowStateTracker {
    path: PathBuf,
    can_position: bool,
    normal_width: f64,
    normal_height: f64,
    normal_position: Option<(i32, i32)>,
}

fn monitor_work_area(monitor: &tauri::Monitor) -> MonitorInfo {
    let work_area = monitor.work_area();
    MonitorInfo {
        x: work_area.position.x,
        y: work_area.position.y,
        width: work_area.size.width,
        height: work_area.size.height,
        scale_factor: monitor.scale_factor(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(navigation_guard::init())
        .invoke_handler(ipc::builder().invoke_handler())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window is declared in tauri.conf.json");

            let can_position = !window_state::is_wayland(
                std::env::var("WAYLAND_DISPLAY").ok().as_deref(),
                std::env::var("GDK_BACKEND").ok().as_deref(),
            );

            let state_path = app
                .path()
                .app_local_data_dir()
                .map(|dir| dir.join("window-state.json"))
                .unwrap_or_else(|_| PathBuf::from("window-state.json"));

            let saved = window_state::load(&state_path);

            let monitors: Vec<MonitorInfo> = window
                .available_monitors()
                .map(|monitors| monitors.iter().map(monitor_work_area).collect())
                .unwrap_or_default();

            let plan = window_state::plan_restore(saved.as_ref(), &monitors, can_position);

            let _ = window.set_size(tauri::LogicalSize::new(plan.width, plan.height));

            let normal_position = match plan.placement {
                Placement::Center => {
                    let _ = window.center();
                    None
                }
                Placement::At(x, y) => {
                    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                    Some((x, y))
                }
                Placement::Leave => None,
            };

            let _ = window.show();

            if plan.maximized {
                let _ = window.maximize();
            }

            app.manage(Mutex::new(WindowStateTracker {
                path: state_path,
                can_position,
                normal_width: plan.width,
                normal_height: plan.height,
                normal_position,
            }));

            let tracked_window = window.clone();
            window.on_window_event(move |event| {
                let tracker = tracked_window.state::<Mutex<WindowStateTracker>>();

                match event {
                    WindowEvent::Resized(size) => {
                        let maximized = tracked_window.is_maximized().unwrap_or(false);
                        let minimized = tracked_window.is_minimized().unwrap_or(false);
                        let mut tracker = tracker.lock().unwrap();
                        if window_state::tracks_normal_geometry(
                            maximized,
                            minimized,
                            tracker.can_position,
                        ) {
                            let scale = tracked_window.scale_factor().unwrap_or(1.0);
                            let logical = size.to_logical::<f64>(scale);
                            tracker.normal_width = logical.width;
                            tracker.normal_height = logical.height;
                        }
                    }
                    WindowEvent::Moved(position) => {
                        let maximized = tracked_window.is_maximized().unwrap_or(false);
                        let minimized = tracked_window.is_minimized().unwrap_or(false);
                        let mut tracker = tracker.lock().unwrap();
                        if window_state::tracks_normal_geometry(
                            maximized,
                            minimized,
                            tracker.can_position,
                        ) {
                            tracker.normal_position = Some((position.x, position.y));
                        }
                    }
                    WindowEvent::CloseRequested { .. } => {
                        let tracker = tracker.lock().unwrap();
                        let maximized = tracked_window.is_maximized().unwrap_or(false);
                        let new_state = window_state::closing_state(
                            tracker.normal_width,
                            tracker.normal_height,
                            tracker.normal_position,
                            maximized,
                            tracker.can_position,
                        );
                        let _ = window_state::save(&tracker.path, &new_state);
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
