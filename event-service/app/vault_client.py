"""
Vault Client for Secrets Management
Integrates with HashiCorp Vault for secure secrets storage
"""

import os
import logging
from typing import Optional, Dict, Any
from functools import lru_cache
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class VaultClient:
    """Client for interacting with HashiCorp Vault"""
    
    def __init__(
        self,
        vault_addr: str = None,
        vault_token: str = None,
        vault_role: str = None,
        kubernetes_auth: bool = False
    ):
        self.vault_addr = vault_addr or os.getenv("VAULT_ADDR", "http://vault:8200")
        self.vault_token = vault_token or os.getenv("VAULT_TOKEN")
        self.vault_role = vault_role or os.getenv("VAULT_ROLE", "spdd-app")
        self.kubernetes_auth = kubernetes_auth
        self._client = httpx.Client(base_url=self.vault_addr, timeout=30.0)
        
        if kubernetes_auth and not self.vault_token:
            self._kubernetes_login()
    
    def _kubernetes_login(self):
        """Authenticate using Kubernetes service account"""
        try:
            # Read the service account token
            with open("/var/run/secrets/kubernetes.io/serviceaccount/token") as f:
                jwt = f.read()
            
            response = self._client.post(
                "/v1/auth/kubernetes/login",
                json={"role": self.vault_role, "jwt": jwt}
            )
            response.raise_for_status()
            
            data = response.json()
            self.vault_token = data["auth"]["client_token"]
            logger.info("Successfully authenticated with Vault using Kubernetes auth")
            
        except Exception as e:
            logger.error(f"Failed to authenticate with Vault: {e}")
            raise
    
    def _headers(self) -> Dict[str, str]:
        """Get request headers with Vault token"""
        return {"X-Vault-Token": self.vault_token}
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
    def read_secret(self, path: str, mount_point: str = "secret") -> Optional[Dict[str, Any]]:
        """
        Read a secret from Vault KV v2 engine
        
        Args:
            path: Secret path (e.g., "spdd/database")
            mount_point: Secret engine mount point
            
        Returns:
            Secret data or None if not found
        """
        try:
            response = self._client.get(
                f"/v1/{mount_point}/data/{path}",
                headers=self._headers()
            )
            
            if response.status_code == 404:
                logger.warning(f"Secret not found: {path}")
                return None
            
            response.raise_for_status()
            data = response.json()
            return data.get("data", {}).get("data")
            
        except Exception as e:
            logger.error(f"Failed to read secret {path}: {e}")
            raise
    
    def write_secret(self, path: str, data: Dict[str, Any], mount_point: str = "secret"):
        """
        Write a secret to Vault KV v2 engine
        
        Args:
            path: Secret path
            data: Secret data as dictionary
            mount_point: Secret engine mount point
        """
        try:
            response = self._client.post(
                f"/v1/{mount_point}/data/{path}",
                headers=self._headers(),
                json={"data": data}
            )
            response.raise_for_status()
            logger.info(f"Successfully wrote secret: {path}")
            
        except Exception as e:
            logger.error(f"Failed to write secret {path}: {e}")
            raise
    
    def get_database_credentials(self, role: str = "spdd-app") -> Dict[str, str]:
        """
        Get dynamic database credentials from Vault database engine
        
        Args:
            role: Database role name
            
        Returns:
            Dictionary with 'username' and 'password'
        """
        try:
            response = self._client.get(
                f"/v1/database/creds/{role}",
                headers=self._headers()
            )
            response.raise_for_status()
            
            data = response.json()
            return {
                "username": data["data"]["username"],
                "password": data["data"]["password"],
                "lease_id": data["lease_id"],
                "lease_duration": data["lease_duration"]
            }
            
        except Exception as e:
            logger.error(f"Failed to get database credentials: {e}")
            raise
    
    def renew_lease(self, lease_id: str, increment: int = 3600):
        """Renew a Vault lease"""
        try:
            response = self._client.post(
                "/v1/sys/leases/renew",
                headers=self._headers(),
                json={"lease_id": lease_id, "increment": increment}
            )
            response.raise_for_status()
            logger.info(f"Renewed lease: {lease_id}")
            
        except Exception as e:
            logger.error(f"Failed to renew lease {lease_id}: {e}")
            raise
    
    def encrypt(self, plaintext: str, key_name: str = "spdd-key") -> str:
        """
        Encrypt data using Vault Transit engine
        
        Args:
            plaintext: Data to encrypt (base64 encoded)
            key_name: Transit key name
            
        Returns:
            Ciphertext
        """
        import base64
        
        try:
            encoded = base64.b64encode(plaintext.encode()).decode()
            response = self._client.post(
                f"/v1/transit/encrypt/{key_name}",
                headers=self._headers(),
                json={"plaintext": encoded}
            )
            response.raise_for_status()
            
            return response.json()["data"]["ciphertext"]
            
        except Exception as e:
            logger.error(f"Failed to encrypt data: {e}")
            raise
    
    def decrypt(self, ciphertext: str, key_name: str = "spdd-key") -> str:
        """
        Decrypt data using Vault Transit engine
        
        Args:
            ciphertext: Encrypted data
            key_name: Transit key name
            
        Returns:
            Decrypted plaintext
        """
        import base64
        
        try:
            response = self._client.post(
                f"/v1/transit/decrypt/{key_name}",
                headers=self._headers(),
                json={"ciphertext": ciphertext}
            )
            response.raise_for_status()
            
            encoded = response.json()["data"]["plaintext"]
            return base64.b64decode(encoded).decode()
            
        except Exception as e:
            logger.error(f"Failed to decrypt data: {e}")
            raise
    
    def health_check(self) -> Dict[str, Any]:
        """Check Vault health status"""
        try:
            response = self._client.get("/v1/sys/health")
            return {
                "initialized": response.json().get("initialized"),
                "sealed": response.json().get("sealed"),
                "version": response.json().get("version")
            }
        except Exception as e:
            return {"error": str(e)}
    
    def close(self):
        """Close the HTTP client"""
        self._client.close()


