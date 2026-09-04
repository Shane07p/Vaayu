/**
 * What to do about a reading, per CPCB band, in the reader's language.
 *
 * The reason this file exists, rather than a colour and a number:
 *
 *   49.6% of Indians who take no action against air pollution give the reason
 *   "I'm not aware of what action to take -- if I knew, I would act."
 *   (CMSR Consultants / ASAR, n = 5,000 across 17 cities. See docs/EVIDENCE.md
 *   §1.1.)
 *
 * Not apathy, and not disbelief. A missing instruction. Sixty years of
 * fear-appeal research says the same thing from the other direction: severity
 * information *without* a concrete, achievable instruction produces denial and
 * avoidance rather than protection (EVIDENCE §1.2). A large red 428 on its own
 * is not neutral, it is counterproductive.
 *
 * So every figure this application shows is accompanied by a sentence saying
 * what to do about it. That is the whole design rule.
 *
 * WHY THIS IS STATIC AND NOT GENERATED
 *
 * The application has a Gemini pipeline that writes grounded prose in eight
 * languages, and it would happily write these. It must not. This sentence is
 * the safety-critical one: it has to appear instantly, offline, on the twenty-
 * first request of the day when the free tier returns 429, and identically for
 * every reader in the same band. Generation is for elaboration -- the "explain
 * this" layer -- never for the primary instruction.
 *
 * HOW STRONG THE EVIDENCE IS
 *
 * Weaker than the presentation implies, and the wording is chosen accordingly.
 * A European Respiratory Society review of personal protective strategies
 * against air pollution states plainly that "the quality of the evidence is
 * lacking overall for many interventions" (EVIDENCE §3.4). These are therefore
 * written as ordinary practical suggestions -- shorten the run, shut the window,
 * wear the mask -- and never as clinical instruction or as a claim about
 * outcomes. Nothing here diagnoses, and nothing promises a benefit.
 *
 * TRANSLATION STATUS
 *
 * The Hindi and Punjabi below are machine-written and have NOT been reviewed by
 * a native speaker. That is acceptable for a demonstration and is not acceptable
 * for anything a person might act on. Health guidance in a language nobody on
 * the team can read is exactly the kind of unchecked claim this project refuses
 * elsewhere, so this needs review before any real deployment.
 */

import type { BandKey } from "./aqi-band";

/**
 * Who the advice is for.
 *
 * Two audiences, not six. "sensitive" covers the groups CPCB itself singles out
 * -- asthma and COPD, heart conditions, pregnancy, young children, the elderly
 * -- because the practical advice for them is the same at every band, and
 * splitting it further would imply a precision the evidence does not support.
 * Outdoor workers are a genuinely distinct case with different needs (shift
 * timing rather than avoidance) and are deliberately left for their own surface
 * rather than squeezed in here. See docs/PLAN.md task B5.
 */
export type Audience = "everyone" | "sensitive";

export type Language = "en" | "hi" | "pa";

type BandCopy = { name: string; everyone: string; sensitive: string };

