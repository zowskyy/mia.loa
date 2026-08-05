use crate::ui::Screen;

pub fn init() {}

pub fn render_screen(screen: &Screen) {
    ui::render_screen(screen);
}

pub mod ui {
    use crate::ui::{Screen, Widget};

    pub fn render_screen(screen: &Screen) {
        println!("[desktop] {}", screen.title);
        for widget in &screen.widgets {
            match widget {
                Widget::Button { id, label, .. } => println!("  [Button {id}] {label}"),
                Widget::TextInput { id, placeholder } => println!("  [Input {id}] {placeholder}"),
                Widget::List { id, items } => println!("  [List {id}] {} items", items.len()),
                Widget::Text { content } => println!("  [Text] {content}"),
            }
        }
    }
}
