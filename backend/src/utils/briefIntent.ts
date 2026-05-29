const esportsEventTokens = [
  'counter strike tournament',
  'counter-strike tournament',
  'cs2 tournament',
  'esports tournament',
  'gaming tournament',
  'major finals',
  'major final',
  'final match',
  'match atmosphere',
  'arena lights',
  'gaming arena',
  'trophy moment',
  'trophy celebration',
  'roaring crowd',
  'crowd eruption',
  'player walkout',
  'stage lights',
  'watch highlights'
];

const standaloneEsportsIntentTokens = [
  'counter strike',
  'counter-strike',
  'cs2',
  'esports hype',
  'esports promo',
  'pro match'
];

export const gamingHardwareProductTokens = [
  'controller',
  'controllers',
  'desk',
  'gear',
  'headset',
  'headsets',
  'keyboard',
  'keyboards',
  'keycap',
  'keycaps',
  'laptop',
  'monitor',
  'monitors',
  'mouse',
  'mice',
  'pc',
  'rgb',
  'setup',
  'switch',
  'switches'
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const includesPhrase = (normalized: string, phrase: string) =>
  phrase.includes(' ') || phrase.includes('-')
    ? normalized.includes(phrase)
    : new RegExp(`\\b${escapeRegExp(phrase)}\\b`).test(normalized);

export const hasGamingHardwareProduct = (description: string) => {
  const normalized = normalize(description);
  return gamingHardwareProductTokens.some((token) => includesPhrase(normalized, token));
};

export const isEsportsBrief = (description: string, _productCategory = '') => {
  const normalized = normalize(description);
  const hardwareProductBrief = hasGamingHardwareProduct(description);

  if (esportsEventTokens.some((token) => includesPhrase(normalized, token))) {
    return true;
  }

  return (
    standaloneEsportsIntentTokens.some((token) => includesPhrase(normalized, token)) &&
    !hardwareProductBrief
  );
};
