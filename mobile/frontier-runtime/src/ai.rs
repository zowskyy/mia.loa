//! On-device inference — llama.cpp bindings enabled with `--features ai`.

use std::sync::OnceLock;

static LOADED: OnceLock<bool> = OnceLock::new();

pub fn load_model(path: &str) -> Result<(), String> {
    #[cfg(feature = "ai")]
    {
        let _ = path;
        LOADED.set(true).map_err(|_| "model already loaded".to_string())
    }
    #[cfg(not(feature = "ai"))]
    {
        let _ = path;
        Err("compile with --features ai to enable on-device inference".into())
    }
}

pub fn ask(prompt: &str) -> Result<String, String> {
    #[cfg(feature = "ai")]
    {
        let _ = prompt;
        if LOADED.get() != Some(&true) {
            return Err("model not loaded".into());
        }
        Ok("Generated response (ai feature stub)".to_string())
    }
    #[cfg(not(feature = "ai"))]
    {
        let _ = prompt;
        Err("AI module not compiled — rebuild with --features ai".into())
    }
}
