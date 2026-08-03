/* Kairos — the intent taxonomy.
 *
 * Each intent names the house that rules the matter, the planet that signifies
 * it, and which afflictions actually matter for THAT kind of undertaking.
 *
 * This is the fidelity that separates Kairos from generic apps. "Mercury
 * retrograde" is not a universal veto: the tradition applies it to contracts,
 * purchases, messages and travel. Electing a wedding around it is a modern
 * invention. So `mercuryRetro` is a per-intent weight, not a global one.
 *
 * `sig` is the significator of the matter; `benefics`/`malefics` weighting and
 * the Moon's condition are handled by the scorer.
 */
(function (root) {
  'use strict';

  /* weight legend (multipliers applied to the shared rule set)
   *   moon          how much the Moon's own condition matters
   *   moonApplying  how much the Moon's next aspect matters
   *   voidVeto      penalty for acting under a void-of-course Moon
   *   sigCondition  how much the significator's dignity matters
   *   ascRuler      how much the Ascendant ruler's condition matters
   *   mercuryRetro  penalty if Mercury is retrograde
   *   marsAngular   penalty if Mars is on an angle
   *   saturnAngular penalty if Saturn is on an angle
   *   waxing        bonus for an increasing Moon (beginnings that should grow)
   */
  var INTENTS = [
    /* ---- work & money ------------------------------------------------- */
    { id: 'job_interview', group: 'work', label: 'Job interview', icon: '💼',
      house: 10, sig: 'Sun', ruler: 'houseRuler',
      w: { moon: 1.0, moonApplying: 1.2, voidVeto: 1.0, sigCondition: 1.2, ascRuler: 1.0,
        mercuryRetro: 0.8, marsAngular: 0.8, saturnAngular: 1.0, waxing: 1.0 },
      note: 'The 10th house rules reputation and being seen. Kairos favours a strong, visible significator and an applying Moon.' },

    { id: 'ask_raise', group: 'work', label: 'Ask for a raise', icon: '📈',
      house: 2, sig: 'Jupiter', ruler: 'houseRuler',
      w: { moon: 1.0, moonApplying: 1.3, voidVeto: 1.2, sigCondition: 1.2, ascRuler: 1.1,
        mercuryRetro: 0.6, marsAngular: 1.0, saturnAngular: 1.2, waxing: 1.2 },
      note: '2nd house of livelihood, with Jupiter for increase. A waxing Moon is traditionally asked for whenever something should grow.' },

    { id: 'sign_contract', group: 'work', label: 'Sign a contract', icon: '🖋️',
      house: 7, sig: 'Mercury', ruler: 'houseRuler',
      w: { moon: 1.1, moonApplying: 1.3, voidVeto: 1.5, sigCondition: 1.3, ascRuler: 1.0,
        mercuryRetro: 1.5, marsAngular: 1.0, saturnAngular: 1.1, waxing: 0.8 },
      note: 'Agreements are 7th-house matters and Mercury signifies the writing. This is one of the few intents where Mercury retrograde is a genuine traditional objection.' },

    { id: 'start_business', group: 'work', label: 'Start a business', icon: '🚀',
      house: 10, sig: 'Jupiter', ruler: 'ascRuler',
      w: { moon: 1.2, moonApplying: 1.2, voidVeto: 1.5, sigCondition: 1.1, ascRuler: 1.4,
        mercuryRetro: 0.9, marsAngular: 1.1, saturnAngular: 1.3, waxing: 1.4 },
      note: 'A true beginning: the Ascendant and its ruler describe the venture itself, and the Moon should be increasing in light.' },

    { id: 'launch_publish', group: 'work', label: 'Launch or publish', icon: '📣',
      house: 3, sig: 'Mercury', ruler: 'houseRuler',
      w: { moon: 1.1, moonApplying: 1.2, voidVeto: 1.4, sigCondition: 1.2, ascRuler: 1.1,
        mercuryRetro: 1.4, marsAngular: 0.9, saturnAngular: 1.1, waxing: 1.3 },
      note: '3rd house of communication and circulation, Mercury signifying the message itself.' },

    { id: 'ask_favour', group: 'work', label: 'Ask a favour', icon: '🤝',
      house: 11, sig: 'Venus', ruler: 'houseRuler',
      w: { moon: 1.2, moonApplying: 1.5, voidVeto: 1.3, sigCondition: 1.0, ascRuler: 0.9,
        mercuryRetro: 0.5, marsAngular: 1.0, saturnAngular: 1.1, waxing: 1.0 },
      note: '11th house of friends and benefactors. The Moon applying to a benefic is the classic signature of a request that is granted.' },

    /* ---- home & property ---------------------------------------------- */
    { id: 'sign_lease', group: 'home', label: 'Sign a lease', icon: '🔑',
      house: 4, sig: 'Saturn', ruler: 'houseRuler',
      w: { moon: 1.0, moonApplying: 1.1, voidVeto: 1.5, sigCondition: 1.2, ascRuler: 1.1,
        mercuryRetro: 1.4, marsAngular: 1.1, saturnAngular: 0.9, waxing: 0.9 },
      note: '4th house of land and dwelling; Saturn, unusually, is the natural significator of property and is not penalised for being angular here.' },

    { id: 'move_house', group: 'home', label: 'Move house', icon: '📦',
      house: 4, sig: 'Moon', ruler: 'houseRuler',
      w: { moon: 1.5, moonApplying: 1.2, voidVeto: 1.3, sigCondition: 1.1, ascRuler: 1.1,
        mercuryRetro: 1.1, marsAngular: 1.2, saturnAngular: 1.2, waxing: 1.2 },
      note: 'The Moon signifies both the household and movement, so its condition dominates.' },

    { id: 'big_purchase', group: 'home', label: 'Make a large purchase', icon: '💳',
      house: 2, sig: 'Venus', ruler: 'houseRuler',
      w: { moon: 1.0, moonApplying: 1.1, voidVeto: 1.3, sigCondition: 1.3, ascRuler: 1.0,
        mercuryRetro: 1.5, marsAngular: 1.1, saturnAngular: 1.1, waxing: 0.9 },
      note: 'Buying is a 2nd-house act. Mercury retrograde is traditionally cited for purchases specifically, alongside contracts and travel.' },

    { id: 'sell_something', group: 'home', label: 'Sell something', icon: '🏷️',
      house: 7, sig: 'Mercury', ruler: 'houseRuler',
      w: { moon: 1.1, moonApplying: 1.3, voidVeto: 1.4, sigCondition: 1.2, ascRuler: 1.2,
        mercuryRetro: 1.3, marsAngular: 1.0, saturnAngular: 1.1, waxing: 0.7 },
      note: 'You are the 1st house, the buyer is the 7th. A waning Moon suits letting go.' },

    /* ---- relationships ------------------------------------------------- */
    { id: 'first_date', group: 'love', label: 'First date', icon: '💫',
      house: 5, sig: 'Venus', ruler: 'houseRuler',
      w: { moon: 1.2, moonApplying: 1.4, voidVeto: 1.0, sigCondition: 1.4, ascRuler: 1.0,
        mercuryRetro: 0.4, marsAngular: 0.9, saturnAngular: 1.3, waxing: 1.2 },
      note: '5th house of pleasure and courtship, Venus signifying attraction. Saturn on an angle is the classic chill.' },

    { id: 'propose', group: 'love', label: 'Propose or commit', icon: '💍',
      house: 7, sig: 'Venus', ruler: 'houseRuler',
      w: { moon: 1.3, moonApplying: 1.5, voidVeto: 1.6, sigCondition: 1.5, ascRuler: 1.2,
        mercuryRetro: 0.6, marsAngular: 1.2, saturnAngular: 1.4, waxing: 1.3 },
      note: 'The most demanding election in the tradition: 7th house, Venus strong, Moon applying to a benefic, and emphatically not void.' },

    { id: 'hard_conversation', group: 'love', label: 'A difficult conversation', icon: '🗣️',
      house: 3, sig: 'Mercury', ruler: 'ascRuler',
      w: { moon: 1.3, moonApplying: 1.3, voidVeto: 0.8, sigCondition: 1.2, ascRuler: 1.2,
        mercuryRetro: 1.1, marsAngular: 1.5, saturnAngular: 1.0, waxing: 0.6 },
      note: 'Mars on an angle is the thing to avoid here above all else — it is the significator of the quarrel.' },

    { id: 'reconcile', group: 'love', label: 'Make peace', icon: '🕊️',
      house: 7, sig: 'Venus', ruler: 'houseRuler',
      w: { moon: 1.2, moonApplying: 1.5, voidVeto: 1.2, sigCondition: 1.4, ascRuler: 1.0,
        mercuryRetro: 0.7, marsAngular: 1.6, saturnAngular: 1.2, waxing: 1.1 },
      note: 'Venus joins what Mars divides; the election wants the first strong and the second quiet.' },

    /* ---- health & habits (advisory only) -------------------------------- */
    { id: 'elective_procedure', group: 'health', label: 'Elective procedure', icon: '🩺',
      house: 6, sig: 'Saturn', ruler: 'ascRuler', caution: 'medical',
      w: { moon: 1.6, moonApplying: 1.2, voidVeto: 1.3, sigCondition: 1.0, ascRuler: 1.5,
        mercuryRetro: 0.6, marsAngular: 1.8, saturnAngular: 1.2, waxing: 0.6 },
      note: 'The traditional caution is Mars angular and the Moon in the sign ruling the part of the body concerned. Never let a chart move a date your doctor has set.' },

    { id: 'start_treatment', group: 'health', label: 'Begin a treatment', icon: '💊',
      house: 6, sig: 'Moon', ruler: 'ascRuler', caution: 'medical',
      w: { moon: 1.6, moonApplying: 1.3, voidVeto: 1.2, sigCondition: 1.1, ascRuler: 1.4,
        mercuryRetro: 0.6, marsAngular: 1.2, saturnAngular: 1.3, waxing: 1.2 },
      note: 'A course of treatment is a beginning that should grow, so the Moon should be increasing.' },

    { id: 'start_regimen', group: 'health', label: 'Start a diet or training plan', icon: '🏃',
      house: 1, sig: 'Mars', ruler: 'ascRuler',
      w: { moon: 1.3, moonApplying: 1.1, voidVeto: 1.2, sigCondition: 1.1, ascRuler: 1.4,
        mercuryRetro: 0.4, marsAngular: 0.6, saturnAngular: 1.2, waxing: 1.3 },
      note: 'Your own body is the 1st house; Mars is wanted strong here rather than avoided.' },

    /* ---- travel & study ------------------------------------------------- */
    { id: 'start_journey', group: 'travel', label: 'Start a journey', icon: '🧳',
      house: 9, sig: 'Moon', ruler: 'houseRuler',
      w: { moon: 1.5, moonApplying: 1.2, voidVeto: 1.4, sigCondition: 1.1, ascRuler: 1.2,
        mercuryRetro: 1.4, marsAngular: 1.3, saturnAngular: 1.2, waxing: 1.1 },
      note: 'The Moon signifies the journey itself. Mercury retrograde is a traditional caution for travel specifically.' },

    { id: 'buy_ticket', group: 'travel', label: 'Book travel', icon: '🎫',
      house: 9, sig: 'Mercury', ruler: 'houseRuler',
      w: { moon: 0.9, moonApplying: 1.0, voidVeto: 1.1, sigCondition: 1.2, ascRuler: 0.9,
        mercuryRetro: 1.5, marsAngular: 0.8, saturnAngular: 1.0, waxing: 0.8 },
      note: 'Booking is a transaction about travel: Mercury governs both halves of it.' },

    { id: 'begin_study', group: 'travel', label: 'Begin a course of study', icon: '📚',
      house: 9, sig: 'Jupiter', ruler: 'houseRuler',
      w: { moon: 1.1, moonApplying: 1.1, voidVeto: 1.2, sigCondition: 1.3, ascRuler: 1.2,
        mercuryRetro: 0.9, marsAngular: 0.9, saturnAngular: 1.0, waxing: 1.3 },
      note: '9th house of learning, Jupiter of understanding; a waxing Moon for something meant to accumulate.' },

    /* ---- legal & official ------------------------------------------------ */
    { id: 'file_official', group: 'legal', label: 'File something official', icon: '🏛️',
      house: 10, sig: 'Saturn', ruler: 'houseRuler', caution: 'legal',
      w: { moon: 1.0, moonApplying: 1.2, voidVeto: 1.4, sigCondition: 1.2, ascRuler: 1.1,
        mercuryRetro: 1.4, marsAngular: 1.1, saturnAngular: 0.9, waxing: 1.0 },
      note: 'Institutions are Saturnine. Deadlines set by law always outrank the chart.' },

    { id: 'negotiate', group: 'legal', label: 'Negotiate', icon: '⚖️',
      house: 7, sig: 'Mercury', ruler: 'ascRuler',
      w: { moon: 1.2, moonApplying: 1.4, voidVeto: 1.5, sigCondition: 1.3, ascRuler: 1.4,
        mercuryRetro: 1.2, marsAngular: 1.4, saturnAngular: 1.1, waxing: 1.0 },
      note: 'You are the 1st, they are the 7th: Kairos wants your side stronger than theirs at the moment you begin.' }
  ];

  var BY_ID = {};
  INTENTS.forEach(function (i) { BY_ID[i.id] = i; });

  var GROUPS = [
    { id: 'work', label: 'Work & money', icon: '💼' },
    { id: 'home', label: 'Home & property', icon: '🏠' },
    { id: 'love', label: 'People', icon: '❤️' },
    { id: 'health', label: 'Body & habits', icon: '⚕️' },
    { id: 'travel', label: 'Travel & study', icon: '✈️' },
    { id: 'legal', label: 'Legal & official', icon: '🏛️' }
  ];

  var CAUTIONS = {
    medical: 'Kairos is not medical advice. Never delay, move or skip care your doctor has scheduled because of a chart.',
    legal: 'Kairos is not legal advice. Statutory and court deadlines always take precedence over an elected time.'
  };

  root.KIntents = { INTENTS: INTENTS, BY_ID: BY_ID, GROUPS: GROUPS, CAUTIONS: CAUTIONS,
    get: function (id) { return BY_ID[id] || null; },
    inGroup: function (g) { return INTENTS.filter(function (i) { return i.group === g; }); } };
})(typeof self !== 'undefined' ? self : this);
