import type { Channel, Transcript } from "./types";

type Line = { speaker: "Agent" | "Customer"; text: string };

const AGENTS = ["Aisha Khan", "James Adeyemi", "Helen Okonkwo", "Tom Becker", "Ruth Nkosi", "Sara Iqbal", "Mark Olsen", "David Pell"];

const ACCOUNTS = [
  "Maya Ellis",
  "Keel & Co",
  "Bramley Foods",
  "Harper Stores",
  "Owen Blake",
  "Hart & Elm",
  "Lowther Gifts",
  "Noah Bennett",
  "Priya Shah",
  "Calder Books",
  "Anita Shah",
  "Lucy Arbour",
  "Vantage Toys",
  "Claire Redholt",
  "Jon Sable",
  "Grace Mallow",
  "Irene Kowalski",
  "Nina Bright",
  "Evan Dornay",
  "Mohammed Tern",
  "Aster Travel",
  "Ben Glass",
  "Fiona Penny",
  "Simon Holt",
  "Lewis Nairn",
  "Alice Yarrow",
  "Gordon Peak",
  "Elmwood Gifts",
  "Tom Bracken",
  "Helena Ivo",
  "Rowan Legal",
  "Fieldgate Market",
  "Cobalt Kitchen",
  "Harrow Clinic",
  "Larkspur Home",
  "Northgate Motors",
  "Pembroke Books",
  "Sable & Co",
  "Westmill Dairy",
  "Orchard Hotel",
  "Kite Analytics",
  "Samira Iqbal",
  "Amber Finance",
  "Stone & Clay",
  "Harbourlight",
  "Greenlane Couriers",
  "Pellham Design",
  "Fox & Hare",
  "Bridgewater Club",
  "Atlas Surveys",
  "Cedar Clinic",
  "Riverbank Lettings",
  "Oakmont Law",
  "Summit Fit",
  "Beacon School",
  "Wren Logistics",
  "Millhouse Bakery",
  "Hilltop Survey",
  "Marlow Print",
  "Fable Toys",
  "Northstar Cover",
  "Grove Accounts",
  "Lantern Hotel",
  "Swift Parcel",
  "Copper Pot",
  "Bold Street Shop",
  "Quietroom Studio",
  "Portside Fish",
  "Elm Legal",
  "Kindred Care",
  "Moorland Builds",
  "Paperkite Agency",
  "Redlane Coaches",
  "Silverfork Cafe",
  "Tidal Marine",
  "Upperton Stores",
  "Violet Labs",
  "Westcourt Rooms",
  "Yardley Boxes",
  "Zephyr Travel",
  "Ash & Oak",
  "Bramble Foods",
  "Cinder Hotel",
  "Dovetail Workshop",
  "Easton Freight",
  "Fern Accounting",
  "Gable Studio",
  "Hearth Kitchen",
  "Indigo Office",
  "Jasper Media",
  "Kestrel Security",
  "Linden Care",
  "Maple Dental",
  "Nettle & Co",
  "Osprey Warehouse",
  "Plumline Catering",
  "Quarry Stone",
  "Reed & Birch",
  "Saffron Hotel",
  "Thorn Electrical",
];

const CONTACTS = [
  "Maya Ellis", "Helen Marsh", "Chris Adeyemi", "Priya Raman", "Owen Blake", "Sophie Hart", "Daniel Lowther",
  "Noah Bennett", "Priya Shah", "Rebecca Calder", "Anita Shah", "Lucy Arbour", "Owen Blake", "Claire Redholt",
  "Jon Sable", "Grace Mallow", "Irene Kowalski", "Nina Bright", "Evan Dornay", "Mohammed Tern", "Catherine Aster",
  "Ben Glass", "Fiona Penny", "Simon Holt", "Lewis Nairn", "Alice Yarrow", "Gordon Peak", "Sarah Elmwood",
  "Tom Bracken", "Helena Ivo",
];

const ROLES = [
  "customer", "account holder", "buyer", "finance lead", "store manager", "parent", "member", "office manager",
];

const PLACES = [
  "home address", "London", "Manchester shop", "billing address", "Leeds", "Bristol", "Cardiff", "Glasgow",
  "Edinburgh", "Birmingham", "Newcastle", "Oxford", "Sheffield", "Nottingham", "Liverpool", "Cambridge",
];

