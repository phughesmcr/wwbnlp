/**
 * Port of the WWBP/DLATK message preprocessing and Happier Fun Tokenizer (HFT,
 * C. Potts 2011, updated by H. A. Schwartz and M. Sap; CC BY-NC-SA 3.0), pinned
 * in data/provenance.json. Python's Unicode `\s`, `\w` and `\d` are reproduced
 * exactly; differences are documented in docs/research.md.
 */
const SPACE = String.raw`\t-\r\x1c-\x20\x85\xa0  -     　`;
const S = `[${SPACE}]`;
const W = String.raw`\p{L}\p{N}_`;
const D = String.raw`\p{Nd}`;
const EMOTICON = [
  String.raw`[<>]?[:;=8>][\-o*']?[)\](\[dDpPxX/:}{@|\\]`, // eyes, nose, mouth
  String.raw`[)\](\[dDpPxX/:}{@|\\][\-o*']?[:;=8<][<>]?`, // mouth, nose, eyes
  String.raw`<[/\\]?3`, // hearts
  String.raw`\(?\(?#?[>\-^*+o~][_.|oO,][<\-^*+o~][#;]?\)?\)?`, // eye, nose, eye
].join("|");
// HFT order matters: phone numbers may contain whitespace, the final element
// is the last-ditch whitespace split.
const PARTS = [
  String
    .raw`(?:\+?[01][\-${SPACE}.]*)?(?:\(?${D}{3}[\-${SPACE}.)]*)?${D}{3}[\-${SPACE}.]*${D}{4}`,
  EMOTICON,
  String
    .raw`(?:https?:\/\/)?(?:[${W}\-]+\.)+(?:com|net|gov|edu|info|org|ly|be|gl|co|gs|pr|me|cc|us|gd|nl|ws|am|im|fm|kr|to|jp|sg)(?:\/[${SPACE}\x08$])?`,
  String.raw`https?:\/\/`,
  String.raw`\[[${W}]+\]`,
  String.raw`\/[${W}]+\?(?:;?[${W}]+=[${W}]+)+`,
  String
    .raw`<[^>]+[${W}]=[^>]+>|<[^>]+${S}\/>|<[^>${SPACE}]+>?|<?[^<${SPACE}]+>`,
  String.raw`@[${W}]+`,
  String.raw`#+[${W}]+[${W}'\-]*[${W}]+`,
  String.raw`[${W}][${W}'\-]+[${W}]`,
  String.raw`[+\-]?${D}+[,/.:\-]${D}+[+\-]?`,
  String.raw`[${W}]+`,
  String.raw`\.(?:${S}*\.)+`,
  `[^${SPACE}]`,
];
const WORD = new RegExp(PARTS.map((p) => `(?:${p})`).join("|"), "giu");
const NEWLINES = new RegExp(`${S}*\\n${S}*`, "gu");
const MULTI_SPACE = new RegExp(`${S}${S}+`, "gu");
const START_SPACE = new RegExp(`^${S}+`, "u");
const END_SPACE = new RegExp(`${S}+$`, "u");
const SPLIT_SPACE = new RegExp(`${S}+`, "u");
const LONE_SURROGATE = /\p{Cs}/u;
// Python's html.entities.name2codepoint (HTML 4.01), as name:hex pairs.
const ENTITY_DATA = [
  "AElig:c6,Aacute:c1,Acirc:c2,Agrave:c0,Alpha:391,Aring:c5,Atilde:c3,",
  "Auml:c4,Beta:392,Ccedil:c7,Chi:3a7,Dagger:2021,Delta:394,ETH:d0,",
  "Eacute:c9,Ecirc:ca,Egrave:c8,Epsilon:395,Eta:397,Euml:cb,Gamma:393,",
  "Iacute:cd,Icirc:ce,Igrave:cc,Iota:399,Iuml:cf,Kappa:39a,Lambda:39b,",
  "Mu:39c,Ntilde:d1,Nu:39d,OElig:152,Oacute:d3,Ocirc:d4,Ograve:d2,",
  "Omega:3a9,Omicron:39f,Oslash:d8,Otilde:d5,Ouml:d6,Phi:3a6,Pi:3a0,",
  "Prime:2033,Psi:3a8,Rho:3a1,Scaron:160,Sigma:3a3,THORN:de,Tau:3a4,",
  "Theta:398,Uacute:da,Ucirc:db,Ugrave:d9,Upsilon:3a5,Uuml:dc,Xi:39e,",
  "Yacute:dd,Yuml:178,Zeta:396,aacute:e1,acirc:e2,acute:b4,aelig:e6,",
  "agrave:e0,alefsym:2135,alpha:3b1,amp:26,and:2227,ang:2220,aring:e5,",
  "asymp:2248,atilde:e3,auml:e4,bdquo:201e,beta:3b2,brvbar:a6,bull:2022,",
  "cap:2229,ccedil:e7,cedil:b8,cent:a2,chi:3c7,circ:2c6,clubs:2663,",
  "cong:2245,copy:a9,crarr:21b5,cup:222a,curren:a4,dArr:21d3,",
  "dagger:2020,darr:2193,deg:b0,delta:3b4,diams:2666,divide:f7,",
  "eacute:e9,ecirc:ea,egrave:e8,empty:2205,emsp:2003,ensp:2002,",
  "epsilon:3b5,equiv:2261,eta:3b7,eth:f0,euml:eb,euro:20ac,exist:2203,",
  "fnof:192,forall:2200,frac12:bd,frac14:bc,frac34:be,frasl:2044,",
  "gamma:3b3,ge:2265,gt:3e,hArr:21d4,harr:2194,hearts:2665,hellip:2026,",
  "iacute:ed,icirc:ee,iexcl:a1,igrave:ec,image:2111,infin:221e,int:222b,",
  "iota:3b9,iquest:bf,isin:2208,iuml:ef,kappa:3ba,lArr:21d0,lambda:3bb,",
  "lang:2329,laquo:ab,larr:2190,lceil:2308,ldquo:201c,le:2264,",
  "lfloor:230a,lowast:2217,loz:25ca,lrm:200e,lsaquo:2039,lsquo:2018,",
  "lt:3c,macr:af,mdash:2014,micro:b5,middot:b7,minus:2212,mu:3bc,",
  "nabla:2207,nbsp:a0,ndash:2013,ne:2260,ni:220b,not:ac,notin:2209,",
  "nsub:2284,ntilde:f1,nu:3bd,oacute:f3,ocirc:f4,oelig:153,ograve:f2,",
  "oline:203e,omega:3c9,omicron:3bf,oplus:2295,or:2228,ordf:aa,ordm:ba,",
  "oslash:f8,otilde:f5,otimes:2297,ouml:f6,para:b6,part:2202,",
  "permil:2030,perp:22a5,phi:3c6,pi:3c0,piv:3d6,plusmn:b1,pound:a3,",
  "prime:2032,prod:220f,prop:221d,psi:3c8,quot:22,rArr:21d2,radic:221a,",
  "rang:232a,raquo:bb,rarr:2192,rceil:2309,rdquo:201d,real:211c,reg:ae,",
  "rfloor:230b,rho:3c1,rlm:200f,rsaquo:203a,rsquo:2019,sbquo:201a,",
  "scaron:161,sdot:22c5,sect:a7,shy:ad,sigma:3c3,sigmaf:3c2,sim:223c,",
  "spades:2660,sub:2282,sube:2286,sum:2211,sup:2283,sup1:b9,sup2:b2,",
  "sup3:b3,supe:2287,szlig:df,tau:3c4,there4:2234,theta:3b8,",
  "thetasym:3d1,thinsp:2009,thorn:fe,tilde:2dc,times:d7,trade:2122,",
  "uArr:21d1,uacute:fa,uarr:2191,ucirc:fb,ugrave:f9,uml:a8,upsih:3d2,",
  "upsilon:3c5,uuml:fc,weierp:2118,xi:3be,yacute:fd,yen:a5,yuml:ff,",
  "zeta:3b6,zwj:200d,zwnj:200c",
].join("");
let entities: Map<string, number> | undefined;
function entity(name: string): number | undefined {
  entities ??= new Map(
    ENTITY_DATA.split(",").map((pair) => {
      const [key, hex] = pair.split(":");
      return [key!, parseInt(hex!, 16)];
    }),
  );
  return entities.get(name);
}
const DIGIT = /\p{Nd}/u;
/** Decimal value of a Unicode digit, as Python's int(). Unicode encodes each
 * script's digits 0-9 contiguously, so runs of digits start at a zero. */
