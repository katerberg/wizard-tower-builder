// Flavor name pools, kept separate from logic (7drl pattern).

const goblinSeeds = [
  'Snik',
  'Grubb',
  'Mazgash',
  'Wretch',
  'Krell',
  'Vobble',
  'Nixle',
  'Durt',
] as const;

const bruteSeeds = ['Crag', 'Hrunk', 'Boulderjaw', 'Stonefist', 'Gravelmaw', 'Thudd'] as const;

const wispSeeds = ['Flicker', 'Ember', 'Mote', 'Glimmer', 'Cinder'] as const;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function expandNamePool(
  seeds: readonly string[],
  prefixes: readonly string[],
  suffixes: readonly string[],
  targetCount: number,
  infixes: readonly string[] = [''],
): readonly string[] {
  const names = new Set<string>(seeds);

  outer: for (const prefix of prefixes) {
    for (const infix of infixes) {
      for (const suffix of suffixes) {
        if (names.size >= targetCount) break outer;
        const raw = `${prefix}${infix}${suffix}`;
        if (raw.length < 3 || raw.length > 16) continue;
        names.add(capitalize(raw));
      }
    }
  }

  if (names.size < targetCount) {
    throw new Error(`Name pool generation fell short: ${names.size} of ${targetCount}`);
  }

  return [...names].slice(0, targetCount);
}

const goblinPrefixes = [
  'sn', 'gr', 'mz', 'kr', 'vo', 'nx', 'dr', 'wr', 'bl', 'sk', 'gl', 'th', 'zg', 'rk', 'pl', 'gn',
  'sh', 'vr', 'tz', 'kl', 'br', 'dw', 'fz', 'hp', 'jt', 'lm', 'nq', 'px', 'qu', 'rz', 'sw', 'ty',
  'uz', 'vx', 'wy', 'yz', 'ag', 'ek', 'if', 'ol', 'um', 'yb', 'cz', 'fe', 'hi', 'jo', 'ke', 'lo',
  'mu', 'ni', 'op', 'ra', 'si', 'to', 'ul', 've', 'we', 'xi', 'yo', 'za', 'be', 'co', 'du', 'fi',
  'gu', 'he', 'im', 'ja', 'ki', 'le', 'mo', 'ne', 'or', 'pe', 'ri', 'so', 'te', 'un', 'vi', 'wa',
  'ze', 'bo', 'ci', 'do', 'el', 'fa', 'ge', 'hu', 'ir', 'je', 'ka', 'li', 'me', 'no', 'po', 're',
  'sa', 'tu', 'ur', 'vo', 'ze', 'ax', 'by', 'cy', 'dy', 'ey', 'fy', 'gy', 'hy', 'iy', 'jy', 'ky',
];

const goblinSuffixes = [
  'ik', 'ash', 'le', 'ubb', 'elt', 'ort', 'ix', 'ogg', 'az', 'urk', 'nib', 'ack', 'ug', 'op', 'ez',
  'ak', 'ar', 'at', 'ax', 'az', 'ek', 'el', 'en', 'er', 'et', 'ex', 'ez', 'ig', 'il', 'in', 'ir',
  'it', 'ix', 'iz', 'ob', 'od', 'og', 'ok', 'ol', 'om', 'on', 'or', 'os', 'ot', 'ox', 'oz', 'ub',
  'ud', 'uf', 'ug', 'uk', 'ul', 'um', 'un', 'up', 'ur', 'us', 'ut', 'ux', 'uz', 'ab', 'ad', 'af',
  'ag', 'aj', 'al', 'am', 'an', 'ap', 'as', 'av', 'aw', 'ay', 'eb', 'ed', 'ef', 'eh', 'ej', 'em',
  'ep', 'es', 'ev', 'ew', 'ey', 'ib', 'id', 'if', 'ih', 'ij', 'im', 'ip', 'is', 'iv', 'iw', 'iy',
];

const brutePrefixes = [
  'cr', 'hr', 'st', 'bo', 'gr', 'th', 'sl', 'mn', 'ir', 'ga', 'ru', 'fl', 'sh', 'br', 'dr', 'tr',
  'kn', 'wr', 'sm', 'lg', 'hv', 'mt', 'rd', 'bk', 'sn', 'pl', 'qu', 'vi', 'wo', 'xe', 'ya', 'ze',
  'an', 'be', 'co', 'du', 'em', 'fo', 'gi', 'ha', 'je', 'ki', 'lo', 'mu', 'ni', 'or', 'pe', 'ri',
  'so', 'tu', 'ur', 've', 'wa', 'xi', 'yo', 'za', 'bl', 'ch', 'dw', 'fr', 'gl', 'pr', 'sk', 'tw',
  'cl', 'fn', 'gn', 'hn', 'jn', 'ln', 'pn', 'rn', 'tn', 'vn', 'wn', 'yn', 'zn', 'ag', 'eg', 'ig',
  'og', 'ug', 'ak', 'ek', 'ik', 'ok', 'uk', 'ar', 'er', 'ir', 'or', 'ur', 'at', 'et', 'it', 'ot',
  'ut', 'ax', 'ex', 'ix', 'ox', 'ux', 'az', 'ez', 'iz', 'oz', 'uz', 'ab', 'eb', 'ib', 'ob', 'ub',
];

