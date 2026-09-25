export const DISCLAIMER_TEXT =
  "Milan Dodhia. Financial Educator. Mannrs Wellness LLP. This email is financial education, not financial advice. I do not recommend specific stocks, funds, policies or lenders. I don't sell products, so I don't earn commissions. For tax questions, speak to a Chartered Accountant. For legal questions, speak to a lawyer.";

/**
 * Every email the funnel can send, in one place.
 * Canonical source of truth: email-master.md.
 */

export type EmailLinks = {
  joining_link: string;
  calendar_link: string;
  registration_link: string;
  whatsapp_link: string;
  monthly_checkout_link: string;
  annual_checkout_link: string;
};

export type EmailContext = {
  firstName: string;
  links: EmailLinks;
};

export type TemplateSpec = {
  key: string;
  label: string;
  group: "session" | "post" | "nurture" | "dropoff" | "purchase";
  /** Human readable trigger, shown in the admin dashboard. */
  trigger: string;
  subject: (ctx: EmailContext) => string;
  heading: (ctx: EmailContext) => string;
  body: (ctx: EmailContext) => string[];
  cta?: (ctx: EmailContext) => { label: string; href: string } | null;
};

const BRASS = "#B8873B";
const SAGE = "#4A5A3A";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Turns *bold* into <strong> and [label](url) into a link. */
function inline(value: string) {
  return escapeHtml(value)
    .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" style="color:#4A5A3A;font-weight:600;">$1</a>',
    );
}

function plain(value: string) {
  return value
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1: $2");
}

/** One editable override row, as stored by the admin console. */
export type TemplateOverride = {
  subject?: string | null;
  heading?: string | null;
  /** One paragraph per line. */
  body?: string | null;
};

export type TemplateOverrides = Record<string, TemplateOverride | undefined>;

/**
 * Returns the template with any admin edits applied. Placeholders available in
 * edited copy: {{first_name}}, {{joining_link}}, {{calendar_link}},
 * {{registration_link}}, {{whatsapp_link}}, {{monthly_checkout_link}},
 * {{annual_checkout_link}}.
 */
export function applyOverride(
  spec: TemplateSpec,
  override: TemplateOverride | undefined,
): TemplateSpec {
  if (!override) return spec;
  const fill = (value: string, ctx: EmailContext) =>
    value
      .replace(/\{\{\s*first_name\s*\}\}/g, ctx.firstName)
      .replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) => {
        const links = ctx.links as unknown as Record<string, string>;
        return typeof links[key] === "string" ? links[key] : whole;
      });

  const next: TemplateSpec = { ...spec };
  const subject = (override.subject ?? "").trim();
  const heading = (override.heading ?? "").trim();
  const body = (override.body ?? "").trim();
  if (subject) next.subject = (ctx) => fill(subject, ctx);
  if (heading) next.heading = (ctx) => fill(heading, ctx);
  if (body)
    next.body = (ctx) =>
      body
        .split(/\r?\n/)
        .map((line) => fill(line, ctx))
        .filter((line) => line.trim() !== "");
  return next;
}

/** The default copy of a template, as editable plain text for the console. */
export function templateDraft(spec: TemplateSpec) {
  const ctx: EmailContext = {
    firstName: "{{first_name}}",
    links: {
      joining_link: "{{joining_link}}",
      calendar_link: "{{calendar_link}}",
      registration_link: "{{registration_link}}",
      whatsapp_link: "{{whatsapp_link}}",
      monthly_checkout_link: "{{monthly_checkout_link}}",
      annual_checkout_link: "{{annual_checkout_link}}",
    },
  };
  return {
    subject: spec.subject(ctx),
    heading: spec.heading(ctx),
    body: spec
      .body(ctx)
      .filter((line) => line.trim() !== "")
      .join("\n"),
  };
}

