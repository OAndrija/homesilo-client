/** Units offered when typing a storage limit. Binary, like the sizes shown everywhere else. */
export const SIZE_UNITS = ['MB', 'GB', 'TB'] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];

const FACTORS: Record<SizeUnit, number> = {
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

export function toBytes(value: number, unit: SizeUnit): number {
  return Math.round(value * FACTORS[unit]);
}

/** The largest unit that shows the size exactly (to one decimal), for editing: 100 GB, 1.5 TB, 750 MB. */
export function splitBytes(bytes: number): { value: number; unit: SizeUnit } {
  for (const unit of ['TB', 'GB'] as const) {
    const value = bytes / FACTORS[unit];
    const rounded = Math.round(value * 10) / 10;
    if (value >= 1 && Math.abs(value - rounded) < 1e-6) return { value: rounded, unit };
  }
  return { value: Math.round((bytes / FACTORS.MB) * 10) / 10, unit: 'MB' };
}

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (i, l, o, 0, 1)

/**
 * A temporary password that is easy to read out or type: four groups of four
 * letters and digits, e.g. "kq7m-x2pt-9bwa-h4cz" (about 79 bits of randomness).
 */
export function generatePassword(): string {
  const chars: string[] = [];
  const limit = 256 - (256 % PASSWORD_ALPHABET.length); // reject the remainder so every character is equally likely
  while (chars.length < 16) {
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
      if (byte < limit && chars.length < 16)
        chars.push(PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]);
    }
  }
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-');
}

/** A storage limit as people set it: "100 GB", "1.5 TB", "750 MB" (no trailing zeros). */
export function formatLimit(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const { value, unit } = splitBytes(bytes);
  return `${value} ${unit}`;
}
