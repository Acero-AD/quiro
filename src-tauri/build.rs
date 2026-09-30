fn main() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();

    let mut attributes = tauri_build::Attributes::new();

    // tauri-build embeds the app manifest only in the app binary, so on Windows
    // the test binaries fail to start with STATUS_ENTRYPOINT_NOT_FOUND. Have the
    // linker embed it in every binary instead.
    if target_os == "windows" && target_env == "msvc" {
        let manifest = std::env::current_dir()
            .expect("build script has a working directory")
            .join("windows-app-manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());

        attributes = attributes
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
    }

    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}
