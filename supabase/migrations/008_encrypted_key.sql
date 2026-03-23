-- Add encrypted private key backup so users can restore their keypair on new devices.
-- The blob is: base64(salt[16] || iv[12] || AES-GCM-ciphertext)
-- Encrypted with a key derived from the user's password via PBKDF2-SHA256.
-- The server never sees the plaintext private key.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT;
