//! HTTP client — platform sockets via Frontier FFI when network feature is enabled.

pub fn get(url: &str) -> Result<String, String> {
  #[cfg(feature = "network")]
  {
    return network_impl::get(url);
  }
  #[cfg(not(feature = "network"))]
  {
    let _ = url;
    Err("network feature not enabled — rebuild with --features network".into())
  }
}

pub fn post(url: &str, body: &str) -> Result<String, String> {
  #[cfg(feature = "network")]
  {
    return network_impl::post(url, body);
  }
  #[cfg(not(feature = "network"))]
  {
    let _ = (url, body);
    Err("network feature not enabled — rebuild with --features network".into())
  }
}

#[cfg(feature = "network")]
mod network_impl {
  pub fn get(url: &str) -> Result<String, String> {
    ureq::get(url)
      .call()
      .map_err(|e| e.to_string())?
      .into_string()
      .map_err(|e| e.to_string())
  }

  pub fn post(url: &str, body: &str) -> Result<String, String> {
    ureq::post(url)
      .set("Content-Type", "application/json")
      .send_string(body)
      .map_err(|e| e.to_string())?
      .into_string()
      .map_err(|e| e.to_string())
  }
}
