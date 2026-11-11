use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

struct SidecarProcess(Mutex<Option<std::process::Child>>);

impl Drop for SidecarProcess {
    fn drop(&mut self) {
        if let Some(ref mut child) = *self._inner().lock().unwrap() {
            let _ = child.kill();
        }
    }
}

impl SidecarProcess {
    fn _inner(&self) -> &Mutex<Option<std::process::Child>> {
        &self.0
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Start Go backend as a regular child process (not Tauri sidecar)
            // to avoid pipe/signal issues with Tauri's sidecar mechanism
            let exe_dir = std::env::current_exe()
                .expect("Failed to get exe path")
                .parent()
                .expect("Failed to get exe dir")
                .to_path_buf();

            let backend_path = exe_dir.join("shellcat-backend");

            let child = Command::new(&backend_path)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .expect("Failed to start backend");

            app.manage(SidecarProcess(Mutex::new(Some(child))));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