export function renderEmail(spec: TemplateSpec, ctx: EmailContext) {
  const subject = spec.subject(ctx);
  const heading = spec.heading(ctx);
  const paragraphs = spec.body(ctx).filter((line) => line.trim() !== "");
  const cta = spec.cta ? spec.cta(ctx) : null;
  const offers: { label: string; href: string }[] = [];

  const text = [
    `Hello ${ctx.firstName},`,
    "",
    ...paragraphs.map(plain),
    cta ? `\n${cta.label}: ${cta.href}` : "",
    ...offers.map((offer) => `${offer.label}: ${offer.href}`),
    "",
    "Milan Dodhia",
    "Financial Educator, Milanaire",
    "",
    "---",
    DISCLAIMER_TEXT,
    "",
    "Mannrs Wellness LLP : connect@onepageplan.in",
    "To stop receiving these emails, reply with the word UNSUBSCRIBE and we will remove you.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#FAF7F0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F0;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border:1px solid #E5DFD3;border-radius:10px;padding:28px;font-family:Helvetica,Arial,sans-serif;color:#2B2B28;">
          <tr><td style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:${BRASS};padding-bottom:12px;">The One Page Plan by Milanaire</td></tr>
          <tr><td style="font-size:22px;font-weight:700;color:${SAGE};padding-bottom:16px;line-height:1.25;">${escapeHtml(heading)}</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;padding-bottom:14px;">Hello ${escapeHtml(ctx.firstName)},</td></tr>
          ${paragraphs
            .map(
              (line) =>
                `<tr><td style="font-size:15px;line-height:1.6;padding-bottom:14px;">${inline(line)}</td></tr>`,
            )
            .join("\n          ")}
          ${
            cta
              ? `<tr><td align="center" style="padding:8px 0 22px;"><a href="${cta.href}" style="display:inline-block;background-color:${SAGE};color:#FAF7F0;text-decoration:none;font-size:15px;font-weight:600;padding:13px 26px;border-radius:8px;">${escapeHtml(cta.label)}</a></td></tr>`
              : ""
          }
          ${offers
            .map(
              (offer) =>
                `<tr><td align="center" style="padding-bottom:10px;"><a href="${offer.href}" style="display:inline-block;border:1px solid ${SAGE};color:${SAGE};text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;">${escapeHtml(offer.label)}</a></td></tr>`,
            )
            .join("\n          ")}
          <tr><td style="font-size:15px;line-height:1.6;padding:12px 0 20px;">Milan Dodhia<br /><span style="color:#6B6A63;">Financial Educator, Milanaire</span></td></tr>
          <tr><td style="border-top:1px solid #E5DFD3;padding-top:16px;font-size:11px;line-height:1.6;color:#6B6A63;">
            ${escapeHtml(DISCLAIMER_TEXT)}<br /><br />
            Mannrs Wellness LLP : connect@onepageplan.in<br />
            To stop receiving these emails, reply with the word UNSUBSCRIBE and we will remove you.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

const joinCta = (ctx: EmailContext) =>
  ctx.links.joining_link ? { label: "Open the session", href: ctx.links.joining_link } : null;

// Sequence 1: Registrant Nurture (S1-08 to S1-18 from email-master.md)
const s1NurtureCopy = [
  {
    key: "nurture_1",
    label: "S1-08: Nurture 1 - The number most people never write down",
    trigger: "Day 1 after the session",
    subject: "The number most people never write down",
    heading: "The number most people never write down",
    body: [
      "Money that doubles in ten years has grown at about 7.18 percent a year. That is the whole of it. The total looks impressive. The annual rate is what actually describes what happened.",
      "Take tax off at a thirty percent slab and that becomes roughly 5 percent. Set 5 against six percent inflation and the real return is about minus one percent.",
      "The money doubled. What it could buy went down. And the statement looked good the entire time, which is exactly why nobody went back and checked.",
      "This is not pessimism. It is the only honest way to measure anything, because a return before tax and before inflation is not a return, it is a headline.",
      "Take one holding. Annual rate, minus tax, minus inflation. Fifteen minutes. Most people are surprised twice: once by the number, and once by discovering that the holding they were proudest of is not the one doing the work.",
      "Tomorrow: the product most people own for the wrong reason entirely.",
    ],
  },
  {
    key: "nurture_2",
    label: "S1-09: Nurture 2 - Insurance is not an investment",
    trigger: "Day 2 after the session",
    subject: "Insurance is not an investment",
    heading: "Insurance is not an investment",
    body: [
      "A great deal of money in Indian households sits in products that are trying to do two jobs at once: protect the family if you are not there, and grow money while you are.",
      "The structural problem is not that these products are dishonest. It is that the two jobs want opposite things. Protection wants the largest possible cover for the smallest possible cost. Growth wants the largest possible amount invested with the least possible drag. Combine them and each half constrains the other.",
      "I am not going to tell you what to hold. I am going to give you the question that sorts it out.",
      "Take each product you own and ask which single job it is doing. If the answer is both, ask how much cover it actually provides against what your family would need, and separately what it has returned after tax and after inflation. Two numbers. Then judge each half on its own terms.",
      "Most people have never separated the two, which is why the answer has never been obvious.",
      "Tomorrow: the money that is not supposed to grow at all.",
    ],
  },
  {
    key: "nurture_3",
    label: "S1-10: Nurture 3 - Your emergency cushion, sized properly",
    trigger: "Day 3 after the session",
    subject: "Your emergency cushion, sized properly",
    heading: "Your emergency cushion, sized properly",
    body: [
      "There is one pot of money whose job is not to grow. Its job is to be there, in full, on the worst day, without anything having to be sold at a bad moment.",
      "Almost everybody under-sizes it, and the reason is that idle money feels like a mistake. It is not idle. It is what stops a temporary problem from becoming a permanent one.",
      "How to size it, rather than what to put it in. Add up what actually has to be paid every month even if the income stops: the EMI, the rent, the school fee, food, utilities, insurance premiums, anything supporting your parents. That is your monthly floor, and it is usually a good deal lower than your monthly spending, which is the encouraging part.",
      "Then decide how many months of that floor you need. Someone salaried in a stable role needs fewer than someone whose income arrives in lumps. Someone who is the only earner for six people needs more than someone who is not.",
      "The number is yours. The method is the same for everybody.",
      "Tomorrow: the cost of waiting until things are clearer.",
    ],
  },
  {
    key: "nurture_4",
    label: "S1-11: Nurture 4 - The cost of a five-year delay",
    trigger: "Day 4 after the session",
    subject: "The cost of a five-year delay",
    heading: "The cost of a five-year delay",
    body: [
      "Every input into a financial outcome can be changed later except one.",
      "You can increase the amount. You can change what it sits in. You can raise your income and redirect the increase. All of that is available at forty, at fifty, at sixty.",
      "Time is not. A year that passes is gone, and it is the input that does the heaviest lifting, because it is the one that compounds the others.",
      "I am not going to put a rupee figure on your delay, because doing that would require me to assume a return I have no business assuming. What I will tell you is the mechanism, and you can run it yourself: an amount that grows for thirty years does considerably more work than the same amount growing for twenty, and the difference is not proportional. It is much larger than the ten year gap suggests.",
      "Which is why 'I will sort this out when things are clearer' is the most expensive sentence in personal finance. Things are never clearer. There is only earlier and later.",
      "Tomorrow: where money leaks without anybody noticing.",
    ],
  },
  {
    key: "nurture_5",
    label: "S1-12: Nurture 5 - Where most portfolios quietly leak",
    trigger: "Day 5 after the session",
    subject: "Where most portfolios quietly leak",
    heading: "Where most portfolios quietly leak",
    body: [
      "Nobody notices a leak, because a leak does not arrive as a loss. It arrives as a slightly smaller number than there should have been, every year, for a decade.",
      "Four common ones.",
      "Overlap. Owning six schemes feels like diversification. If four of them hold substantially the same underlying companies, you own one position wearing six names, with six sets of paperwork.",
      "Cost. Every ongoing charge comes out before you see anything. Small annual percentages behave very differently over twenty five years than they look on a one year statement.",
      "Tax you did not plan for. The same decision, made with two different holding periods in mind, produces two different post-tax outcomes. If your return calculation ignores this, your number is wrong rather than optimistic. I am not a Chartered Accountant, and your specific position is a conversation to have with one.",
      "Idle balances. Money parked in a current or savings account for years because moving it was never anybody's job.",
      "None of these is dramatic. Together they are usually larger than any single decision a person agonises over.",
      "Tomorrow: the document that matters more than the spreadsheet.",
    ],
  },
  {
    key: "nurture_6",
    label: "S1-13: Nurture 6 - One page, not a spreadsheet",
    trigger: "Day 6 after the session",
    subject: "One page, not a spreadsheet",
    heading: "One page, not a spreadsheet",
    body: [
      "Ask yourself a plain question. If you were not there tomorrow, could the people you support find and act on everything you have built?",
      "Not 'is it written down somewhere'. Could they find it, understand it, and do the next thing.",
      "For most people the honest answer is no, and it has nothing to do with how well organised they are. The information exists across a dozen logins, three institutions, and a memory that belongs to one person.",
      "The fix is one page, not a system. What exists, where it is held, who to contact, and where the documents sit. That is it. A single page a spouse or a sibling could pick up and act on.",
      "While you write it, check every nomination: provident fund, bank accounts, investments, insurance, demat. People assume this is handled and it very often is not, and a nominee is not always the same thing as an heir. That distinction is a lawyer's territory and worth knowing exists before you need it.",
      "Tomorrow: why most financial goals never get met.",
    ],
  },
  {
    key: "nurture_7",
    label: "S1-14: Nurture 7 - Goals with dates, not adjectives",
    trigger: "Day 7 after the session",
    subject: "Goals with dates, not adjectives",
    heading: "Goals with dates, not adjectives",
    body: [
      "Most financial goals fail at the moment they are written, because they are written as adjectives.",
      "A comfortable retirement. A good education for my child. Financial freedom. Every one of those is a feeling, and a feeling cannot be planned for, funded, or checked. You will never know whether you are on track, because there is nothing to be on track against.",
      "A goal that can be planned has three things: an amount, a date, and a named person. Not 'my child's education'. A number, a year, and which child. Not 'retirement'. A monthly figure, a starting year, and for how many people.",
      "The number will be uncomfortable the first time you write it. That is the point, and it is also the relief, because a feeling keeps you awake and a number lets you do something. Even a number you do not like is better than an adjective, because a number can be worked on.",
      "Do one this week. The nearest one, the one arriving soonest.",
      "Tomorrow: the month that decides most investing lifetimes.",
    ],
  },
  {
    key: "nurture_8",
    label: "S1-15: Nurture 8 - The market will fall. Plan for it now.",
    trigger: "Day 8 after the session",
    subject: "The market will fall. Plan for it now.",
    heading: "The market will fall. Plan for it now.",
    body: [
      "At some point, everything you own will be worth meaningfully less than you paid. Not might. Will.",
      "The falls are not the problem. What people do during them is. People reliably earn less than the things they own actually returned, and the whole of that gap is created in a handful of weeks spread across a lifetime: money arriving after a run, money leaving after a fall.",
      "The fix is not courage, because on the day you will be reading the same headlines as everybody else and your judgment will be worse than it is right now.",
      "The fix is three sentences, written this week, while you are calm, and dated.",
      "If this falls by X percent, I will do this specific thing.",
      "I will not sell anything unless this specific condition is true.",
      "The money I need within three years is not in this at all. It is here instead.",
      "Then put it where you will find it. When the fall comes you are not deciding under pressure. You are executing a decision made by a calmer person who happened to be you.",
      "Tomorrow: what I would look at first if I opened your file.",
    ],
  },
  {
    key: "nurture_9",
    label: "S1-16: Nurture 9 - What I would check first in your file",
    trigger: "Day 9 after the session",
    subject: "What I would check first in your file",
    heading: "What I would check first in your file",
    body: [
      "If you handed me everything, this is the order I would work in. It is deliberately not the order most people expect, and the investments come last.",
      "One. Cover. Whether the people depending on you would be all right, measured against what they would actually need. Everything else is optional until this is settled, because everything else assumes you are around.",
      "Two. The floor. Whether there is enough accessible money that a bad six months does not force a sale at the worst possible moment.",
      "Three. Debt. Which loan is genuinely the expensive one, ranked by real cost rather than by size or by how much it annoys you.",
      "Four. Income. What your work is worth in the market today, and when you last tested that.",
      "Five. Then the investments. What you own, what it has returned after tax and after inflation, and which lines you cannot explain in a sentence.",
      "Almost everybody starts at five and never gets to one. Reversing that order is most of the value of doing this properly.",
      "Tomorrow: doing all of this yourself, with a structure.",
    ],
  },
  {
    key: "nurture_10",
    label: "S1-17: Nurture 10 - Doing it yourself, with a structure",
    trigger: "Day 10 after the session",
    subject: "Doing it yourself, with a structure",
    heading: "Doing it yourself, with a structure",
    body: [
      "Nine emails and I have not asked you for anything. This is the one time I will.",
      "The Calm Money System. Lifetime access. Three days live, then a ninety day structure with nine missions, the full template pack, and the community.",
      "What it does not do. It does not tell you what to buy. It does not name a fund, a policy or a company. If you want a name handed to you, this is not it, and I would rather you knew that now.",
      "What it does. You build your own consolidated picture, in your own file, including the accounts you have forgotten. You compute real return after tax and after inflation. You find out whether your family is actually covered, and whether the one clause deciding where an insurance payout lands is present in your policy or was never chosen. You rank your loans by real cost. You prepare the conversation about what your work is worth. You write the one page your family could act on.",
      "First ten buyers get fifteen minutes with me, one to one. Limited by my actual hours, not extendable.",
      "The price rises every hundred members, published in advance. No countdown, no discount expiring tonight, no struck-through price. I teach people to stop making money decisions under manufactured pressure and I am not going to sell using it.",
    ],
  },
  {
    key: "nurture_11",
    label: "S1-18: Nurture 11 - Last note from me",
    trigger: "Day 11 after the session",
    subject: "Last note from me",
    heading: "Last note from me",
    body: [
      "Last one of these.",
      "If you have not bought anything, that is a completely reasonable place to land and these eleven days were not a waste. Do the exercise from day one: one holding, annual rate, minus tax, minus inflation. And the one from day six: a single page your family could find and act on.",
      "Those two things cost you an evening between them and they are worth more than most of what gets sold to people in your position.",
      "The session runs free every Saturday at 7:00 PM IST. Come back whenever you want to, bring your spouse if it would help, and ask me the difficult question in the Q and A. I answer all of them.",
      "If you never buy anything from me, you should still leave knowing how this works. That was the deal from the start and it does not have an expiry date.",
    ],
  },
];

// Sequence 3: Silver Cohort Buyers (S3-01 to S3-10 from email-master.md)
const s3BuyerCopy = [
  {
    key: "s3_01",
    label: "S3-01: Immediately on purchase",
    trigger: "Immediately on purchase",
    subject: "You are in. Here is exactly what happens now.",
    heading: "You are in. Here is exactly what happens now.",
    body: [
      "You are in. Thank you, and I do not take a decision like this casually.",
      "What happens now, in order.",
      "Your login for the community and the template pack is on its way in a separate email. If it has not arrived within the hour, reply to this one and I will sort it.",
      "The three live days start on your cohort start date. All three are in your calendar invite. They are live, they are not recordings, and the work happens in the room.",
      "One thing to do this week, before anything else. Open the Money Audit sheet and fill in one section. Not all of it. One. People who try to do the whole thing in a sitting do none of it. People who do one section usually finish within a fortnight, and they arrive on day one with something to work on rather than a blank page.",
      "If you are among the first ten buyers, you have fifteen minutes with me one to one. You will get a separate booking link. Come to that with your audit sheet, not with statements or policy documents.",
      "I will write again a week before we start.",
    ],
  },
  {
    key: "s3_02",
    label: "S3-02: 7 days before cohort day 1",
    trigger: "7 days before cohort day 1",
    subject: "One week out. Three things to have ready.",
    heading: "One week out. Three things to have ready.",
    body: [
      "We start in one week.",
      "Three things to have ready, and none of them takes long.",
      "Your audit sheet, partly filled. Even one section. The people who arrive with something to look at get roughly twice as much out of day one, because we spend the session working rather than gathering.",
      "Your login checked. Test it now, not five minutes before we start. Reply here if anything is wrong.",
      "Your three evenings blocked. Tell whoever needs telling at home. This is the single biggest predictor of who finishes: not motivation, not interest, whether the evenings were protected in advance.",
      "One more thing, and it matters more than the other three. Bring your spouse if you have one. Not because the material needs two people, but because almost every decision in this course gets made by two people and only one of them will have heard the reasoning. That is the most common reason good financial plans quietly stop.",
      "Next note in five days.",
    ],
  },
  {
    key: "s3_03",
    label: "S3-03: 2 days before cohort day 1",
    trigger: "2 days before cohort day 1",
    subject: "Two days. What day one actually does.",
    heading: "Two days. What day one actually does.",
    body: [
      "Two days.",
      "Day one is not a lecture on markets, and if you came expecting one you will be pleasantly surprised or mildly annoyed, and I would rather warn you.",
      "We start with why you decided what you decided. Your money story, the beliefs you picked up without choosing them, and three money values written down in your own words. Everything else in the ninety days gets checked against those three.",
      "Then the audit. What you own, what you owe, and one sentence explaining what each thing does. Including the accounts you have forgotten, and every nomination.",
      "Then the uncomfortable one. Your five largest discretionary purchases of the last year, and an honest answer to who each one was for.",
      "That last exercise is the one people write to me about a year later. It is not about spending less. It is about noticing what your spending was aimed at, which almost nobody has ever examined.",
      "Sit somewhere quiet. Have a pen. Have your sheet.",
    ],
  },
  {
    key: "s3_04",
    label: "S3-04: Day before cohort day 1",
    trigger: "Day before cohort day 1, 7:00 PM IST",
    subject: "Tomorrow.",
    heading: "Tomorrow.",
    body: [
      "Tomorrow.",
      "Pen and paper, not a phone.",
      "Your audit sheet, however far you got.",
      "Somewhere quiet, for the whole session.",
      "Your spouse, if you have one and they are willing.",
      "If something has come up and you cannot make tomorrow, reply and tell me now rather than disappearing. There is a way to catch up and it works considerably better if I know in advance.",
    ],
  },
  {
    key: "s3_05",
    label: "S3-05: 2 hours before cohort day 1",
    trigger: "Cohort day 1, 2 hours before start",
    subject: "Two hours.",
    heading: "Two hours.",
    body: [
      "Two hours until we start.",
      "Pen. Sheet. Quiet room.",
      "Nothing else needed.",
    ],
  },
  {
    key: "s3_06",
    label: "S3-06: After day 1, before day 2",
    trigger: "After day 1, before day 2",
    subject: "Before tomorrow: your three values, on paper",
    heading: "Before tomorrow: your three values, on paper",
    body: [
      "Good session. One piece of work before tomorrow, and it is short.",
      "Write your three money values down properly. Not in your head. On the sheet, in your own words. If you did not finish that in the room, finish it tonight, because everything tomorrow gets measured against them and the exercises do not work without them.",
      "Then, if you have twenty minutes, go one layer further on the audit. The line you least want to look at is usually the most useful one to open.",
      "Tomorrow covers earning and protecting. Your income treated as a variable rather than a constant, your credit score and what it costs you, then life cover measured against a stated need, the clause that decides where a payout lands, and health cover as a separate problem in its own right.",
      "Bring a specific question if you have one. The best questions in this course have all come from somebody's actual file.",
      "If you missed today, reply and tell me. Do not just turn up tomorrow hoping to catch up.",
    ],
  },
  {
    key: "s3_07",
    label: "S3-07: After day 2, before day 3",
    trigger: "After day 2, before day 3",
    subject: "Before tomorrow: one number and one date",
    heading: "Before tomorrow: one number and one date",
    body: [
      "Two down.",
      "Two things before tomorrow.",
      "One number. Whatever cover gap came out of today, write it down as a figure. Not 'probably not enough'. A number. A gap you have quantified is a task. A gap you have described is an anxiety, and you have been carrying it for years already.",
      "One date. Put a date on the conversation you now know you need to have. With your spouse, with a parent, with your employer. Any of them. The date is the commitment, and it is more useful than the intention.",
      "Tomorrow is the last day. Growing, and how you know whether it worked, post-tax and post-inflation. Debt as arithmetic, which loan dies first. Money as a family conversation, including what a child learns from watching how you decide. Then the ninety days, the missions and the certification path.",
      "Tomorrow is also where the whole thing becomes yours rather than mine, so come.",
    ],
  },
  {
    key: "s3_08",
    label: "S3-08: After day 3",
    trigger: "After day 3",
    subject: "That is the course. Now the part that matters.",
    heading: "That is the course. Now the part that matters.",
    body: [
      "Three days done. The teaching is finished and the actual work starts now, which is the reverse of how most courses feel and it is deliberate.",
      "Wealth On Purpose runs for ninety days. Nine missions across three months. See, then Fix, then Build. Every mission produces something you can hold up rather than something you have merely understood.",
      "Mission one, this week: The Full Picture. Every account, holding, policy, loan and asset in one place. Including the provident fund you have never logged into, and every post office or small savings account you half remember. Built by you, in your own file, so the data stays yours and nobody can sell to you off the back of it.",
      "Post it in the community when it is done. Not the numbers, just that it is done. Watching other people finish is the most reliable engine in this thing, and it works in both directions.",
      "The Inner Circle Call runs on Thursdays. Bring the question you got stuck on.",
    ],
  },
  {
    key: "s3_09",
    label: "S3-09: 14 days after day 3",
    trigger: "14 days after day 3",
    subject: "Two weeks in. The honest check.",
    heading: "Two weeks in. The honest check.",
    body: [
      "Two weeks since we finished. Two questions.",
      "Is your full picture built? If yes, you are ahead of most people who have ever paid for financial education, and you should recognise that rather than moving straight on.",
      "If not, what actually stopped you? Answer this honestly, because the answer is nearly always one of three things and each has a different fix.",
      "Not enough time is usually not the real answer. Two hours exists somewhere in a fortnight.",
      "Not knowing where to start is a real answer, and the fix is to start with the account you have the login for and add the rest later. A partial picture beats a planned one.",
      "Not wanting to know is the most common real answer and the one nobody says out loud. If that is yours, you are in good company, and the discomfort is a fortnight long at most. The alternative is carrying it for another decade.",
      "Reply to this email with which of the three it is. I read them, and it changes what I cover on Thursday.",
    ],
  },
  {
    key: "s3_10",
    label: "S3-10: 28 days after day 3",
    trigger: "28 days after day 3",
    subject: "Month one. Set the rhythm now.",
    heading: "Month one. Set the rhythm now.",
    body: [
      "One month.",
      "The people who still have this working in a year are not the ones who did the most in month one. They are the ones who set a rhythm and kept it when nothing interesting was happening.",
      "Here is the rhythm. Thirty minutes, once a month, same day each month, in your calendar as a repeating event with a name on it.",
      "In that half hour you do three things. Update the numbers in your sheet. Check whether anything has changed that affects a decision you already made. And look at your three values, and ask whether the last month's money went anywhere near them.",
      "That is the entire annual system, and it is thirty minutes twelve times a year.",
      "One more thing, and it is the one that decides whether any of this survives. Have the conversation at home. Not a presentation of your spreadsheet. A conversation, on a scheduled evening, where both people get to say what they actually want the money for.",
      "Everything I teach is designed to be run by two people. It works with one and it lasts with two.",
    ],
  },
];

export const TEMPLATES: TemplateSpec[] = [
  // Sequence 1: Session emails
  {
    key: "confirmation",
    label: "S1-01: Registration confirmation",
    group: "session",
    trigger: "Immediately after someone registers",
    subject: () => "Your seat is saved. Here is what to bring.",
    heading: () => "Your seat is saved for this Saturday",
    body: (ctx) => [
      "Your seat for The Money Reality Masterclass is saved. It runs this Saturday at 7:00 PM IST and takes ninety minutes.",
      "Two things to have next to you: a pen and paper, and last month's bank statement. You will be doing arithmetic on your own numbers, not watching mine.",
      "Keep the button below. That is how you get in on the night.",
      ctx.links.calendar_link ? `[Add it to your calendar](${ctx.links.calendar_link})` : "",
    ],
    cta: joinCta,
  },
  {
    key: "reminder_24h",
    label: "S1-02: Reminder - 24 hours before",
    group: "session",
    trigger: "Friday 7:00 PM IST",
    subject: () => "Tomorrow, 7:00 PM. One question to sit with tonight.",
    heading: () => "Tomorrow at 7:00 PM IST",
    body: (ctx) => [
      "The Money Reality Masterclass runs tomorrow at 7:00 PM IST for ninety minutes.",
      "Before tomorrow, sit with one question: if your money doubled over the last ten years, did you actually get richer?",
      "We will do the arithmetic live on your numbers tomorrow. Have a pen and last month's statement ready.",
      ctx.links.calendar_link ? `[Add it to your calendar](${ctx.links.calendar_link})` : "",
    ],
    cta: joinCta,
  },
  {
    key: "reminder_1h",
    label: "S1-03: Reminder - 1 hour before",
    group: "session",
    trigger: "Saturday 6:00 PM IST",
    subject: () => "One hour.",
    heading: () => "We start in one hour",
    body: () => [
      "The session starts at 7:00 PM IST. Find a quiet corner, keep a pen next to you and open the link a couple of minutes early.",
      "Ninety minutes. Arrive ready to write.",
    ],
    cta: joinCta,
  },
  {
    key: "live_now",
    label: "S1-04: We are live",
    group: "session",
    trigger: "Saturday 7:00 PM IST",
    subject: () => "We are live. Come in.",
    heading: () => "We are live",
    body: () => [
      "The room is open. Come in and take a seat.",
      "We begin promptly. Have your pen and sheet ready.",
    ],
    cta: joinCta,
  },
  {
    key: "late_entry",
    label: "S1-05: Late entry - door still open",
    group: "session",
    trigger: "Saturday 7:20 PM IST",
    subject: () => "Still open. You have not missed the part that matters.",
    heading: () => "The door is still open",
    body: () => [
      "We are twenty minutes in and the arithmetic part has just started. You can still come in and catch up.",
      "Bring a pen and join the live room now.",
    ],
    cta: joinCta,
  },
  {
    key: "missed_session",
    label: "S1-06: Missed the session",
    group: "post",
    trigger: "Sunday morning, non-attendees",
    subject: () => "You missed it. Here is the one thing to do anyway.",
    heading: () => "Sorry you could not make it",
    body: (ctx) => [
      "You were not in the room last night, so here is the arithmetic you missed.",
      "Money that doubles in ten years has grown at about 7.18 percent a year. Take tax off at thirty percent: roughly 5 percent. Set that against six percent inflation: real return is about minus one percent.",
      "The statement looked good the whole time. If you want to sit through it properly, save a seat for this coming Saturday.",
    ],
    cta: (ctx) =>
      ctx.links.registration_link
        ? { label: "Save a seat for the next one", href: ctx.links.registration_link }
        : null,
  },
  {
    key: "post_session",
    label: "S1-07: Attended follow-up",
    group: "post",
    trigger: "Sunday morning, attendees",
    subject: () => "Your three sheets, and the one thing to do this week",
    heading: () => "Thank you for staying to the end",
    body: (ctx) => [
      "Thank you for staying to the end on Saturday.",
      "Everything I promised is here: the Money Audit sheet, the Real Return calculator, and the Nomination and MWP checklist.",
      "The one thing to do this week: open the Money Audit sheet and fill in one section. Not all of it. One. Most people who try to do the whole thing in one sitting do none of it, and most people who do one section finish the rest within a fortnight.",
      ctx.links.whatsapp_link ? `Community link: ${ctx.links.whatsapp_link}` : "",
    ],
  },
  // S1 Nurture emails
  ...s1NurtureCopy.map((copy) => ({
    key: copy.key,
    label: copy.label,
    group: "nurture" as const,
    trigger: copy.trigger,
    subject: () => copy.subject,
    heading: () => copy.heading,
    body: () => copy.body,
    cta: (ctx: EmailContext) => {
      if (copy.key === "nurture_10") {
        const checkoutUrl =
          ctx.links.annual_checkout_link ||
          ctx.links.monthly_checkout_link ||
          "https://onepageplan.in/course";
        return { label: "Enroll in The Calm Money System →", href: checkoutUrl };
      }
      return ctx.links.registration_link
        ? { label: "Come back to this Saturday's session", href: ctx.links.registration_link }
        : null;
    },
  })),

  // Sequence 2: Option 2 / Stock-tip Drop-off Nurture (S2-01)
  {
    key: "s2_01_stock_tip",
    label: "S2-01: Stock-Tip Drop-off Welcome",
    group: "dropoff",
    trigger: "Immediately upon selecting Option 2 in registration",
    subject: () => "I said no. Here is what I am saying instead.",
    heading: () => "I said no. Here is what I am saying instead.",
    body: () => [
      "You wanted someone to tell you what to buy, and I said no, so let me explain rather than leaving it as a closed door.",
      "It is not because the question is stupid. It is a reasonable question, asked by busy and competent people who have better things to do than research companies in the evening.",
      "It is because a name on its own has never been the useful part. I spent seven and a half years in equity research and thirteen years licensed to sell financial products. In all of that time I never saw a correct recommendation rescue somebody who did not know how much to buy, how long to hold it, or what they would do when it fell. I have watched plenty of correct recommendations lose people money for exactly those reasons.",
      "These emails are the other half. Short, one idea each, roughly twice a week for three weeks.",
      "Next one: why even a correct tip usually fails, and the three things that decide the outcome after the name is chosen.",
    ],
  },

  // Sequence 3: Buyers
  ...s3BuyerCopy.map((copy) => ({
    key: copy.key,
    label: copy.label,
    group: "purchase" as const,
    trigger: copy.trigger,
    subject: () => copy.subject,
    heading: () => copy.heading,
    body: () => copy.body,
  })),
];

export const TEMPLATE_MAP: Record<string, TemplateSpec> = Object.fromEntries(
  TEMPLATES.map((template) => [template.key, template]),
);

export function templateLabel(key: string) {
  return TEMPLATE_MAP[key]?.label ?? key;
}