function digitValue(digit: string): number {
  let code = digit.codePointAt(0)!;
  const start = code;
  while (DIGIT.test(String.fromCodePoint(code - 1))) code--;
  return (start - code) % 10;
}
function html2unicode(s: string): string {
  for (const ent of new Set(s.match(/&#\p{Nd}+;/gu) ?? [])) {
    let code = 0;
    for (const digit of ent.slice(2, -1)) code = code * 10 + digitValue(digit);
    try {
      s = s.replaceAll(ent, String.fromCodePoint(code));
    } catch { /* out-of-range code points are left unchanged, as in HFT */ }
  }
  const named = new Set(s.match(/&[\p{L}\p{N}_]+;/gu) ?? []);
  named.delete("&amp;");
  for (const ent of named) {
    const code = entity(ent.slice(1, -1));
    if (code !== undefined) s = s.replaceAll(ent, String.fromCodePoint(code));
    // HFT replaces &amp; inside this loop: only when another named entity exists.
    s = s.replaceAll("&amp;", " and ");
  }
  return s;
}
/**
 * Tokenize one message as WWBP/DLATK did: newlines become `<newline>`, spaces
 * and runs of five or more dots shrink, HTML entities are decoded, then HFT
 * tokens are lowercased. Tokens may contain spaces (e.g. `. . .`).
 */
export function tokenize(text: string): string[] {
  if (typeof text !== "string") throw new TypeError("text must be a string");
  let s = text.replace(NEWLINES, " <NEWLINE> ").replace(MULTI_SPACE, " ")
    .replace(/\.\.\.\.\.+/g, "....").replace(END_SPACE, "")
    .replace(START_SPACE, "").replace(NEWLINES, " <NEWLINE> ");
  s = html2unicode(s).replace(/\\x[0-9a-z]{1,4}/g, " ");
  return (s.match(WORD) ?? []).map((token) =>
    token.split(SPLIT_SPACE).filter(Boolean).map((w) =>
      LONE_SURROGATE.test(w) ? "<NON-UTF8>" : w
    ).join(" ").toLowerCase()
  );
}
