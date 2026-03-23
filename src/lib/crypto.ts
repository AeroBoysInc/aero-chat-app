import * as nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

// ── Password-based private key encryption (PBKDF2 + AES-GCM) ─────────────────
// Blob layout stored in Supabase: base64( salt[16] || iv[12] || AES-GCM-ciphertext )
// The server stores only the encrypted blob — the plaintext private key never leaves the client.

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptPrivateKey(privateKeyB64: string, password: string): Promise<string> {
  const salt       = crypto.getRandomValues(new Uint8Array(16));
  const iv         = crypto.getRandomValues(new Uint8Array(12));
  const aesKey     = await deriveAesKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(privateKeyB64),
  );
  const blob = new Uint8Array(16 + 12 + ciphertext.byteLength);
  blob.set(salt, 0);
  blob.set(iv, 16);
  blob.set(new Uint8Array(ciphertext), 28);
  return encodeBase64(blob);
}

export async function decryptPrivateKey(blobB64: string, password: string): Promise<string | null> {
  try {
    const blob       = decodeBase64(blobB64);
    const salt       = blob.slice(0, 16);
    const iv         = blob.slice(16, 28);
    const ciphertext = blob.slice(28);
    const aesKey     = await deriveAesKey(password, salt);
    const plain      = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

const PRIVATE_KEY_STORE = (userId?: string) =>
  userId ? `aero_private_key_${userId}` : 'aero_private_key';

export function generateKeyPair() {
  const kp = nacl.box.keyPair();
  return {
    publicKey:  encodeBase64(kp.publicKey),
    privateKey: encodeBase64(kp.secretKey),
  };
}

export function savePrivateKey(privateKey: string, userId?: string) {
  localStorage.setItem(PRIVATE_KEY_STORE(userId), privateKey);
}

export function loadPrivateKey(userId?: string): string | null {
  return localStorage.getItem(PRIVATE_KEY_STORE(userId));
}

export function encryptMessage(
  plaintext: string,
  theirPublicKeyB64: string,
  myPrivateKeyB64: string,
): string {
  const theirPublicKey = decodeBase64(theirPublicKeyB64);
  const myPrivateKey   = decodeBase64(myPrivateKeyB64);
  const nonce          = nacl.randomBytes(nacl.box.nonceLength);
  const message        = decodeUTF8(plaintext);
  const encrypted      = nacl.box(message, nonce, theirPublicKey, myPrivateKey);

  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return encodeBase64(combined);
}

export function decryptMessage(
  ciphertextB64: string,
  theirPublicKeyB64: string,
  myPrivateKeyB64: string,
): string | null {
  try {
    const combined       = decodeBase64(ciphertextB64);
    const nonce          = combined.slice(0, nacl.box.nonceLength);
    const ciphertext     = combined.slice(nacl.box.nonceLength);
    const theirPublicKey = decodeBase64(theirPublicKeyB64);
    const myPrivateKey   = decodeBase64(myPrivateKeyB64);
    const decrypted      = nacl.box.open(ciphertext, nonce, theirPublicKey, myPrivateKey);
    if (!decrypted) return null;
    return encodeUTF8(decrypted);
  } catch {
    return null;
  }
}
