// Plain-language guidance shown alongside the risk level on the Home
// page. This is general flood-preparedness advice keyed to the model's
// next-day risk tier - it is NOT an official evacuation order. The copy
// deliberately says "forecast"/"be ready", never "evacuate now".

export const RISK_GUIDANCE = {
  Low: {
    headline: "No flood risk expected for tomorrow.",
    steps: [
      "No action needed. Conditions look normal for your area.",
      "It's still worth knowing your nearest safe high ground.",
    ],
  },
  Medium: {
    headline: "A moderate flood risk is forecast. Stay alert.",
    steps: [
      "Check for official updates from the Disaster Management Centre.",
      "Move important documents and valuables above floor level.",
      "Keep your phone charged and agree a meeting point with your family.",
    ],
  },
  High: {
    headline: "A high flood risk is forecast for tomorrow. Prepare now.",
    steps: [
      "Pack an emergency bag: documents, medicine, water, torch, power bank.",
      "Move vehicles and valuables to higher ground.",
      "Know your evacuation route and your nearest safe centre.",
      "Follow DMC and local authority instructions closely.",
    ],
  },
  "Very High": {
    headline: "A critical flood risk is forecast. Be ready to move.",
    steps: [
      "Be ready to leave at short notice — keep your emergency bag by the door.",
      "Move to higher ground early if your area has flooded before.",
      "Do not walk or drive through floodwater.",
      "Act on official evacuation instructions immediately — do not wait.",
    ],
  },
};

export const EMERGENCY_CONTACTS = [
  { label: "Disaster Management Centre (DMC)", number: "117" },
  { label: "Ambulance (1990 Suwa Seriya)", number: "1990" },
  { label: "Police emergency", number: "119" },
  { label: "Government Information Center", number: "1919" },
];

export const guidanceFor = (normalizedRisk) =>
  RISK_GUIDANCE[normalizedRisk] || RISK_GUIDANCE.Low;

// Standing, risk-independent precaution guide for the dedicated Safety
// page - what to do before, during, and after a flood. Unlike
// RISK_GUIDANCE this isn't keyed to a forecast tier; it's the general
// reference a resident can read at any time.
export const PRECAUTION_SECTIONS = [
  {
    id: "before",
    title: "Before a flood",
    intro: "Preparing ahead of time is the biggest factor in staying safe.",
    items: [
      "Know your area's flood history and identify the nearest safe high ground.",
      "Prepare an emergency kit (see checklist below) and keep it somewhere easy to grab.",
      "Keep important documents (ID, deeds, insurance) in a waterproof bag or plastic folder.",
      "Agree on a family meeting point and an out-of-area contact everyone can reach.",
      "Save the Disaster Management Centre hotline (117) and your local authority's number.",
      "Charge your phone and any power banks whenever heavy rain is forecast.",
      "Check that gutters and drains near your home are clear of debris.",
    ],
  },
  {
    id: "during",
    title: "During a flood",
    intro: "If floodwater is rising near you, act early and don't wait for it to reach your door.",
    items: [
      "Move to higher ground or an upper floor as soon as you're told to, or as soon as water starts rising.",
      "Turn off electricity and gas at the mains if it's safe to reach them.",
      "Never walk or drive through moving floodwater — 15cm of fast water can knock an adult over.",
      "Avoid contact with floodwater where possible; it can be contaminated with sewage or chemicals.",
      "Keep your emergency kit and phone with you at all times.",
      "Listen to the radio, DMC updates, or local authority announcements for evacuation instructions.",
      "If trapped, move to the highest available point and call 117 or 119 for rescue.",
    ],
  },
  {
    id: "after",
    title: "After a flood",
    intro: "Floodwater can leave hazards behind even after it recedes — take care returning home.",
    items: [
      "Don't return home until local authorities confirm it's safe.",
      "Avoid floodwater and mud — treat any cuts or wounds promptly to prevent infection.",
      "Have your electricity and gas supply checked by a professional before switching them back on.",
      "Boil or treat drinking water until you're told the local supply is safe again.",
      "Photograph any damage for insurance before you start cleaning up.",
      "Watch for structural damage, loose wiring, and displaced wildlife (snakes) in and around the home.",
      "Check on elderly or vulnerable neighbours who may need help recovering.",
    ],
  },
];

// A starter emergency kit checklist. Kept separate from PRECAUTION_SECTIONS
// so the Safety page can render it as interactive checkboxes rather than a
// plain list.
export const EMERGENCY_KIT_ITEMS = [
  "Drinking water (at least 3 litres per person)",
  "Non-perishable food (2-3 days' supply)",
  "Torch and spare batteries",
  "Power bank, fully charged",
  "First-aid kit and regular medication",
  "Copies of ID, insurance, and other important documents (in a waterproof bag)",
  "Cash (ATMs and cards may not work during a flood)",
  "Whistle, to signal for help",
  "Change of clothes and a raincoat",
  "Any essentials for infants, elderly family members, or pets",
];
