use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use url::Url;

const MAX_DRAWING_BYTES: u64 = 512 * 1024 * 1024;
const MAX_EXPORT_BYTES: usize = 80 * 1024 * 1024;

pub fn drawing_paths_from_args(args: &[String], cwd: &str) -> Vec<PathBuf> {
    let cwd = PathBuf::from(cwd);
    let mut paths = Vec::new();
    for arg in args.iter().skip(1) {
        if arg.starts_with('-') {
            continue;
        }
        let path = if let Ok(url) = Url::parse(arg) {
            if url.scheme() != "file" {
                continue;
            }
            match url.to_file_path() {
                Ok(path) => path,
                Err(_) => continue,
            }
        } else {
            let path = PathBuf::from(arg);
            if path.is_absolute() {
                path
            } else {
                cwd.join(path)
            }
        };
        if is_drawing(&path) {
            paths.push(path);
        }
    }
    paths
}

pub fn validate_drawing(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    if !is_drawing(&path) {
        return Err("只接受 .dwg 或 .dxf 文件".to_string());
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("无法读取文件: {error}"))?;
    if !canonical.is_file() {
        return Err("路径不是文件".to_string());
    }
    let length = std::fs::metadata(&canonical)
        .map_err(|error| error.to_string())?
        .len();
    if length > MAX_DRAWING_BYTES {
        return Err("文件超过 512 MB".to_string());
    }
    Ok(canonical)
}

pub fn read_drawing_base64(path: &str) -> Result<String, String> {
    let path = validate_drawing(path)?;
    let bytes = std::fs::read(&path).map_err(|error| format!("读取失败: {error}"))?;
    Ok(STANDARD.encode(bytes))
}

pub fn write_export_base64(path: &str, data_base64: &str) -> Result<(), String> {
    let path = PathBuf::from(path);
    let extension = extension_of(&path);
    if extension != "png" && extension != "pdf" {
        return Err("只能保存 PNG 或 PDF".to_string());
    }
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let parent = parent
        .canonicalize()
        .map_err(|error| format!("保存目录不可用: {error}"))?;
    let name = path.file_name().ok_or_else(|| "缺少文件名".to_string())?;
    let destination = parent.join(name);
    if !is_export(&destination) {
        return Err("只能保存 PNG 或 PDF".to_string());
    }
    let bytes = STANDARD
        .decode(data_base64.trim())
        .map_err(|error| format!("导出数据无效: {error}"))?;
    if bytes.len() > MAX_EXPORT_BYTES {
        return Err("导出文件超过 80 MB".to_string());
    }
    std::fs::write(&destination, bytes).map_err(|error| format!("写入失败: {error}"))
}

fn extension_of(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn is_drawing(path: &Path) -> bool {
    matches!(extension_of(path).as_str(), "dwg" | "dxf")
}

fn is_export(path: &Path) -> bool {
    matches!(extension_of(path).as_str(), "png" | "pdf")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_drawing_arguments_and_skips_flags() {
        let args = vec![
            "xinyao-cad-viewer".to_string(),
            "--debug".to_string(),
            "plan.dwg".to_string(),
            "notes.txt".to_string(),
            "file:///tmp/room.dxf".to_string(),
        ];
        let paths = drawing_paths_from_args(&args, "/drawings");
        assert_eq!(
            paths,
            vec![
                PathBuf::from("/drawings/plan.dwg"),
                PathBuf::from("/tmp/room.dxf"),
            ]
        );
    }

    #[test]
    fn rejects_a_non_drawing_read() {
        let error = validate_drawing("/etc/passwd").unwrap_err();
        assert!(error.contains(".dwg"));
    }
}
