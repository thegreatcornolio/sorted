import type { Transcript } from "./types";

type Line = { speaker: "Agent" | "Customer"; text: string };

const AGENTS = ["Aisha Khan", "James Adeyemi", "Helen Okonkwo", "Tom Becker", "Ruth Nkosi", "Sara Iqbal", "Mark Olsen", "David Pell"];

const COMPANIES = [
  "Halden and Rowe",
  "Keel Insurance",
  "Bramley Food Group",
  "Meridian Logistics",
  "Pinnacle Components",
  "Hart and Elm",
  "Lowther Retail Parks",
  "Northwharf Cold Store",
  "Quayline Ferries",
  "Calder Housing",
  "Fenwick Materials",
  "Arbour and Pine",
  "Vantage Manufacturing",
  "Redholt Hotels",
  "Sable Meeting Rooms",
  "Mallow and Finch",
  "Ironbridge Castings",
  "Brightpath Schools Trust",
  "Dornay Logistics",
  "Tern Facilities",
  "Aster Wealth",
  "Glasshouse Studios",
  "Pennycuick Bakeries",
  "Holt Engineering",
  "Nairn Biomedical",
  "Yarrow Print",
  "Peakline Haulage",
  "Elmwood Assets",
  "Bracken Leisure",
  "Ivo Maritime",
  "Rowan Legal",
  "Fieldgate Warehousing",
  "Cobalt Kitchens",
  "Harrow Clinics Group",
  "Larkspur Design",
  "Northgate Motors",
  "Pembroke Books",
  "Sable & Co Solicitors",
  "Westmill Dairies",
  "Orchard Hotels",
  "Kite Analytics",
  "Bridgewater Ports",
  "Amber Finance",
  "Stone & Clay",
  "Harbourlight Shipping",
  "Greenlane Couriers",
  "Pellham Architects",
  "Fox & Hare Retail",
  "Millhouse Bakers",
  "Atlas Surveys",
  "Cedar Clinics Admin",
  "Riverbank Housing",
  "Oakmont Law",
  "Summit Fit Clubs",
  "Beacon Schools Office",
  "Wren Logistics",
  "Copper Pot Catering",
  "Hilltop Surveyors",
  "Marlow Printworks",
  "Fable Toys",
  "Northstar Insurance",
  "Grove Accountants",
  "Lantern Hotels",
  "Swift Parcel",
  "Heath Ceramics",
  "Bold Street Retail",
  "Quietroom Studios",
  "Portside Fishmongers",
  "Elm Legal",
  "Kindred Care Offices",
  "Moorland Builds",
  "Paperkite Agency",
  "Redlane Coaches",
  "Silverfork Group",
  "Tidal Marine",
  "Upperton Stores",
  "Violet Labs Office",
  "Westcourt Chambers",
  "Yardley Packaging",
  "Zephyr Travel",
  "Ash & Oak Joinery",
  "Bramble Foods",
  "Cinder Hotels",
  "Dovetail Workshops",
  "Easton Freight",
  "Fern Accounting",
  "Gable Architects",
  "Hearth Kitchens",
  "Indigo Offices",
  "Jasper Media",
  "Kestrel Security",
  "Linden Care Group",
  "Maple Dental Group",
  "Nettle & Co",
  "Osprey Warehouses",
  "Plumline Catering",
  "Quarry Stone",
  "Reed & Birch",
  "Saffron Hotels",
  "Thorn Electrical",
  "Umber Studios",
  "Vale Transport",
  "Willow Clinics Office",
];

const CONTACTS = [
  "Oliver Grant", "Helen Marsh", "Chris Adeyemi", "Priya Raman", "Mark Ellison", "Sophie Hart", "Daniel Lowther",
  "Irene Kowalski", "Paul Quinn", "Rebecca Calder", "Anita Shah", "Lucy Arbour", "Owen Blake", "Claire Redholt",
  "Jon Sable", "Grace Mallow", "Hugh Ironbridge", "Nina Bright", "Evan Dornay", "Mohammed Tern", "Catherine Aster",
  "Ben Glass", "Fiona Pennycuick", "Simon Holt", "Lewis Nairn", "Alice Yarrow", "Gordon Peak", "Sarah Elmwood",
  "Tom Bracken", "Helena Ivo",
];

const ROLES = [
  "office manager", "finance manager", "operations lead", "IT lead", "managing director", "practice manager",
  "site manager", "head of operations",
];

