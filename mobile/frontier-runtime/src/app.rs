//! Default Lighthouse app — replaced at compile time when Frontier compiler links user code.

use crate::storage;
use crate::ui::Screen;

pub fn run() -> Result<(), String> {
    storage::init("app.db")?;

    let mut screen = Screen::new("Lighthouse Native App");
    screen.add_text("Compiled Frontier runtime — no WebView, no JavaScript.");
    screen.add_button("action_primary", "Get Started", "button_click:primary");
    screen.add_text_input("user_input", "Describe your idea...");
    screen.add_button("action_save", "Save", "button_click:save");
    screen.render();
    Ok(())
}

pub fn handle_event(event_type: &str, event_data: &str) {
    match event_type {
        "button_click" => match event_data {
            "primary" => {
                let _ = storage::set("last_action", "primary");
            }
            "save" => {
                let _ = storage::set("last_action", "save");
            }
            _ => {}
        },
        _ => {}
    }
}