const GUIDANCE: Record<Language, Record<BandKey, BandCopy>> = {
  en: {
    good: {
      name: "Good",
      everyone: "Clean air today. A good day to be outside.",
      sensitive: "No precautions needed today.",
    },
    satisfactory: {
      name: "Satisfactory",
      everyone: "Fine to be outside today.",
      sensitive: "Carry your inhaler if you use one.",
    },
    moderate: {
      name: "Moderate",
      everyone: "Fine for a walk. Keep hard exercise outdoors short.",
      sensitive: "Take it easy outdoors, and keep your inhaler with you.",
    },
    poor: {
      name: "Poor",
      everyone: "Avoid hard exercise outdoors. Shut windows facing traffic.",
      sensitive: "Keep outdoor time short. Don't exercise outside today.",
    },
    veryPoor: {
      name: "Very Poor",
      everyone: "Stay indoors where you can. Wear an N95 if you're out for long.",
      sensitive: "Stay indoors. Wear an N95 if you have to go out.",
    },
    severe: {
      name: "Severe",
      everyone: "Avoid going out. Keep windows shut. Wear an N95 outdoors.",
      sensitive: "Stay indoors. If breathing becomes difficult, get medical help.",
    },
  },
  hi: {
    good: {
      name: "अच्छा",
      everyone: "आज हवा साफ़ है। बाहर निकलने के लिए अच्छा दिन है।",
      sensitive: "आज किसी सावधानी की ज़रूरत नहीं।",
    },
    satisfactory: {
      name: "संतोषजनक",
      everyone: "आज बाहर रहना ठीक है।",
      sensitive: "अगर आप इनहेलर लेते हैं तो साथ रखें।",
    },
    moderate: {
      name: "मध्यम",
      everyone: "टहलना ठीक है। बाहर कड़ी कसरत कम रखें।",
      sensitive: "बाहर आराम से रहें और इनहेलर साथ रखें।",
    },
    poor: {
      name: "खराब",
      everyone: "बाहर कड़ी कसरत न करें। सड़क की तरफ़ की खिड़कियाँ बंद रखें।",
      sensitive: "बाहर कम समय बिताएँ। आज बाहर कसरत न करें।",
    },
    veryPoor: {
      name: "बहुत खराब",
      everyone: "हो सके तो घर के अंदर रहें। देर तक बाहर हों तो N95 पहनें।",
      sensitive: "घर के अंदर रहें। बाहर जाना पड़े तो N95 पहनें।",
    },
    severe: {
      name: "गंभीर",
      everyone: "बाहर जाने से बचें। खिड़कियाँ बंद रखें। बाहर N95 पहनें।",
      sensitive: "घर के अंदर रहें। साँस लेने में दिक्कत हो तो डॉक्टर से मिलें।",
    },
  },
  pa: {
    good: {
      name: "ਚੰਗਾ",
      everyone: "ਅੱਜ ਹਵਾ ਸਾਫ਼ ਹੈ। ਬਾਹਰ ਜਾਣ ਲਈ ਚੰਗਾ ਦਿਨ ਹੈ।",
      sensitive: "ਅੱਜ ਕਿਸੇ ਸਾਵਧਾਨੀ ਦੀ ਲੋੜ ਨਹੀਂ।",
    },
    satisfactory: {
      name: "ਤਸੱਲੀਬਖ਼ਸ਼",
      everyone: "ਅੱਜ ਬਾਹਰ ਰਹਿਣਾ ਠੀਕ ਹੈ।",
      sensitive: "ਜੇ ਤੁਸੀਂ ਇਨਹੇਲਰ ਲੈਂਦੇ ਹੋ ਤਾਂ ਨਾਲ ਰੱਖੋ।",
    },
    moderate: {
      name: "ਦਰਮਿਆਨਾ",
      everyone: "ਸੈਰ ਠੀਕ ਹੈ। ਬਾਹਰ ਸਖ਼ਤ ਕਸਰਤ ਘੱਟ ਰੱਖੋ।",
      sensitive: "ਬਾਹਰ ਆਰਾਮ ਨਾਲ ਰਹੋ ਅਤੇ ਇਨਹੇਲਰ ਨਾਲ ਰੱਖੋ।",
    },
    poor: {
      name: "ਮਾੜਾ",
      everyone: "ਬਾਹਰ ਸਖ਼ਤ ਕਸਰਤ ਨਾ ਕਰੋ। ਸੜਕ ਵਾਲੇ ਪਾਸੇ ਦੀਆਂ ਖਿੜਕੀਆਂ ਬੰਦ ਰੱਖੋ।",
      sensitive: "ਬਾਹਰ ਘੱਟ ਸਮਾਂ ਬਿਤਾਓ। ਅੱਜ ਬਾਹਰ ਕਸਰਤ ਨਾ ਕਰੋ।",
    },
    veryPoor: {
      name: "ਬਹੁਤ ਮਾੜਾ",
      everyone: "ਹੋ ਸਕੇ ਤਾਂ ਘਰ ਅੰਦਰ ਰਹੋ। ਦੇਰ ਤੱਕ ਬਾਹਰ ਹੋਵੋ ਤਾਂ N95 ਪਾਓ।",
      sensitive: "ਘਰ ਅੰਦਰ ਰਹੋ। ਬਾਹਰ ਜਾਣਾ ਪਵੇ ਤਾਂ N95 ਪਾਓ।",
    },
    severe: {
      name: "ਗੰਭੀਰ",
      everyone: "ਬਾਹਰ ਜਾਣ ਤੋਂ ਬਚੋ। ਖਿੜਕੀਆਂ ਬੰਦ ਰੱਖੋ। ਬਾਹਰ N95 ਪਾਓ।",
      sensitive: "ਘਰ ਅੰਦਰ ਰਹੋ। ਸਾਹ ਲੈਣ ਵਿੱਚ ਔਖ ਹੋਵੇ ਤਾਂ ਡਾਕਟਰ ਨੂੰ ਮਿਲੋ।",
    },
  },
};

/** The CPCB band's name, in the reader's language. */
export const bandName = (band: BandKey, language: Language): string =>
  GUIDANCE[language][band].name;

/** What to do about this band, for this reader. Never empty. */
export const adviceFor = (
  band: BandKey,
  language: Language,
  audience: Audience = "everyone",
): string => GUIDANCE[language][band][audience];
