/**
 * Renders a Latin-script name in Devanagari, for the shared receipt image.
 *
 * This is a best effort and it is sometimes wrong. English spelling simply does
 * not record the distinctions Marathi needs — whether "n" is न or ण, "l" is ल or
 * ळ, "t" is त or ट, or whether "a" is अ or आ. "Patil" is पाटील, but nothing in
 * those five letters says so. Off-the-shelf transliteration libraries do far
 * worse than this: they expect a strict scheme (ITRANS wants `pATIl`) and turn
 * ordinary spellings into things like पतिल् — 1 of 14 real names correct when
 * measured.
 *
 * So the accuracy here comes mostly from KNOWN, not from the rules: Marathi
 * names are drawn from a fairly small pool, and a looked-up name is exact. The
 * rules are the fallback for whatever the pool misses. Adding a name to KNOWN
 * is the right fix for any name that comes out wrong — it is one line, and it is
 * the only way to be certain.
 *
 * Anything already in Devanagari is returned untouched, so a volunteer who
 * types a name in Marathi always wins over this file.
 */

/** Devanagari, plus the Marathi-specific ळ and the vowel signs. */
const DEVANAGARI = /[ऀ-ॿ]/;

/**
 * Exact spellings, which is what makes this usable. Keys are lowercased.
 * Extend freely — a wrong name is a missing entry, not a broken algorithm.
 */
const KNOWN: Record<string, string> = {
  // Surnames common in Maharashtra. These are the ones worth getting right:
  // they repeat across hundreds of receipts, and the retroflex letters in them
  // (ट, ड, ण, ळ) are exactly what English spelling cannot convey.
  patil: "पाटील",
  kulkarni: "कुलकर्णी",
  deshpande: "देशपांडे",
  deshmukh: "देशमुख",
  jadhav: "जाधव",
  shinde: "शिंदे",
  bhosale: "भोसले",
  pawar: "पवार",
  gaikwad: "गायकवाड",
  sawant: "सावंत",
  more: "मोरे",
  joshi: "जोशी",
  kale: "काळे",
  gore: "गोरे",
  shelar: "शेलार",
  sonmali: "सोनमाळी",
  sonawane: "सोनवणे",
  chavan: "चव्हाण",
  chauhan: "चौहान",
  salunkhe: "साळुंखे",
  thorat: "थोरात",
  kadam: "कदम",
  nikam: "निकम",
  mane: "माने",
  jagtap: "जगताप",
  bhagat: "भगत",
  ghadge: "घाडगे",
  waghmare: "वाघमारे",
  khedkar: "खेडकर",
  wagh: "वाघ",
  dhumal: "धुमाळ",
  mohite: "मोहिते",
  nalawade: "नलावडे",
  bhandari: "भंडारी",
  kamble: "कांबळे",
  kharat: "खरात",
  lokhande: "लोखंडे",
  pandit: "पंडित",
  phadke: "फडके",
  ranade: "रानडे",
  sathe: "साठे",
  tambe: "तांबे",
  vaidya: "वैद्य",
  gadkari: "गडकरी",
  apte: "आपटे",
  bapat: "बापट",
  chitale: "चितळे",
  gokhale: "गोखले",
  karve: "कर्वे",
  limaye: "लिमये",
  marathe: "मराठे",
  natu: "नातू",
  paranjpe: "परांजपे",
  ranade2: "रानडे",
  sane: "साने",
  tilak: "टिळक",
  agarkar: "आगरकर",
  bedekar: "बेडेकर",

  // Given names.
  ganesh: "गणेश",
  ganpat: "गणपत",
  ramesh: "रमेश",
  suresh: "सुरेश",
  mahesh: "महेश",
  rajesh: "राजेश",
  mangesh: "मंगेश",
  nilesh: "निलेश",
  sanket: "संकेत",
  prashant: "प्रशांत",
  shubham: "शुभम",
  sachin: "सचिन",
  santosh: "संतोष",
  sandeep: "संदीप",
  sunil: "सुनील",
  anil: "अनिल",
  vijay: "विजय",
  ajay: "अजय",
  akash: "आकाश",
  amit: "अमित",
  amol: "अमोल",
  ashok: "अशोक",
  atul: "अतुल",
  balaji: "बाळाजी",
  bhau: "भाऊ",
  chetan: "चेतन",
  dattatray: "दत्तात्रय",
  dinesh: "दिनेश",
  dnyaneshwar: "ज्ञानेश्वर",
  gopal: "गोपाळ",
  govind: "गोविंद",
  harshad: "हर्षद",
  kiran: "किरण",
  krishna: "कृष्णा",
  lakshman: "लक्ष्मण",
  madhav: "माधव",
  mohan: "मोहन",
  nana: "नाना",
  narayan: "नारायण",
  nitin: "नितीन",
  omkar: "ओंकार",
  pandurang: "पांडुरंग",
  pradeep: "प्रदीप",
  prakash: "प्रकाश",
  pramod: "प्रमोद",
  rahul: "राहुल",
  raj: "राज",
  rajendra: "राजेंद्र",
  ram: "राम",
  rohit: "रोहित",
  sagar: "सागर",
  sameer: "समीर",
  sanjay: "संजय",
  shankar: "शंकर",
  shivaji: "शिवाजी",
  shriram: "श्रीराम",
  siddharth: "सिद्धार्थ",
  swapnil: "स्वप्निल",
  tukaram: "तुकाराम",
  tushar: "तुषार",
  uday: "उदय",
  vinod: "विनोद",
  vishal: "विशाल",
  vitthal: "विठ्ठल",
  yash: "यश",
  yogesh: "योगेश",

  // Women's given names.
  anita: "अनिता",
  archana: "अर्चना",
  asha: "आशा",
  bharati: "भारती",
  jyoti: "ज्योती",
  kavita: "कविता",
  lata: "लता",
  madhuri: "माधुरी",
  manisha: "मनीषा",
  meera: "मीरा",
  nanda: "नंदा",
  neha: "नेहा",
  pooja: "पूजा",
  priya: "प्रिया",
  radha: "राधा",
  rekha: "रेखा",
  sarika: "सारिका",
  savita: "सविता",
  seema: "सीमा",
  shalini: "शालिनी",
  sheetal: "शीतल",
  smita: "स्मिता",
  sunita: "सुनीता",
  swati: "स्वाती",
  ujwala: "उज्ज्वला",
  vaishali: "वैशाली",
  vandana: "वंदना",

  // Names where the rules land on a short vowel and the real name has a long
  // one — the one thing English spelling can never tell us.
  dhanraj: "धनराज",
  bhimrao: "भीमराव",
  tanaji: "तानाजी",
  sopan: "सोपान",
  namdev: "नामदेव",
  rupali: "रुपाली",
  wadekar: "वडेकर",
  ombase: "ओंबासे",
  bhalerao: "भालेराव",
  kshirsagar: "क्षीरसागर",
  tatyasaheb: "तात्यासाहेब",
  bhaurao: "भाऊराव",
  dagdu: "दगडू",
  hanumant: "हनुमंत",
  kondiba: "कोंडिबा",
  maruti: "मारुती",
  rakhamaji: "रखमाजी",
  sakharam: "साखरम",
  shamrao: "शामराव",
  tatya: "तात्या",
  vasant: "वसंत",
  yeshwant: "यशवंत",
  babasaheb: "बाबासाहेब",
  jijabai: "जिजाबाई",
  laxmi: "लक्ष्मी",
  parvati: "पार्वती",
  saraswati: "सरस्वती",
  shantabai: "शांताबाई",
  sindhu: "सिंधू",
  yamuna: "यमुना",

  // Honorifics and connectors that appear inside names.
  shri: "श्री",
  smt: "सौ",
  sau: "सौ",
  kum: "कु",
  dr: "डॉ",
  bin: "बिन",
};

