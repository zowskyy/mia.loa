//! Frontier Mobile Runtime — native bindings for Lighthouse-generated apps.
//! Builds to libfrontier_app.so (Android) / libfrontier_app.a (iOS).

mod ai;
mod app;
mod network;
mod platform;
mod storage;
pub mod ui;

#[cfg(target_os = "android")]
mod jni_android;

use std::ffi::{CStr, c_char};

/// Entry point called by Android Activity / iOS AppDelegate.
#[no_mangle]
pub extern "C" fn frontier_app_main() -> i32 {
    platform::init();
    match app::run() {
        Ok(()) => 0,
        Err(e) => {
            eprintln!("frontier_app error: {e}");
            1
        }
    }
}

/// Route UI events from platform shells into the generated app.
#[no_mangle]
pub extern "C" fn frontier_on_event(event_type: *const c_char, event_data: *const c_char) {
    let event_type = unsafe { ptr_to_str(event_type) };
    let event_data = unsafe { ptr_to_str(event_data) };
    app::handle_event(&event_type, &event_data);
}

/// Runtime version string for platform shells.
#[no_mangle]
pub extern "C" fn frontier_runtime_version() -> *const c_char {
    concat!(env!("CARGO_PKG_VERSION"), "\0").as_ptr() as *const c_char
}

unsafe fn ptr_to_str(ptr: *const c_char) -> String {
    if ptr.is_null() {
        return String::new();
    }
    CStr::from_ptr(ptr).to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_runs_on_desktop() {
        assert_eq!(frontier_app_main(), 0);
    }
}
