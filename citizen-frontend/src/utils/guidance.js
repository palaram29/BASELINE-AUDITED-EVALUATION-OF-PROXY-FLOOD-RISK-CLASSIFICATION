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
