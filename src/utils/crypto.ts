import * as Keychain from 'react-native-keychain';

const SERVICE_NAME = 'com.tinyfacade.encryption';
const KEY_ALIAS = 'tinyfacade_chat_key';

/**
 * Generate or retrieve the encryption key from the device keystore.
 * On Android this uses Android Keystore; on iOS it uses the Keychain.
 */
async function getOrCreateKey(): Promise<string> {
  try {
    const credentials = await Keychain.getGenericPassword({service: SERVICE_NAME});
    if (credentials) {
      return credentials.password;
    }
  } catch {}

  // Generate a new random key (32 bytes hex = 64 chars)
  const bytes = new Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  const key = bytes.map(b => b.toString(16).padStart(2, '0')).join('');

  await Keychain.setGenericPassword(KEY_ALIAS, key, {
    service: SERVICE_NAME,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
  });

  return key;
}

/**
 * Simple XOR-based encryption using the keystore-backed key.
 * For production, replace with AES-256-GCM via a native crypto module.
 */
function xorCipher(text: string, key: string): string {
  const result: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const keyChar = key.charCodeAt(i % key.length);
    result.push(text.charCodeAt(i) ^ keyChar);
  }
  return result.map(c => c.toString(16).padStart(4, '0')).join('');
}

function xorDecipher(hex: string, key: string): string {
  const chars: string[] = [];
  for (let i = 0; i < hex.length; i += 4) {
    const code = parseInt(hex.slice(i, i + 4), 16);
    const keyChar = key.charCodeAt((i / 4) % key.length);
    chars.push(String.fromCharCode(code ^ keyChar));
  }
  return chars.join('');
}

let cachedKey: string | null = null;

export async function encrypt(plaintext: string): Promise<string> {
  if (!cachedKey) {
    cachedKey = await getOrCreateKey();
  }
  return xorCipher(plaintext, cachedKey);
}

export async function decrypt(ciphertext: string): Promise<string> {
  if (!cachedKey) {
    cachedKey = await getOrCreateKey();
  }
  return xorDecipher(ciphertext, cachedKey);
}
