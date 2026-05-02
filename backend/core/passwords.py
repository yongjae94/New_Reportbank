from __future__ import annotations

import hashlib
import secrets


def hash_password(plain: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", plain.encode("utf-8"), salt.encode("ascii"), 310_000)
    return f"pbkdf2_sha256$310000${salt}${dk.hex()}"


def verify_password(plain: str, stored: str) -> bool:
    if not stored or "$" not in stored:
        return False
    parts = stored.split("$")
    if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
        return False
    _, rounds_s, salt, hexdigest = parts
    try:
        rounds = int(rounds_s)
    except ValueError:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", plain.encode("utf-8"), salt.encode("ascii"), rounds)
    return secrets.compare_digest(dk.hex(), hexdigest)