/** Independent vowels, used when a word or syllable starts with one. */
const VOWEL_LETTER: Record<string, string> = {
  a: "अ", aa: "आ", i: "इ", ee: "ई", ii: "ई", u: "उ", oo: "ऊ",
  e: "ए", ai: "ऐ", o: "ओ", au: "औ",
};

/** The matching dependent signs, used after a consonant. */
const VOWEL_SIGN: Record<string, string> = {
  a: "", aa: "ा", i: "ि", ee: "ी", ii: "ी", u: "ु", oo: "ू",
  e: "े", ai: "ै", o: "ो", au: "ौ",
};

/** Longest-first, so "chh" is tried before "ch" and "ch" before "c". */
const CONSONANTS: [string, string][] = [
  ["chh", "छ"], ["shh", "ष"], ["ksh", "क्ष"], ["dny", "ज्ञ"], ["gn", "ज्ञ"],
  ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"], ["th", "थ"],
  ["dh", "ध"], ["ph", "फ"], ["bh", "भ"], ["sh", "श"],
  ["k", "क"], ["g", "ग"], ["c", "क"], ["j", "ज"], ["t", "त"], ["d", "द"],
  ["n", "न"], ["p", "प"], ["b", "ब"], ["m", "म"], ["y", "य"], ["r", "र"],
  ["l", "ल"], ["v", "व"], ["w", "व"], ["s", "स"], ["h", "ह"], ["f", "फ"],
  ["z", "झ"], ["q", "क"], ["x", "क्स"],
];

/** Longest-first for vowels too, so "aa" beats "a" and "ai" beats "a". */
const VOWELS = ["aa", "ai", "au", "ee", "ii", "oo", "a", "i", "u", "e", "o"];

