use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Runtime, Url};

const DEV_ORIGINS: &[(&str, &str, Option<u16>)] = &[("http", "localhost", Some(1420))];

const RELEASE_ORIGINS: &[(&str, &str, Option<u16>)] = &[
    ("tauri", "localhost", None),
    ("http", "tauri.localhost", Some(80)),
];

/// Compares scheme, host and port rather than `Url::origin()`, because a
/// custom scheme such as `tauri:` has an opaque origin.
pub fn is_app_url(url: &Url, dev: bool) -> bool {
    let origins = if dev { DEV_ORIGINS } else { RELEASE_ORIGINS };
    origins.iter().any(|&(scheme, host, port)| {
        url.scheme() == scheme
            && url.host_str() == Some(host)
            && url.port_or_known_default() == port
    })
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("navigation-guard")
        .on_navigation(|_, url| is_app_url(url, tauri::is_dev()))
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn check(url: &str, dev: bool) -> bool {
        is_app_url(&Url::parse(url).unwrap(), dev)
    }

    #[test]
    fn app_urls_are_allowed_only_in_their_mode() {
        let cases = [
            ("http://localhost:1420/", true, false),
            ("http://localhost:1420/some/path?q=1", true, false),
            ("tauri://localhost/", false, true),
            ("tauri://localhost/index.html", false, true),
            ("http://tauri.localhost/", false, true),
        ];
        for (url, dev_allowed, release_allowed) in cases {
            assert_eq!(check(url, true), dev_allowed, "{url} with dev true");
            assert_eq!(check(url, false), release_allowed, "{url} with dev false");
        }
    }

    #[test]
    fn foreign_urls_are_refused_in_both_modes() {
        let cases = [
            "https://example.com/",
            "http://localhost:1421/",
            "https://tauri.localhost/",
            "file:///home/user/notes.md",
            "data:text/html,<p>hi</p>",
            "http://localhost/",
            "tauri://example.com/",
        ];
        for url in cases {
            assert!(!check(url, true), "{url} with dev true");
            assert!(!check(url, false), "{url} with dev false");
        }
    }
}
