"""Encryption service for securing tokens."""
import base64
import hashlib
from cryptography.fernet import Fernet

from app.config import settings


class CryptoService:
    """Handles encryption/decryption of sensitive data."""

    def __init__(self):
        # Derive a valid Fernet key from the settings key
        key = settings.ENCRYPTION_KEY.encode()
        # Use SHA256 to get 32 bytes, then base64 encode for Fernet
        derived_key = base64.urlsafe_b64encode(hashlib.sha256(key).digest())
        self.fernet = Fernet(derived_key)

    def encrypt(self, data: str) -> str:
        """Encrypt a string and return base64 encoded result."""
        encrypted = self.fernet.encrypt(data.encode())
        return encrypted.decode()

    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt base64 encoded encrypted data."""
        decrypted = self.fernet.decrypt(encrypted_data.encode())
        return decrypted.decode()


# Singleton instance
crypto_service = CryptoService()