function matchAt(word: string, i: number, keys: string[]): string | null {
  for (const k of keys) if (word.startsWith(k, i)) return k;
  return null;
}

const CONSONANT_KEYS = CONSONANTS.map(([k]) => k);
const CONSONANT_MAP = new Map(CONSONANTS);

/**
 * Rule-based fallback for a name not in KNOWN.
 *
 * Two rules do most of the work and are worth naming, because they are what the
 * libraries get wrong. A nasal before another consonant becomes an anusvara, so
 * "shinde" is शिंदे rather than शिन्दे. And a word never ends in an explicit
 * halant: Marathi writes रमेश, not रमेश्, even though the final अ is silent.
 */
/**
 * A nasal is only nasalised before a stop. Before r, y, w, l, h or a sibilant
 * it is a full consonant: "Dhanraj" is धनराज, not धंरज, and "Namdev" is नामदेव,
 * not नंदेव.
 */
const NASALISE_BEFORE = new Set([
  "k", "g", "c", "j", "t", "d", "p", "b",
  "kh", "gh", "ch", "jh", "th", "dh", "ph", "bh",
]);

/** y, w and r after a consonant form a cluster: "tya" is त्या, "shwi" is श्वि. */
const CLUSTER_SECOND = new Set(["y", "w", "r"]);

/**
 * ...but only after a stop or sibilant. A nasal or a glide keeps its own vowel:
 * "Dhanraj" is धनराज not धन्रज, and "Jaywant" is जयवंत not जय्वंत.
 */
const NO_CLUSTER_FIRST = new Set(["n", "m", "y", "w", "r", "h", "l"]);

function transliterateWord(raw: string): string {
  // "-rao" is a Marathi name ending, and the vowels in it are long: Bhalerao
  // is भालेराव. Spelling it as "raav" lets the ordinary rules produce that.
  const word = raw.replace(/ao\b/g, "aav");

  let out = "";
  let i = 0;
  let atStart = true;

  while (i < word.length) {
    const v = matchAt(word, i, VOWELS);
    const c = matchAt(word, i, CONSONANT_KEYS);

    // A vowel here means either the start of the word (independent form) or a
    // vowel with no consonant before it, which also takes the independent form.
    if (v && (atStart || !out)) {
      out += VOWEL_LETTER[v];
      i += v.length;
      atStart = false;
      continue;
    }
    if (v) {
      // A name ending in -i takes the long ी: Tanaji is तनाजी, not तनजि.
      const atEnd = i + v.length === word.length;
      out += atEnd && v === "i" ? "ी" : VOWEL_SIGN[v];
      i += v.length;
      continue;
    }

    if (!c) {
      // Punctuation or a letter with no mapping: keep it rather than drop it.
      out += word[i];
      i += 1;
      continue;
    }

    i += c.length;
    atStart = false;

    // n/m directly before another consonant is a nasalised vowel, not a
    // consonant cluster: shinde -> शिंदे, sanket -> संकेत, mangesh -> मंगेश.
    if ((c === "n" || c === "m") && out) {
      const next = matchAt(word, i, VOWELS)
        ? null
        : matchAt(word, i, CONSONANT_KEYS);
      if (next && NASALISE_BEFORE.has(next)) {
        out += "ं";
        continue;
      }
    }

    out += CONSONANT_MAP.get(c) ?? "";

    // A y, w or r immediately followed by a vowel binds to this consonant as a
    // cluster, so the inherent 'a' is suppressed with a halant.
    const next = matchAt(word, i, CONSONANT_KEYS);
    if (
      next &&
      !NO_CLUSTER_FIRST.has(c) &&
      CLUSTER_SECOND.has(next) &&
      matchAt(word, i + next.length, VOWELS)
    ) {
      out += "्";
    }

    // A consonant with no vowel after it keeps its inherent 'a' — which in
    // Marathi orthography is written bare, not with a halant. Nothing to add.
  }

  return out;
}

/**
 * The name as it should appear on the receipt image.
 *
 * Word by word, so "Ramesh Patil" can hit KNOWN for both halves independently
 * and a single unusual surname does not force the whole name through the rules.
 */
export function toDevanagariName(name: string): string {
  if (!name) return name;
  // Already Marathi (or mixed): leave it exactly as the volunteer typed it.
  if (DEVANAGARI.test(name)) return name;

  return name
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s*$/.test(part)) return part;
      // Trailing punctuation travels with the word: "Patil," keeps its comma.
      const m = /^([^\p{L}]*)(.*?)([^\p{L}]*)$/u.exec(part);
      const [, lead, core, trail] = m ?? [, "", part, ""];
      if (!core) return part;
      const known = KNOWN[core.toLowerCase().replace(/\./g, "")];
      return lead + (known ?? transliterateWord(core.toLowerCase())) + trail;
    })
    .join("");
}