# Singleton instance
_vault_client: Optional[VaultClient] = None


def get_vault_client() -> VaultClient:
    """Get or create Vault client singleton"""
    global _vault_client
    
    if _vault_client is None:
        kubernetes_auth = os.path.exists("/var/run/secrets/kubernetes.io/serviceaccount/token")
        _vault_client = VaultClient(kubernetes_auth=kubernetes_auth)
    
    return _vault_client


class SecretsManager:
    """High-level secrets manager using Vault"""
    
    def __init__(self):
        self.vault = get_vault_client()
        self._cache: Dict[str, Any] = {}
    
    @lru_cache(maxsize=100)
    def get_secret(self, key: str, default: Any = None) -> Any:
        """
        Get a secret value with caching
        
        Args:
            key: Secret key in format "path/key" (e.g., "database/password")
            default: Default value if secret not found
            
        Returns:
            Secret value or default
        """
        try:
            parts = key.rsplit("/", 1)
            if len(parts) == 2:
                path, secret_key = parts
                secrets = self.vault.read_secret(path)
                if secrets:
                    return secrets.get(secret_key, default)
            return default
        except Exception:
            return default
    
    def get_database_url(self) -> str:
        """Get database URL with dynamic credentials"""
        try:
            creds = self.vault.get_database_credentials()
            host = os.getenv("POSTGRES_HOST", "postgres")
            db = os.getenv("POSTGRES_DB", "eventsdb")
            return f"postgresql://{creds['username']}:{creds['password']}@{host}:5432/{db}"
        except Exception:
            # Fallback to environment variables
            return os.getenv(
                "DATABASE_URL",
                "postgresql://postgres:postgres@postgres:5432/eventsdb"
            )
    
    def get_jwt_secret(self) -> str:
        """Get JWT secret key"""
        try:
            secrets = self.vault.read_secret("spdd/jwt")
            if secrets:
                return secrets.get("secret_key")
        except Exception:
            pass
        return os.getenv("JWT_SECRET_KEY", "fallback-secret-change-me")
    
    def get_redis_password(self) -> Optional[str]:
        """Get Redis password"""
        try:
            secrets = self.vault.read_secret("spdd/redis")
            if secrets:
                return secrets.get("password")
        except Exception:
            pass
        return os.getenv("REDIS_PASSWORD")


# Export singleton
secrets_manager = SecretsManager()
