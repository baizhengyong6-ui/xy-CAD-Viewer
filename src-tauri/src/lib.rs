mod files;

use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

struct PendingOpens(Mutex<Vec<String>>);

#[derive(Serialize)]
struct AppInfo {
    name: &'static str,
    version: &'static str,
    license: &'static str,
    notice: &'static str,
}

fn enqueue_opens(app: &AppHandle, paths: Vec<PathBuf>) {
    let Some(state) = app.try_state::<PendingOpens>() else {
        return;
    };
    let mut queued = state.0.lock().expect("pending opens");
    let mut added = false;
    for path in paths {
        let text = path.display().to_string();
        if queued.iter().any(|existing| existing == &text) {
            continue;
        }
        queued.push(text);
        added = true;
    }
    drop(queued);
    if added {
        let _ = app.emit("open-drawing", ());
    }
}

#[tauri::command]
fn read_drawing(path: String) -> Result<String, String> {
    files::read_drawing_base64(&path)
}

#[tauri::command]
fn write_export(path: String, data_base64: String) -> Result<(), String> {
    files::write_export_base64(&path, &data_base64)
}

#[tauri::command]
fn take_pending_opens(state: State<PendingOpens>) -> Vec<String> {
    let mut queued = state.0.lock().expect("pending opens");
    std::mem::take(&mut *queued)
}

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: "鑫垚CAD看图",
        version: env!("CARGO_PKG_VERSION"),
        license: "GPL-3.0-only",
        notice: "本程序按 GNU GPL-3.0-only 授权。DWG 解析使用 GNU LibreDWG（GPL-3.0）编译成的 WebAssembly，并在独立 Web Worker 中运行。查看器核心为 MIT，中文回退字体 Noto Sans SC 为 SIL OFL。",
    }
}

#[tauri::command]
fn note_runtime(message: String) {
    println!("[xinyao] {message}");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            enqueue_opens(app, files::drawing_paths_from_args(&argv, &cwd));
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .manage(PendingOpens(Mutex::new(Vec::new())))
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            let cwd = std::env::current_dir()
                .map(|path| path.display().to_string())
                .unwrap_or_else(|_| ".".to_string());
            enqueue_opens(app.handle(), files::drawing_paths_from_args(&args, &cwd));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_drawing,
            write_export,
            take_pending_opens,
            app_info,
            note_runtime
        ])
        .build(tauri::generate_context!())
        .expect("failed to build 鑫垚CAD看图")
        .run(|app, event| {
            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            if let tauri::RunEvent::Opened { urls } = event {
                let paths = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter(|path| {
                        let args = vec![String::new(), path.display().to_string()];
                        !files::drawing_paths_from_args(&args, ".").is_empty()
                    })
                    .collect();
                enqueue_opens(app, paths);
            }
            #[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
            let _ = (app, event);
        });
}
