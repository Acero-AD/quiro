use serde::{Deserialize, Serialize};
use specta::Type;

const MAX_MESSAGE_CHARS: u32 = 256;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct PingRequest {
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct PingReply {
    pub echo: String,
    pub version: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", content = "data", rename_all = "camelCase")]
pub enum PingError {
    Empty,
    TooLong { max: u32 },
}

#[tauri::command]
#[specta::specta]
pub fn ping(request: PingRequest) -> Result<PingReply, PingError> {
    if request.message.is_empty() {
        return Err(PingError::Empty);
    }
    if request.message.chars().count() > MAX_MESSAGE_CHARS as usize {
        return Err(PingError::TooLong {
            max: MAX_MESSAGE_CHARS,
        });
    }
    Ok(PingReply {
        echo: request.message,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

pub fn builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new().commands(tauri_specta::collect_commands![ping])
}

#[cfg(test)]
const BINDINGS_HEADER: &str = "// Regenerate with `cd src-tauri && UPDATE_BINDINGS=1 cargo test`.";

// Only the drift test exports: the app never writes bindings at startup.
#[cfg(test)]
fn export_bindings(path: &std::path::Path) -> Result<(), specta_typescript::Error> {
    builder().export(
        specta_typescript::Typescript::default().header(BINDINGS_HEADER),
        path,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    fn request(message: &str) -> PingRequest {
        PingRequest {
            message: message.to_string(),
        }
    }

    #[test]
    fn ping_echoes_the_message_with_the_crate_version() {
        let reply = ping(request("hello")).expect("ping should succeed");

        assert_eq!(
            reply,
            PingReply {
                echo: "hello".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
            }
        );
    }

    #[test]
    fn ping_rejects_an_empty_message() {
        assert_eq!(ping(request("")), Err(PingError::Empty));
    }

    #[test]
    fn ping_accepts_256_characters() {
        let message = "é".repeat(256);

        let reply = ping(request(&message)).expect("256 characters should be accepted");

        assert_eq!(reply.echo, message);
    }

    #[test]
    fn ping_rejects_257_characters() {
        assert_eq!(
            ping(request(&"a".repeat(257))),
            Err(PingError::TooLong { max: 256 })
        );
    }

    #[test]
    fn ping_reply_json_shape() {
        let reply = ping(request("hello")).expect("ping should succeed");

        assert_eq!(
            serde_json::to_string(&reply).unwrap(),
            format!(
                r#"{{"echo":"hello","version":"{}"}}"#,
                env!("CARGO_PKG_VERSION")
            )
        );
    }

    #[test]
    fn ping_error_json_shapes() {
        assert_eq!(
            serde_json::to_string(&PingError::Empty).unwrap(),
            r#"{"kind":"empty"}"#
        );
        assert_eq!(
            serde_json::to_string(&PingError::TooLong { max: 256 }).unwrap(),
            r#"{"kind":"tooLong","data":{"max":256}}"#
        );
    }

    #[test]
    fn bindings_are_up_to_date() {
        let checked_in = Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/../src/bindings.ts"));
        let fresh_path =
            std::env::temp_dir().join(format!("quiro-bindings-test-{}.ts", std::process::id()));

        export_bindings(&fresh_path).expect("export should succeed");
        let fresh = fs::read_to_string(&fresh_path).expect("exported bindings should be readable");
        let _ = fs::remove_file(&fresh_path);

        if std::env::var_os("UPDATE_BINDINGS").is_some_and(|value| value == "1") {
            fs::write(checked_in, &fresh).expect("src/bindings.ts should be writable");
            return;
        }

        let current = fs::read_to_string(checked_in).unwrap_or_default();
        let end_of_file = if fresh.ends_with('\n') { "" } else { "\n" };
        assert!(
            current == fresh,
            "src/bindings.ts is stale. Write exactly the text between the markers to src/bindings.ts,\n\
             or run `cd src-tauri && UPDATE_BINDINGS=1 cargo test` locally.\n\
             ----- BEGIN src/bindings.ts -----\n\
             {fresh}{end_of_file}\
             ----- END src/bindings.ts -----"
        );
    }
}
