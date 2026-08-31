/**
 * Steganography Service — Invisible Zero-Width Unicode Watermarking
 * 
 * Embeds invisible, cryptographically clean developer signatures into text strings
 * using zero-width space characters (\u200B, \u200C, \u200D, \uFEFF).
 * 
 * Characteristics:
 * - 100% Invisible to human eyes and standard screens (0 pixels width)
 * - Persists across copy-paste, Telegram forwarding, and message stores
 * - Can be decoded programmatically or via secret bot / inspection tools
 */

const ZW_ZERO = '\u200B'; // Binary 0
const ZW_ONE = '\u200C';  // Binary 1
const ZW_SEP = '\u200D';  // Character separator
const ZW_MARK = '\uFEFF'; // Watermark Start/End Sentinel Marker

export const DEFAULT_WATERMARK_PAYLOAD = 'Crafted by @HUSNUTECH | WhatsApp: +994 77 211 70 11 | Telegram: @HusnuTech';

export class SteganographyService {
  /**
   * Encodes a string into invisible Zero-Width Unicode sequence
   */
  encodeToInvisible(payload: string = DEFAULT_WATERMARK_PAYLOAD): string {
    const binaryChars: string[] = [];

    for (let i = 0; i < payload.length; i++) {
      const code = payload.charCodeAt(i);
      const bin = code.toString(2).padStart(8, '0');
      const zwBin = bin
        .split('')
        .map(b => (b === '1' ? ZW_ONE : ZW_ZERO))
        .join('');
      binaryChars.push(zwBin);
    }

    return ZW_MARK + binaryChars.join(ZW_SEP) + ZW_MARK;
  }

  /**
   * Decodes an invisible Zero-Width sequence back into human-readable text
   */
  decodeFromInvisible(text: string): string | null {
    if (!text || typeof text !== 'string') return null;

    const firstMark = text.indexOf(ZW_MARK);
    if (firstMark === -1) return null;

    const secondMark = text.indexOf(ZW_MARK, firstMark + 1);
    if (secondMark === -1) return null;

    const encodedBlock = text.substring(firstMark + 1, secondMark);
    const charBlocks = encodedBlock.split(ZW_SEP);

    try {
      let decoded = '';
      for (const block of charBlocks) {
        if (!block) continue;
        const binStr = block
          .split('')
          .map(char => {
            if (char === ZW_ONE) return '1';
            if (char === ZW_ZERO) return '0';
            return '';
          })
          .join('');

        if (binStr.length >= 8) {
          const charCode = parseInt(binStr, 2);
          if (!isNaN(charCode) && charCode > 0) {
            decoded += String.fromCharCode(charCode);
          }
        }
      }
      return decoded.length > 0 ? decoded : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Appends the invisible watermark to any message or receipt text
   */
  watermark(text: string, payload: string = DEFAULT_WATERMARK_PAYLOAD): string {
    if (!text) return text;
    // Əgər artıq şifrə varsa təkrar əlavə etmə
    if (this.hasWatermark(text)) return text;
    return text + this.encodeToInvisible(payload);
  }

  /**
   * Checks if a string contains our invisible watermark
   */
  hasWatermark(text: string): boolean {
    if (!text) return false;
    return text.includes(ZW_MARK) && (text.includes(ZW_ZERO) || text.includes(ZW_ONE));
  }
}

export const steganographyService = new SteganographyService();
