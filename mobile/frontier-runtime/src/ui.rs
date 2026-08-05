//! Native UI model — rendered by platform-specific backends.

#[derive(Debug, Clone)]
pub struct Screen {
    pub title: String,
    pub widgets: Vec<Widget>,
}

#[derive(Debug, Clone)]
pub enum Widget {
    Button {
        id: String,
        label: String,
        action: String,
    },
    TextInput {
        id: String,
        placeholder: String,
    },
    List {
        id: String,
        items: Vec<String>,
    },
    Text {
        content: String,
    },
}

impl Screen {
    pub fn new(title: &str) -> Self {
        Self {
            title: title.to_string(),
            widgets: Vec::new(),
        }
    }

    pub fn add_button(&mut self, id: &str, label: &str, action: &str) {
        self.widgets.push(Widget::Button {
            id: id.to_string(),
            label: label.to_string(),
            action: action.to_string(),
        });
    }

    pub fn add_text_input(&mut self, id: &str, placeholder: &str) {
        self.widgets.push(Widget::TextInput {
            id: id.to_string(),
            placeholder: placeholder.to_string(),
        });
    }

    pub fn add_list(&mut self, id: &str, items: Vec<String>) {
        self.widgets.push(Widget::List {
            id: id.to_string(),
            items,
        });
    }

    pub fn add_text(&mut self, content: &str) {
        self.widgets.push(Widget::Text {
            content: content.to_string(),
        });
    }

    pub fn render(&self) {
        crate::platform::render_screen(self);
    }
}
