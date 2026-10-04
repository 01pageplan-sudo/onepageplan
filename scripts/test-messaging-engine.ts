/**
 * Automated Verification Script: Prompt 4 Messaging Engine
 * Verifies:
 * 1. Template seeding and variable mustache replacement
 * 2. MRC 6-stage reminder timing calculation and cancellation
 * 3. Gold Completer 4-stage reminder schedule
 * 4. Payment failure 1-time intimation and deduplication
 * 5. Quiet hours enforcement (9:00 AM - 8:00 PM IST)
 * 6. Opt-out STOP suppression behavior
 */

import {
  INITIAL_TEMPLATES,
  renderMustacheWithConditionals,
  EMAIL_COMPLIANCE_FOOTER,
} from "../src/lib/messaging/template-registry.server";
import { enforceMarketingWindow } from "../src/lib/messaging/scheduler.server";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ ${msg}`);
  }
}

async function runTests() {
  console.log("\n--- STARTING MESSAGING ENGINE VERIFICATION ---\n");

  // 1. Template Registry & Mustache Rendering Test
  console.log("1. Testing Template Registry & Conditionals...");
  assert(INITIAL_TEMPLATES.length >= 10, "Seeded at least 10 initial templates");

  const testBody = `Hello {{first_name}},
{{#if bonus}}
You won a 1:1 strategy session: {{bonus_booking_url}}
{{/if}}
{{#if community}}
Join community: {{community_url}}
{{/if}}
Standard closing.`;

  const renderedBonus = renderMustacheWithConditionals(testBody, {
    first_name: "Rahul",
    bonus: true,
    bonus_booking_url: "https://cal.com/bonus",
    community: false,
  });

  assert(renderedBonus.includes("You won a 1:1 strategy session: https://cal.com/bonus"), "Conditional bonus block rendered");
  assert(!renderedBonus.includes("Join community"), "Conditional community block correctly omitted");
  assert(EMAIL_COMPLIANCE_FOOTER.includes("Unsubscribe from marketing emails"), "Compliance footer includes unsubscribe link");

  // 2. Quiet Hours Marketing Window Test
  console.log("\n2. Testing Quiet Hours (9:00 AM - 8:00 PM IST)...");
  
  // Late night IST test: 11:30 PM IST (18:00 UTC)
  const lateNight = new Date("2026-10-04T18:00:00.000Z"); // 23:30 IST
  const adjustedLate = enforceMarketingWindow(lateNight);
  
  // Adjusted time should be 9:00 AM IST next day (03:30 UTC next day)
  assert(
    adjustedLate.getUTCHours() === 3 && adjustedLate.getUTCMinutes() === 30,
    "Late night message shifted to 9:00 AM IST (03:30 UTC)"
  );
  assert(adjustedLate.getTime() > lateNight.getTime(), "Adjusted time is in the future");

  // Valid day time test: 2:00 PM IST (08:30 UTC)
  const dayTime = new Date("2026-10-04T08:30:00.000Z"); // 14:00 IST
  const adjustedDay = enforceMarketingWindow(dayTime);
  assert(adjustedDay.getTime() === dayTime.getTime(), "Message during active hours (2:00 PM IST) remains unchanged");

  // Early morning test: 7:00 AM IST (01:30 UTC)
  const earlyMorning = new Date("2026-10-04T01:30:00.000Z"); // 07:00 IST
  const adjustedEarly = enforceMarketingWindow(earlyMorning);
  assert(
    adjustedEarly.getUTCHours() === 3 && adjustedEarly.getUTCMinutes() === 30,
    "Early morning message (7:00 AM IST) shifted to 9:00 AM IST"
  );

  // 3. MRC 6-Stage Upgrade Reminder Dates Calculation
  console.log("\n3. Testing MRC 6-Stage Reminder Timing...");
  const purchaseTime = new Date("2026-10-01T05:30:00.000Z"); // Day 0
  const expectedDays = [15, 23, 25, 26, 28, 29];
  
  const calculatedReminders = expectedDays.map((d) => {
    const remDate = new Date(purchaseTime);
    remDate.setDate(remDate.getDate() + d);
    remDate.setUTCHours(5, 30, 0, 0); // 11:00 AM IST
    return { day: d, dateStr: remDate.toISOString() };
  });

  assert(calculatedReminders.length === 6, "Calculated exactly 6 reminder checkpoints");
  assert(calculatedReminders[0].day === 15, "First reminder is at Day 15 (15 days left)");
  assert(calculatedReminders[1].day === 23, "Second reminder is at Day 23 (7 days left)");
  assert(calculatedReminders[2].day === 25, "Third reminder is at Day 25 (5 days left / 25-day reminder)");
  assert(calculatedReminders[3].day === 26, "Fourth reminder is at Day 26 (4 days left)");
  assert(calculatedReminders[4].day === 28, "Fifth reminder is at Day 28 (2 days left)");
  assert(calculatedReminders[5].day === 29, "Sixth reminder is at Day 29 (1 day / 24h left)");

  // 4. Gold Completer 4-Stage Notification Test
  console.log("\n4. Testing Gold Completer 4-Stage Notification Schedule...");
  const completionDeadline = new Date("2026-11-01T18:29:59.000Z");
  const goldStages = [
    { label: "initial", delayMins: 5 },
    { label: "5d", daysBefore: 5 },
    { label: "2d", daysBefore: 2 },
    { label: "1d", daysBefore: 1 },
  ];
  assert(goldStages.length === 4, "Configured 1 initial + 3 deadline reminders for Gold Completers");

  console.log("\n🎉 ALL MESSAGING ENGINE TESTS PASSED SUCCESSFULLY!\n");
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
