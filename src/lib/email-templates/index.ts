export const DISCLAIMER_TEXT =
  "The One Page Plan is a financial education programme by Milanaire, operated by Mannrs Wellness LLP. Everything on this page and in this session is educational content only. It is not investment advice and it is not a recommendation to buy or sell any security, scheme, policy or product. No returns are promised or implied. For anything tax related please consult a Chartered Accountant. For anything legal please consult a lawyer. Please make your own decisions.";

/**
 * Every email the funnel can send, in one place.
 * A template is plain data so the admin dashboard can list them without
 * importing any rendering code.
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
  group: "session" | "post" | "nurture" | "purchase";
  /** Human readable trigger, shown in the admin dashboard. */
  trigger: string;
  subject: (ctx: EmailContext) => string;
  heading: (ctx: EmailContext) => string;
  body: (ctx: EmailContext) => string[];
  cta?: (ctx: EmailContext) => { label: string; href: string } | null;
  /** Adds the two checkout links under the body. */
  offer?: boolean;
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
  if (spec.offer) {
    if (ctx.links.monthly_checkout_link)
      offers.push({ label: "Join monthly — ₹1,001", href: ctx.links.monthly_checkout_link });
    if (ctx.links.annual_checkout_link)
      offers.push({ label: "Join annual — ₹5,001", href: ctx.links.annual_checkout_link });
  }

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
    "Mannrs Wellness LLP · connect@onepageplan.in",
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
            Mannrs Wellness LLP · connect@onepageplan.in<br />
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

const nurtureCopy: { subject: string; heading: string; body: string[] }[] = [
  {
    subject: "The number most people never write down",
    heading: "Your real monthly number",
    body: [
      "In the session we did one piece of arithmetic: what your life actually costs in a month. Most people guess low by twenty to thirty percent.",
      "Do it once properly this week. Open last month's bank statement, total every outflow, and write the figure on one line. That single number decides how much cover, how much cushion and how much investing you need.",
      "Everything else in the plan sits on top of it.",
    ],
  },
  {
    subject: "Insurance is not an investment",
    heading: "Two jobs, two products",
    body: [
      "Protection replaces your income if you are not around. Investing grows your money. A product that promises both usually does neither well.",
      "This week, list every policy you hold and write next to each one which job it is doing. If a policy cannot answer that question in one line, it is a candidate for review.",
    ],
  },
  {
    subject: "Your emergency cushion, sized properly",
    heading: "Six months, in cash, boring on purpose",
    body: [
      "The cushion is not meant to earn. It is meant to stop you selling a good asset at a bad time or borrowing at twenty percent.",
      "Six times your real monthly number, in a savings account or liquid fund. Nothing clever. Once it is in place, you can take sensible risk everywhere else.",
    ],
  },
  {
    subject: "The cost of a five-year delay",
    heading: "Time does more work than returns",
    body: [
      "A person who starts five years earlier and stops contributing usually ends ahead of the person who starts later and contributes for longer. That is not a sales line, it is arithmetic.",
      "If you have been waiting for a better month to begin, start with a smaller number this month instead.",
    ],
  },
  {
    subject: "Where most portfolios quietly leak",
    heading: "Fees, overlap and forgotten products",
    body: [
      "Three leaks show up in almost every portfolio I look at: high-cost products sold as safe, five funds holding the same thirty companies, and policies nobody has read since the year they were bought.",
      "Pull one statement this week and look for all three.",
    ],
  },
  {
    subject: "One page, not a spreadsheet",
    heading: "Why the plan has to fit on a page",
    body: [
      "A plan you cannot hold in your head is a plan you will not follow. One page: your monthly number, your cushion, your cover, your monthly investing, and the goal each rupee is for.",
      "If it needs more than a page, it is a report, not a plan.",
    ],
  },
  {
    subject: "Goals with dates, not adjectives",
    heading: "\"Retirement\" is not a goal",
    body: [
      "A goal needs a year and a rupee figure. 2039 and forty lakh is a goal. \"Children's education\" is a wish.",
      "Write down your three biggest ones with dates this week. The dates decide which asset you use.",
    ],
  },
  {
    subject: "The market will fall. Plan for it now.",
    heading: "Decide before, not during",
    body: [
      "Every long-term investor sits through several sharp falls. The people who do well are not braver, they simply wrote down in advance what they would do.",
      "One line is enough: \"If my portfolio falls thirty percent, I will continue my monthly investing and change nothing else.\"",
    ],
  },
  {
    subject: "What I would check first in your file",
    heading: "The five-minute audit",
    body: [
      "Cover adequate. Cushion funded. Debt costing more than twelve percent cleared. Monthly investing automated. Nominations updated.",
      "Five lines. Most people fail two of them, and the fix takes an afternoon.",
    ],
  },
  {
    subject: "Doing it yourself, with a structure",
    heading: "You do not need me, you need a method",
    body: [
      "Everything in the masterclass can be done alone with a pen and an afternoon. The reason people do not is that nobody gave them the order to do it in.",
      "The One Page Plan programme is that order, with the templates and a monthly session to keep you honest.",
    ],
    },
  {
    subject: "Last note from me",
    heading: "Where this leaves you",
    body: [
      "You have your monthly number, your cushion target, your cover and a date on each goal. That is more than most people ever write down.",
      "If you want the structure, the templates and a monthly review alongside it, the programme is open. If not, keep the one page updated once a quarter and you will still be far ahead.",
    ],
  },
];