const PLACES = [
  "London office", "Manchester studio", "Leeds warehouse", "Birmingham site", "Bristol office", "Cardiff office",
  "Glasgow depot", "Edinburgh office", "Newcastle office", "Oxford office", "Sheffield plant", "Nottingham office",
  "Cambridge office", "Liverpool office", "Aberdeen bakery", "Dover office",
];

function clock(index: number): string {
  const minutes = 7 * 60 + 40 + index * 4;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

function base(index: number, topic: string, queue: string, lines: Line[]): Transcript {
  const company = COMPANIES[index];
  return {
    id: `gl-${1001 + index}`,
    company,
    contact: CONTACTS[index % CONTACTS.length],
    role: ROLES[index % ROLES.length],
    place: PLACES[index % PLACES.length],
    queue,
    agent: AGENTS[index % AGENTS.length],
    callTime: clock(index),
    duration: `${5 + (index % 8)} min`,
    topic,
    lines,
  };
}

function talk(index: number, customer: string[]): Line[] {
  const name = CONTACTS[index % CONTACTS.length].split(" ")[0];
  const company = COMPANIES[index];
  const agent = AGENTS[index % AGENTS.length].split(" ")[0];
  const lines: Line[] = [
    { speaker: "Agent", text: `Gridline business fiber, ${agent} speaking.` },
    { speaker: "Customer", text: `Hello, it is ${name} at ${company}.` },
  ];
  customer.forEach((text, step) => {
    if (step > 0) {
      lines.push({ speaker: "Agent", text: "I have the account in front of me. Tell me a bit more." });
    }
    lines.push({ speaker: "Customer", text });
  });
  lines.push({ speaker: "Agent", text: "Thank you. I have noted that on the account." });
  return lines;
}

const NEGATIVE_AT: Record<number, { topic: string; queue: string; lines: string[] }> = {
  3: {
    topic: "Statement arrived too late, then a payment demand",
    queue: "Billing",
    lines: [
      "The statement for the London office arrived on the 28th, which was too late to pay before the due date. The money was sitting ready on the 14th.",
      "Your payments team then sent a demand for payment and said you might cut the office off. We pay when the bill actually arrives.",
    ],
  },
  7: {
    topic: "Office was down longer than promised",
    queue: "Support",
    lines: [
      "The Birmingham office was down from just after two in the morning. The team could not send orders out.",
      "That was longer than you promised. You said a fix would take about four hours, and we were dark for most of the morning.",
    ],
  },
  12: {
    topic: "Nobody arrived for the install",
    queue: "Installs",
    lines: [
      "This was the install for the new Sheffield plant.",
      "Nobody arrived in either window you booked. I sent the site team home twice, and we still have no line on the day we said we would open.",
    ],
  },
  16: {
    topic: "New office line still not live",
    queue: "Setup",
    lines: [
      "The Leeds line is three weeks late against the date you put on the order.",
      "It is still not live. The foundry is sharing a neighbour's connection, and that drops when their shift changes.",
    ],
  },
  20: {
    topic: "Account manager has not called back",
    queue: "Accounts",
    lines: [
      "I have called our account manager six times since the renewal papers went out.",
      "She didn't return a single one. Silence on a renewal is how you lose an office like ours.",
    ],
  },
  27: {
    topic: "Charged twice for the same bill",
    queue: "Billing",
    lines: [
      "You charged us twice for the March bill. The money left the account on the 4th and again on the 6th.",
      "Please put one of those payments back. We should not have to raise this twice.",
    ],
  },
  34: {
    topic: "Slow connection all week",
    queue: "Support",
    lines: [
      "The office has had a slow connection since Monday. Video calls drop and the tills time out.",
      "It has been unusable all week. This is not a busy-hour blip. The shop floor cannot work like this.",
    ],
  },
  41: {
    topic: "Promised callback never came",
    queue: "Support",
    lines: [
      "Yesterday your colleague said a manager would call me before lunch.",
      "The callback never came. I sat by the phone through two meetings and heard nothing.",
    ],
  },
  48: {
    topic: "Line was not ready for the office move",
    queue: "Installs",
    lines: [
      "This was the office move into the new Bristol floor. Staff arrived on Monday with nowhere to plug in.",
      "The line was not ready. We were told Friday it would be, and reception is still taking bookings on personal phones.",
    ],
  },
  56: {
    topic: "Passed between four people",
    queue: "Support",
    lines: [
      "I have been trying to sort a simple address change on the bill since Tuesday.",
      "Your team transferred me four times this morning. I still do not have one person who owns it.",
    ],
  },
  64: {
    topic: "Billed for a line that was never turned on",
    queue: "Billing",
    lines: [
      "You billed us the full monthly amount for the new Bristol line.",
      "That line was never turned on. There is no box on the wall and the office cannot use it.",
    ],
  },
  73: {
    topic: "Price went up with no warning",
    queue: "Accounts",
    lines: [
      "The renewal landed and the price went up by nine percent across our sites.",
      "We weren't told it was coming. A leisure group should not find that in the footer of a PDF.",
    ],
  },
  86: {
    topic: "Third visit and the line is still dropping",
    queue: "Support",
    lines: [
      "This is the third visit for the Glasgow depot. Each time the engineer says it is fixed.",
      "The line is still dropping the same evening. The night shift loses the job board and the trucks wait.",
    ],
  },
  91: {
    topic: "Bill still charges for closed sites",
    queue: "Billing",
    lines: [
      "The bill is wrong again this month.",
      "It still includes two sites we closed in August. Please take them off and credit what we have already paid.",
    ],
  },
  95: {
    topic: "Office cut off with no warning",
    queue: "Support",
    lines: [
      "You cut us off at 9 this morning. The whole reservations office went dark.",
      "There was no warning. No call, no email, nothing before the phones died.",
    ],
  },
};

const MILD_LINES = [
  "The line is back, but I would have liked a text before the team noticed it had dropped.",
  "The total is right. The bill is harder to read than it needs to be for a group with this many sites.",
  "It is not an outage. The office line is just a bit slow at busy times, and I want someone to look before the next busy morning.",
  "The office line itself is fine. The second login is not yet enabled, and we asked for that last week.",
  "The change is done. I was on hold for nine minutes before anyone picked up a simple request.",
  "The office is working this morning. I am still cautious until we see a full week without another drop.",
];

const MILD_TOPICS = [
  "Outage fixed, but nobody warned the office",
  "Bill is hard to read",
  "Connection a bit slow when the office is busy",
  "Second login still not switched on",
  "Long wait on hold",
  "Not sure yesterday's fix will hold",
];

const ONE_LINE = [
  "It was ready on the day you promised. The office opened without a hitch.",
  "I am really pleased with the way your team handled it.",
  "That was excellent from start to finish.",
  "The work went smoothly and the team were online before nine.",
  "We will renew. The service has been steady all year.",
  "Spot on. The office opened on time.",
  "We signed off this morning. Please send the notes to finance.",
  "We will go ahead with the extra office.",
];

const TWO_LINES: [string, string][] = [
  ["The work went smoothly.", "I am really pleased."],
  ["It was ready on the day you promised.", "That was excellent."],
  ["We signed off this morning.", "We will renew."],
  ["Spot on.", "We will go ahead with the next office."],
];

const CALM_LINES = [
  "I appreciate the update. That all makes sense.",
  "That all makes sense. I appreciate the update.",
];

const MIXED_AT = new Set([2, 6, 10, 15, 19, 24, 29, 33, 38, 44, 52, 59, 66, 74, 81, 89, 93, 97]);

function positiveLines(index: number): { topic: string; lines: string[] } {
  const mode = index % 3;
  if (mode === 0) {
    const pair = TWO_LINES[index % TWO_LINES.length];
    return { topic: "Clean result for the office", lines: [pair[0], pair[1]] };
  }
  if (mode === 1) {
    return { topic: "Office happy with the result", lines: [ONE_LINE[index % ONE_LINE.length]] };
  }
  return { topic: "Straightforward update, customer is fine", lines: [CALM_LINES[index % CALM_LINES.length]] };
}

function buildOne(index: number): Transcript {
  const negative = NEGATIVE_AT[index];
  if (negative) {
    return base(index, negative.topic, negative.queue, talk(index, negative.lines));
  }
  if (MIXED_AT.has(index)) {
    const mild = index % MILD_LINES.length;
    return base(index, MILD_TOPICS[mild], mild % 2 === 0 ? "Support" : "Billing", talk(index, [MILD_LINES[mild]]));
  }
  const happy = positiveLines(index);
  const queue = index % 5 === 0 ? "Sales" : index % 2 === 0 ? "Support" : "Accounts";
  return base(index, happy.topic, queue, talk(index, happy.lines));
}

export const transcripts: Transcript[] = Array.from({ length: 100 }, (_, index) => buildOne(index));
