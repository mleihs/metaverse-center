"""The key history must let old ciphertext keep opening.

Rotation exists as a column (``user_api_keys.key_version``, migration 333) and
as a key list (``SETTINGS_ENCRYPTION_KEYS``). Neither is worth anything unless
the pair actually behaves: a value written under key 1 must still decrypt after
key 2 is appended, and new values must be written under key 2 — otherwise the
version column records a fiction and a rotation would quietly destroy every
stored key.
"""

from cryptography.fernet import Fernet

from backend.config import settings
from backend.utils.encryption import current_key_version, decrypt, encrypt


def test_a_single_key_is_version_one(monkeypatch) -> None:
    key = Fernet.generate_key().decode()
    monkeypatch.setattr(settings, "settings_encryption_keys", "")
    monkeypatch.setattr(settings, "settings_encryption_key", key)

    assert current_key_version() == 1
    assert decrypt(encrypt("sk-or-secret")) == "sk-or-secret"


def test_ciphertext_from_the_old_key_still_opens_after_rotation(monkeypatch) -> None:
    old, new = Fernet.generate_key().decode(), Fernet.generate_key().decode()

    monkeypatch.setattr(settings, "settings_encryption_key", "")
    monkeypatch.setattr(settings, "settings_encryption_keys", old)
    written_under_v1 = encrypt("sk-or-written-first")
    assert current_key_version() == 1

    # Append, never reorder — the version is the 1-based position.
    monkeypatch.setattr(settings, "settings_encryption_keys", f"{old},{new}")
    assert current_key_version() == 2

    # The old ciphertext must survive the rotation …
    assert decrypt(written_under_v1) == "sk-or-written-first"
    # … and new writes must use the new key, or nothing ever moves off the old
    # one and `key_version` would say 2 about a version-1 ciphertext.
    written_under_v2 = encrypt("sk-or-written-later")
    assert decrypt(written_under_v2) == "sk-or-written-later"

    monkeypatch.setattr(settings, "settings_encryption_keys", new)
    assert decrypt(written_under_v2) == "sk-or-written-later"
