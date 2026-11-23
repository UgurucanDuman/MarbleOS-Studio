use flate2::{write::GzEncoder, Compression};
use sha2::{Digest, Sha256};
use std::{env, fs, io::Write, path::PathBuf};

fn hex_lower(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let payload_src = manifest_dir.join("../target/release/marbleos-studio.exe");
    let license_src = manifest_dir.join("../installer/LICENSE.txt");
    println!("cargo:rerun-if-changed={}", payload_src.display());
    println!("cargo:rerun-if-changed={}", license_src.display());
    println!("cargo:rerun-if-changed=ui/index.html");
    println!("cargo:rerun-if-changed=ui/styles.css");
    println!("cargo:rerun-if-changed=ui/wizard.js");

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR"));
    let raw_bytes = fs::read(&payload_src).unwrap_or_else(|_| {
        panic!(
            "Önce çekirdek uygulama derlenmelidir: {}",
            payload_src.display()
        )
    });
    let sha_hex = hex_lower(&Sha256::digest(&raw_bytes));

    let mut encoder = GzEncoder::new(Vec::new(), Compression::best());
    encoder.write_all(&raw_bytes).expect("gzip write");
    let compressed = encoder.finish().expect("gzip finish");
    fs::write(out_dir.join("payload.gz"), &compressed).expect("write payload.gz");

    let meta_code = format!(
        "pub const PAYLOAD_GZ: &[u8] = include_bytes!(concat!(env!(\"OUT_DIR\"), \"/payload.gz\"));\n\
         pub const PAYLOAD_RAW_BYTES: u64 = {}u64;\n\
         pub const PAYLOAD_SHA256: &str = \"{}\";\n",
        raw_bytes.len(),
        sha_hex
    );
    fs::write(out_dir.join("payload_meta.rs"), meta_code).expect("write payload_meta.rs");

    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "installer_init",
                "installer_pick_dir",
                "installer_check_dir",
                "installer_run_install",
                "installer_run_uninstall",
                "installer_launch_app",
            ]),
        ),
    )
    .expect("Tauri installer manifest");
}
