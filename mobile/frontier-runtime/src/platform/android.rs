use crate::ui::Screen;

pub fn init() {}

pub fn render_screen(screen: &Screen) {
    ui::render_screen(screen);
}

pub mod ui {
    use crate::ui::Screen;

    pub fn render_screen(screen: &Screen) {
        eprintln!(
            "[android] render '{}' ({} widgets)",
            screen.title,
            screen.widgets.len()
        );
    }
}