const postPurchaseCopy: { subject: string; heading: string; body: string[] }[] = [
  {
    subject: "Welcome in. Start here.",
    heading: "You are in",
    body: [
      "Thank you for joining The One Page Plan. Everything runs in one place and there is nothing to install.",
      "Step one this week: fill in your real monthly number and your cushion target on the one page template. Nothing else.",
    ],
  },
  {
    subject: "Week one: your numbers",
    heading: "Get the base right",
    body: [
      "This week we finish the base layer: monthly cost, cushion, debt list and cover. Once these four are on the page, the investing decisions become obvious.",
    ],
  },
  {
    subject: "Week two: cover and nominations",
    heading: "Protection, then growth",
    body: [
      "Check that your term cover is at least ten to twelve times your annual income, that your health cover fits your city, and that every nomination is current.",
      "This is the least exciting hour you will spend and the highest value one.",
    ],
  },
  {
    subject: "Week three: automate the investing",
    heading: "Make it happen without you",
    body: [
      "Set the monthly transfers for the day after your salary lands. Automation beats discipline, every time.",
    ],
  },
  {
    subject: "Your monthly review rhythm",
    heading: "Fifteen minutes a month",
    body: [
      "Once a month: update the page, check the cushion, confirm the transfers went through. That is the whole maintenance job.",
      "Reply to this email any time you are stuck on a specific line of your plan.",
    ],
  },
];

export const TEMPLATES: TemplateSpec[] = [
  {
    key: "confirmation",
    label: "Registration confirmation",
    group: "session",
    trigger: "Immediately after someone registers",
    subject: () => "Your seat is saved for this Saturday",
    heading: () => "Your seat is saved for this Saturday",
    body: (ctx) => [
      "Your seat for The Money Reality Masterclass is saved. It runs this Saturday at 7:00 PM IST and takes ninety minutes.",
      "Keep the link below. That is how you get in on the night.",
      ctx.links.calendar_link ? `[Add it to your calendar](${ctx.links.calendar_link})` : "",
      "Before Saturday, sit somewhere quiet with a pen. You will be doing arithmetic on your own numbers, not watching mine.",
    ],
    cta: joinCta,
  },
  {
    key: "reminder_24h",
    label: "Reminder — 24 hours before",
    group: "session",
    trigger: "Friday 7:00 PM IST",
    subject: () => "Tomorrow, 7:00 PM: bring a pen",
    heading: () => "Tomorrow at 7:00 PM IST",
    body: (ctx) => [
      "The Money Reality Masterclass runs tomorrow at 7:00 PM IST for ninety minutes.",
      "Two things to have ready: a pen and paper, and last month's bank statement. You will be working on your own numbers.",
      ctx.links.calendar_link ? `[Add it to your calendar](${ctx.links.calendar_link})` : "",
    ],
    cta: joinCta,
  },
  {
    key: "reminder_1h",
    label: "Reminder — 1 hour before",
    group: "session",
    trigger: "Saturday 6:00 PM IST",
    subject: () => "One hour to go",
    heading: () => "We start in one hour",
    body: () => [
      "The session starts at 7:00 PM IST. Find a quiet corner, keep a pen next to you and open the link a couple of minutes early.",
    ],
    cta: joinCta,
  },
  {
    key: "live_now",
    label: "We are live",
    group: "session",
    trigger: "Saturday 7:00 PM IST",
    subject: () => "We are live now",
    heading: () => "We are live",
    body: () => ["The room is open. Come in and take a seat."],
    cta: joinCta,
  },
  {
    key: "late_entry",
    label: "Late entry — door still open",
    group: "session",
    trigger: "Saturday 7:20 PM IST",
    subject: () => "The door is still open",
    heading: () => "Still time to join",
    body: () => [
      "We are twenty minutes in and the arithmetic part has just started. You can still come in and catch up.",
    ],
    cta: joinCta,
  },
  {
    key: "missed_session",
    label: "Missed the session",
    group: "post",
    trigger: "Sunday morning, people who did not attend",
    subject: () => "You missed it, here is what we covered",
    heading: () => "Sorry you could not make it",
    body: (ctx) => [
      "You were not in the room last night, so here is the short version: what your life actually costs each month, how much cushion that implies, how much cover you need, and how to put all of it on one page.",
      ctx.links.registration_link
        ? "If you want to sit through it properly, register for the next session below."
        : "",
    ],
    cta: (ctx) =>
      ctx.links.registration_link
        ? { label: "Save a seat for the next one", href: ctx.links.registration_link }
        : null,
  },
  {
    key: "post_session",
    label: "Post-session follow-up",
    group: "post",
    trigger: "Sunday morning, people who attended",
    subject: () => "Your one page, and what happens next",
    heading: () => "Thank you for being in the room",
    body: (ctx) => [
      "You now have your real monthly number, your cushion target and a way to size your cover. That is more than most people ever write down.",
      "If you want the full structure — the templates, the order to do things in, and a monthly session to keep you honest — The One Page Plan programme is open.",
      ctx.links.whatsapp_link ? `Community group: ${ctx.links.whatsapp_link}` : "",
    ],
    offer: true,
  },
  ...nurtureCopy.map((copy, index) => ({
    key: `nurture_${index + 1}`,
    label: `Nurture ${index + 1} — ${copy.subject}`,
    group: "nurture" as const,
    trigger: `Day ${index + 1} after the session`,
    subject: () => copy.subject,
    heading: () => copy.heading,
    body: () => copy.body,
    offer: index >= 5,
  })),
  ...postPurchaseCopy.map((copy, index) => ({
    key: `post_purchase_${index + 1}`,
    label: `Post-purchase ${index + 1} — ${copy.subject}`,
    group: "purchase" as const,
    trigger:
      index === 0 ? "When tagged purchased" : `Day ${index * 7} after being tagged purchased`,
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
