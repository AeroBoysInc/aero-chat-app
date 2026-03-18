/**
 * E2E encryption using TweetNaCl (X25519 key exchange + XSalsa20-Poly1305).
 * Keys are generated on the client; only the public key is stored in Supabase.
 * The private key never leaves the device (stored in localStorage for now).
 */
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

const PRIVATE_KEY_STORE = 'aero_private_key';

export function generateKeyPair() {
  const kp = nacl.box.keyPair();
  return {
    publicKey:  encodeBase64(kp.publicKey),
    privateKey: encodeBase64(kp.secretKey),
  };
}

export function savePrivateKey(privateKey: string) {
  localStorage.setItem(PRIVATE_KEY_STORE, privateKey);
}

export function loadPrivateKey(): string | null {
  return localStorage.getItem(PRIVATE_KEY_STORE);
}

export function encryptMessage(
  plaintext: string,
  theirPublicKeyB64: string,
  myPrivateKeyB64: string,
): string {
  const theirPublicKey = decodeBase64(theirPublicKeyB64);
  const myPrivateKey   = decodeBase64(myPrivateKeyB64);
  const nonce          = nacl.randomBytes(nacl.box.nonceLength);
  const message        = encodeUTF8(plaintext);
  const encrypted      = nacl.box(message, nonce, theirPublicKey, myPrivateKey);

  // Pack nonce + ciphertext into one base64 blob
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
    return decodeUTF8(decrypted);
  } catch {
    return null;
  }
}
