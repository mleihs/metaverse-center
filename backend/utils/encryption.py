"""AES-256 encryption utility for sensitive settings and personal API keys.

ROTATION. One Fernet key encrypts both ``simulation_settings`` and the personal
API keys in ``user_api_keys``, and until migration 333 nothing recorded WHICH
key had written a given ciphertext. That is what made rotation impossible in
practice: changing the key meant re-encrypting everything at once, in one
outage, or never — and "never" is what happens.

The shape here is the standard one. ``SETTINGS_ENCRYPTION_KEYS`` is a key
HISTORY, oldest first. New values are encrypted with the newest entry;
``MultiFernet`` tries every entry when decrypting, so ciphertext written by an
older key keeps opening. :func:`current_key_version` names the entry that
encrypted a value, which is stored per row — so after appending a key you can
list exactly the rows still on an older one and re-encrypt them at leisure,
rather than all at once.

With a single key configured (the state today) this is byte-for-byte the old
behaviour: one key, version 1.
"""

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from backend.config import settings


def _configured_keys() -> list[str]:
    """The key history, oldest first. Falls back to the single-key setting."""
    raw = settings.settings_encryption_keys or settings.settings_encryption_key
    keys = [part.strip() for part in raw.split(",") if part.strip()]
    if not keys:
        msg = "SETTINGS_ENCRYPTION_KEY is not configured."
        raise ValueError(msg)
    return keys


@lru_cache(maxsize=1)
def _fernets(cache_key: str) -> tuple[Fernet, MultiFernet]:
    """(encrypter, decrypter) for one key configuration.

    Cached on the joined key material rather than on nothing, so a test that
    swaps the configured key does not keep talking to the previous one — the
    bug an unconditional module-level singleton would introduce here.
    """
    keys = [k.encode() for k in cache_key.split(",")]
    fernets = [Fernet(k) for k in keys]
    # Newest first: MultiFernet tries them in order, and the newest is the one
    # most ciphertext was written with.
    return fernets[-1], MultiFernet(list(reversed(fernets)))


def current_key_version() -> int:
    """1-based index of the key that :func:`encrypt` uses right now.

    Store it next to the ciphertext. It is the only way to answer "what is
    still on the old key" without trying to decrypt everything.
    """
    return len(_configured_keys())


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string and return the ciphertext as a string."""
    encrypter, _ = _fernets(",".join(_configured_keys()))
    return encrypter.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a ciphertext string, trying every configured key."""
    _, decrypter = _fernets(",".join(_configured_keys()))
    try:
        return decrypter.decrypt(ciphertext.encode()).decode()
    except InvalidToken as e:
        msg = "Failed to decrypt value — invalid key or corrupted data."
        raise ValueError(msg) from e


def mask(value: str) -> str:
    """Mask a sensitive value, showing only the last 4 characters."""
    if len(value) <= 4:
        return "***"
    return f"***...{value[-4:]}"