const bruteSuffixes = [
  'ag', 'unk', 'jaw', 'fist', 'maw', 'udd', 'one', 'edge', 'back', 'hide', 'hide', 'hide', 'hide',
  'rock', 'stone', 'boulder', 'grit', 'slab', 'cliff', 'peak', 'ridge', 'knuckle', 'shoulder', 'spine',
  'skull', 'tooth', 'tusk', 'horn', 'hoof', 'heel', 'knee', 'elbow', 'wrist', 'ankle', 'rib', 'bone',
  'crag', 'shard', 'chunk', 'mass', 'bulk', 'hulk', 'brute', 'breaker', 'crusher', 'smasher', 'wall',
  'gate', 'keep', 'hold', 'guard', 'ward', 'shield', 'plate', 'mail', 'iron', 'steel', 'granite',
  'marble', 'basalt', 'flint', 'obsidian', 'slate', 'gravel', 'sand', 'dust', 'mud', 'clay', 'soil',
  'root', 'trunk', 'branch', 'limb', 'arm', 'leg', 'foot', 'hand', 'palm', 'finger', 'thumb', 'knob',
  'lump', 'block', 'brick', 'slab', 'slab', 'slab', 'slab', 'slab', 'slab', 'slab', 'slab', 'slab',
];

const wispPrefixes = [
  'fl', 'em', 'gl', 'sp', 'ci', 'sh', 'lu', 'pr', 'br', 'dr', 'tr', 'wr', 'sk', 'bl', 'cr', 'gr',
  'wh', 'ph', 'st', 'tw', 'sw', 'dw', 'fw', 'gw', 'hw', 'iw', 'jw', 'kw', 'lw', 'mw', 'nw', 'ow',
  'pw', 'qw', 'rw', 'uw', 'vw', 'ww', 'xw', 'yw', 'zw', 'ae', 'ai', 'ao', 'au', 'ea', 'ei', 'eo',
  'eu', 'ia', 'ie', 'io', 'iu', 'oa', 'oe', 'oi', 'ou', 'ua', 'ue', 'ui', 'uo', 'fa', 'fe', 'fi',
  'fo', 'fu', 'la', 'le', 'li', 'lo', 'lu', 'ma', 'me', 'mi', 'mo', 'mu', 'na', 'ne', 'ni', 'no',
  'nu', 'pa', 'pe', 'pi', 'po', 'pu', 'ra', 're', 'ri', 'ro', 'ru', 'sa', 'se', 'si', 'so', 'su',
];

const wispSuffixes = [
  'icker', 'er', 'ote', 'immer', 'inder', 'ark', 'ow', 'ame', 'aze', 'eam', 'eak', 'eal', 'ean',
  'ear', 'eat', 'eau', 'eav', 'eaw', 'eax', 'eay', 'eaz', 'ice', 'ide', 'ife', 'ige', 'ike', 'ile',
  'ime', 'ine', 'ipe', 'ire', 'ise', 'ite', 'ive', 'iwe', 'ixe', 'iye', 'ize', 'oke', 'ole', 'ome',
  'one', 'ope', 'ore', 'ose', 'ote', 'ove', 'owe', 'oxe', 'oye', 'oze', 'ule', 'ume', 'une', 'upe',
  'ure', 'use', 'ute', 'uve', 'uwe', 'uxe', 'uye', 'uze', 'ace', 'ade', 'afe', 'age', 'ahe', 'aje',
  'ale', 'ame', 'ane', 'ape', 'are', 'ase', 'ate', 'ave', 'awe', 'axe', 'aye', 'aze', 'ight', 'low',
  'eam', 'eam', 'eam', 'eam', 'eam', 'eam', 'eam', 'eam', 'eam', 'eam', 'eam', 'eam', 'eam', 'eam',
];

export const goblinNames = expandNamePool(goblinSeeds, goblinPrefixes, goblinSuffixes, goblinSeeds.length * 100);
export const bruteNames = expandNamePool(bruteSeeds, brutePrefixes, bruteSuffixes, bruteSeeds.length * 100);
export const wispNames = expandNamePool(wispSeeds, wispPrefixes, wispSuffixes, wispSeeds.length * 100);
