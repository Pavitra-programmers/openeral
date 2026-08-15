use fuser::Errno;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("filesystem is still initializing")]
    Initializing,
    #[error("writer lease is fenced")]
    Fenced,
    #[error("not found")]
    NotFound,
    #[error("already exists")]
    Exists,
    #[error("not a directory")]
    NotDirectory,
    #[error("is a directory")]
    IsDirectory,
    #[error("directory not empty")]
    NotEmpty,
    #[error("invalid filesystem request: {0}")]
    Invalid(String),
    #[error("operation is not supported")]
    Unsupported,
    #[error("database error: {0}")]
    Database(#[from] tokio_postgres::Error),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("internal error: {0}")]
    Internal(String),
}

impl Error {
    #[must_use]
    pub fn errno(&self) -> Errno {
        match self {
            Self::NotFound => Errno::ENOENT,
            Self::Exists => Errno::EEXIST,
            Self::NotDirectory => Errno::ENOTDIR,
            Self::IsDirectory => Errno::EISDIR,
            Self::NotEmpty => Errno::ENOTEMPTY,
            Self::Invalid(_) => Errno::EINVAL,
            Self::Unsupported => Errno::ENOTSUP,
            Self::Initializing
            | Self::Fenced
            | Self::Database(_)
            | Self::Io(_)
            | Self::Json(_)
            | Self::Internal(_) => Errno::EIO,
        }
    }
}

pub type Result<T> = std::result::Result<T, Error>;
