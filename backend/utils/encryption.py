"""AES-256 encryption utility for sensitive simulation settings."""

from cryptography.fernet import Fernet, InvalidToken

from backend.config import settings


def _get_fernet() -> Fernet:
    """Get a Fernet instance using the configured encryption key."""
    key = settings.settings_encryption_key
    if not key:
        msg = "SETTINGS_ENCRYPTION_KEY is not configured."
        raise ValueError(msg)
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string and return the ciphertext as a string."""
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a ciphertext string and return the plaintext."""
    f = _get_fernet()
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except InvalidToken as e:
        msg = "Failed to decrypt value — invalid key or corrupted data."
        raise ValueError(msg) from e


def mask(value: str) -> str:
    """Mask a sensitive value, showing only the last 4 characters."""
    if len(value) <= 4:
        return "***"
    return f"***...{value[-4:]}"