function clock(index: number): string {
  const minutes = 7 * 60 + 40 + index * 4;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

function channelFor(index: number): Channel {
  return (["voice", "email", "whatsapp"] as const)[index % 3];
}

function base(index: number, topic: string, queue: string, lines: Line[]): Transcript {
  const channel = channelFor(index);
  return {
    id: `gl-${1001 + index}`,
    channel,
    company: ACCOUNTS[index],
    contact: CONTACTS[index % CONTACTS.length],
    role: ROLES[index % ROLES.length],
    place: PLACES[index % PLACES.length],
    queue,
    agent: AGENTS[index % AGENTS.length],
    callTime: clock(index),
    duration: channel === "voice" ? `${5 + (index % 8)} min` : channel === "email" ? "email thread" : "WhatsApp chat",
    topic,
    lines,
  };
}

function talk(index: number, customer: string[]): Line[] {
  const name = CONTACTS[index % CONTACTS.length].split(" ")[0];
  const account = ACCOUNTS[index];
  const agent = AGENTS[index % AGENTS.length].split(" ")[0];
  const channel = channelFor(index);
  const lines: Line[] =
    channel === "voice"
      ? [
          { speaker: "Agent", text: `Thanks for calling support, ${agent} speaking.` },
          { speaker: "Customer", text: `Hello, it is ${name}, about ${account}.` },
        ]
      : channel === "email"
        ? [
            { speaker: "Agent", text: `From ${agent} on the support team. I have your email.` },
            { speaker: "Customer", text: `Hello, it is ${name}, about ${account}.` },
          ]
        : [
            { speaker: "Agent", text: `Hi ${name}, ${agent} from support here.` },
            { speaker: "Customer", text: `Hello, it is ${name}, about ${account}.` },
          ];
  const more =
    channel === "email" ? "Thanks. I have the account open. Tell me a bit more." : "I have the account open. Tell me a bit more.";
  const close =
    channel === "email"
      ? "Thank you. I have replied and noted that on the account."
      : "Thank you. I have noted that on the account.";
  customer.forEach((text, step) => {
    if (step > 0) lines.push({ speaker: "Agent", text: more });
    lines.push({ speaker: "Customer", text });
  });
  lines.push({ speaker: "Agent", text: close });
  return lines;
}

const NEGATIVE_AT: Record<number, { topic: string; queue: string; lines: string[] }> = {
  3: {
    topic: "Bill arrived too late, then a payment demand",
    queue: "Billing",
    lines: [
      "The bill for last month arrived on the 28th, which was too late to pay before the due date. The money was ready on the 14th.",
      "Your payments team then sent a demand for payment and said you might close the account. We pay when the bill actually arrives.",
    ],
  },
  7: {
    topic: "Parcel arrived three days late",
    queue: "Delivery",
    lines: [
      "The parcel arrived late. It was meant to be here for a birthday on Saturday.",
      "It was three days late. We paid for next-day delivery and it sat in a depot.",
    ],
  },
  12: {
    topic: "Item arrived broken",
    queue: "Delivery",
    lines: [
      "The lamp arrived broken. The box was crushed and the shade was in pieces.",
      "I am still waiting for the replacement you promised on Tuesday.",
    ],
  },
  16: {
    topic: "Refund never arrived",
    queue: "Refunds",
    lines: [
      "I returned the coat two weeks ago and the shop scanned it in.",
      "The refund never arrived. The money is still missing from my account.",
    ],
  },
  20: {
    topic: "Extra fee with no warning",
    queue: "Billing",
    lines: [
      "There is an extra fee on this bill that was not on the last one.",
      "We weren't told it was coming. A travel booking should not hide a new charge in the footer.",
    ],
  },
  27: {
    topic: "Forty minutes on hold",
    queue: "Support",
    lines: [
      "I was on hold just to ask where my order is.",
      "That was forty minutes. Nobody picked up, and I still do not know if it has left the warehouse.",
    ],
  },
  34: {
    topic: "Wrong item sent again",
    queue: "Delivery",
    lines: [
      "You sent the wrong item. I ordered a blue kettle and a red one arrived.",
      "This is the second time. Please send the right one and collect the other.",
    ],
  },
  41: {
    topic: "Locked out of the account",
    queue: "Accounts",
    lines: [
      "I am locked out of my account and the reset email never came.",
      "I cannot pay the bill until I can sign in. The money is sitting there ready.",
    ],
  },
  48: {
    topic: "Charged twice for the same order",
    queue: "Billing",
    lines: [
      "You charged me twice for the same order. The money left on the 4th and again on the 6th.",
      "Please put one of those payments back. I should not have to raise this twice.",
    ],
  },
  56: {
    topic: "Promised callback never came",
    queue: "Support",
    lines: [
      "Yesterday your colleague said someone would call me before lunch about the missing shoes.",
      "The callback never came. I waited through two meetings and heard nothing.",
    ],
  },
  64: {
    topic: "Passed between four people",
    queue: "Support",
    lines: [
      "I have been trying to change the delivery address since Tuesday.",
      "Your team transferred me four times this morning. I still do not have one person who owns it.",
    ],
  },
  73: {
    topic: "Cancelled, and still billed",
    queue: "Billing",
    lines: [
      "I cancelled the membership on the 2nd, in the account and by email.",
      "You still billed me for a full month after that. Please take it off.",
    ],
  },
  86: {
    topic: "Complaint and no one came back",
    queue: "Complaints",
    lines: [
      "I raised a complaint last Wednesday about a missing parcel.",
      "No one came back. Not an email, not a message, nothing.",
    ],
  },
  91: {
    topic: "Refund was short",
    queue: "Refunds",
    lines: [
      "The refund was short. I paid 86 and you sent back 40.",
      "Please pay the full amount. I sent the shoes back unused.",
    ],
  },
  95: {
    topic: "Account closed with no warning",
    queue: "Accounts",
    lines: [
      "You closed the account at 9 this morning. The shop could not take orders.",
      "There was no warning. No call and no email before it stopped.",
    ],
  },
};

const MILD_LINES = [
  "The order arrived, but I would have liked a text when it was on the way.",
  "The total is right. The bill is harder to read than it needs to be.",
  "It is not a big problem. The reply was just a bit slow, and I want someone to look at the wait.",
  "The account itself is fine. The second login is not yet enabled, and we asked for that last week.",
  "The change is done. I was on hold for nine minutes before anyone picked up a simple question.",
  "The refund is in. I am still cautious until I see it clear the bank.",
];

const MILD_TOPICS = [
  "Wanted a text when the order was on the way",
  "Bill is hard to read",
  "Reply was a bit slow",
  "Second login still not on",
  "Short wait on hold",
  "Waiting to see the refund clear",
];

const ONE_LINE = [
  "It arrived on the day you promised. That was easy.",
  "I am really pleased with the way your team handled it.",
  "That was excellent from start to finish.",
  "The return went smoothly and the money was back the next day.",
  "I will shop again. The help was clear and quick.",
  "Spot on. The replacement was here the next morning.",
  "I am very happy with it. Please tell the person who helped me.",
  "That was easy. Thank you for sorting the address.",
];

const TWO_LINES: [string, string][] = [
  ["The return went smoothly.", "I am really pleased."],
  ["It arrived on the day you promised.", "That was excellent."],
  ["I am very happy with it.", "I will shop again."],
  ["Spot on.", "That was easy."],
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
    return { topic: "Clean result for the customer", lines: [pair[0], pair[1]] };
  }
  if (mode === 1) {
    return { topic: "Customer happy with the help", lines: [ONE_LINE[index % ONE_LINE.length]] };
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
    const queue = mild % 2 === 0 ? "Support" : "Billing";
    return base(index, MILD_TOPICS[mild], queue, talk(index, [MILD_LINES[mild]]));
  }
  const happy = positiveLines(index);
  const queues = ["Support", "Delivery", "Billing", "Accounts", "Refunds"];
  return base(index, happy.topic, queues[index % queues.length], talk(index, happy.lines));
}

export const transcripts: Transcript[] = Array.from({ length: 100 }, (_, index) => buildOne(index));
