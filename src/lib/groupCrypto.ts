import * as nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, decodeUTF8, encodeUTF8 } from 'tweetnacl-util';

// ── Group key generation ─────────────────────────────────────────────────────

/** Generate a random 32-byte NaCl secretbox key for a group. */
export function generateGroupKey(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}

// ── Per-member key encryption (nacl.box — DH) ───────────────────────────────

export interface EncryptedKeyEntry {
  encrypted: string; // base64
  nonce: string;     // base64
}

/**
 * Encrypt the group symmetric key for a single member.
 * Uses nacl.box(groupKey, nonce, memberPublicKey, leaderPrivateKey).
 */
export function encryptGroupKeyForMember(
  groupKey: Uint8Array,
  memberPublicKeyB64: string,
  leaderPrivateKeyB64: string,
): EncryptedKeyEntry {
  const memberPub = decodeBase64(memberPublicKeyB64);
  const leaderPriv = decodeBase64(leaderPrivateKeyB64);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(groupKey, nonce, memberPub, leaderPriv);
  return {
    encrypted: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Build the full group_key_encrypted JSONB object for all members.
 * Returns { [userId]: { encrypted, nonce } }.
 */
export function encryptGroupKeyForAllMembers(
  groupKey: Uint8Array,
  members: { userId: string; publicKey: string }[],
  leaderPrivateKeyB64: string,
): Record<string, EncryptedKeyEntry> {
  const result: Record<string, EncryptedKeyEntry> = {};
  for (const m of members) {
    result[m.userId] = encryptGroupKeyForMember(groupKey, m.publicKey, leaderPrivateKeyB64);
  }
  return result;
}

/**
 * Decrypt the group symmetric key using my private key + leader's public key.
 * Returns the raw 32-byte key or null on failure.
 */
export function decryptGroupKey(
  entry: EncryptedKeyEntry,
  leaderPublicKeyB64: string,
  myPrivateKeyB64: string,
): Uint8Array | null {
  try {
    const encrypted = decodeBase64(entry.encrypted);
    const nonce = decodeBase64(entry.nonce);
    const leaderPub = decodeBase64(leaderPublicKeyB64);
    const myPriv = decodeBase64(myPrivateKeyB64);
    const decrypted = nacl.box.open(encrypted, nonce, leaderPub, myPriv);
    return decrypted;
  } catch {
    return null;
  }
}

// ── Message encryption (nacl.secretbox — symmetric) ──────────────────────────

/**
 * Encrypt a plaintext message with the group's shared symmetric key.
 * Returns { ciphertext: base64, nonce: base64 }.
 */
export function encryptGroupMessage(
  plaintext: string,
  groupKey: Uint8Array,
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const message = decodeUTF8(plaintext);
  const encrypted = nacl.secretbox(message, nonce, groupKey);
  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt a group message with the shared symmetric key.
 * Returns plaintext string or null on failure.
 */
export function decryptGroupMessage(
  ciphertextB64: string,
  nonceB64: string,
  groupKey: Uint8Array,
): string | null {
  try {
    const ciphertext = decodeBase64(ciphertextB64);
    const nonce = decodeBase64(nonceB64);
    const decrypted = nacl.secretbox.open(ciphertext, nonce, groupKey);
    if (!decrypted) return null;
    return encodeUTF8(decrypted);
  } catch {
    return null;
  }
}
