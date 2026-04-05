import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

// fallback key if not provided (should never happen in production if env is set correctly)
const FALLBACK_KEY = "8a7c1bfee19fd031bdcc2fccd2b467d5ae9761e0bbaf03ccecfdd9f2d1e089d8";

function getCipherKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY || FALLBACK_KEY;
  // Make sure to securely normalize keys (must be exactly 32 bytes for aes-256-cbc)
  // Our provided key is exactly a 64 character hex string.
  return Buffer.from(envKey, "hex");
}

/**
 * Encrypt a plain text string securely using AES-256-CBC with a random IV.
 * @param text The plain text to encrypt
 * @returns The encrypted string returned as 'iv:ciphertext' in hex format. Returns null if input is empty.
 */
export function encryptData(text: string | null | undefined): string | null {
  if (!text) return null;

  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getCipherKey(), iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    // Return the IV and the encrypted data joined by a colon.
    return `${iv.toString("hex")}:${encrypted}`;
  } catch (err) {
    console.error("Encryption error:", err);
    return null;
  }
}

/**
 * Decrypts a deeply encrypted text back to its original plain text.
 * @param encryptedText The encrypted text (format expected: 'iv:ciphertext')
 * @returns The original plain text, or null if decryption fails or input is empty
 */
export function decryptData(encryptedText: string | null | undefined): string | null {
  if (!encryptedText || !encryptedText.includes(":")) return encryptedText || null;

  try {
    const parts = encryptedText.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encryptedData = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getCipherKey(), iv);
    
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (err) {
    console.error("Decryption error:", err);
    // Return original, just in case they've accidentally passed plain text 
    // that happened to contain a colon (fallback mechanism during migration).
    return encryptedText;
  }
}
