//! JNI bridge for Android Kotlin shell (org.lighthouse.frontier.MainActivity).

use jni::objects::JClass;
use jni::sys::{jint, jstring};
use jni::JNIEnv;

#[no_mangle]
pub extern "system" fn Java_org_lighthouse_frontier_MainActivity_frontierAppMain(
    _env: JNIEnv,
    _class: JClass,
) -> jint {
    crate::frontier_app_main()
}

#[no_mangle]
pub extern "system" fn Java_org_lighthouse_frontier_MainActivity_frontierRuntimeVersion(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let version = env!("CARGO_PKG_VERSION");
    env.new_string(version)
        .map(|s| s.into_raw())
        .unwrap_or(std::ptr::null_mut())
}
