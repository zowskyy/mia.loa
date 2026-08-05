use crate::ui::Screen;

#[cfg(target_os = "android")]
pub mod android;
#[cfg(target_os = "ios")]
pub mod ios;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub mod desktop;

pub fn init() {
    #[cfg(target_os = "android")]
    android::init();
    #[cfg(target_os = "ios")]
    ios::init();
}

pub fn render_screen(screen: &Screen) {
    #[cfg(target_os = "android")]
    android::render_screen(screen);
    #[cfg(target_os = "ios")]
    ios::render_screen(screen);
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    desktop::render_screen(screen);
}
