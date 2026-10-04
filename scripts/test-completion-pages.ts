/**
 * Verification test suite for Prompt 3: Completion Pages
 * Run with: npx tsx scripts/test-completion-pages.ts
 */

import { escapeHtml, renderTemplateWithTokens } from "../src/lib/commerce/token-engine.server";
import { getDefaultTemplateForSlug } from "../src/lib/commerce/templates.server";
import { signOrderId, verifyOrderSignature, formatPlainDate } from "../src/lib/commerce/completion.server";
import { roundUp01, formatRupees } from "../src/lib/commerce/pricing.server";

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING VERIFICATION SUITE: PROMPT 3 COMPLETION PAGES");
  console.log("==================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${detail || ""}`);
    }
  }

  // 1. Token HTML-escaping & Injection
  const dirtyToken = "<script>alert('xss')</script> & <b>bold</b>";
  const escaped = escapeHtml(dirtyToken);
  assert(
    !escaped.includes("<script>") && escaped.includes("&lt;script&gt;") && escaped.includes("&amp;"),
    "Token Engine escapes HTML characters",
    escaped
  );

  // 2. Conditional Block Evaluation {{#if bonus}}...{{/if}}
  const templateWithBonus = "Hello {{first_name}}! {{#if bonus}}Bonus Granted: {{bonus_booking_url}}{{/if}} Good luck.";
  const renderedBonusTrue = await renderTemplateWithTokens(
    templateWithBonus,
    { first_name: "Rahul", bonus: true, bonus_booking_url: "https://cal.com/123" },
    "test-slug"
  );
  assert(
    renderedBonusTrue.html.includes("Bonus Granted: https://cal.com/123"),
    "Conditional {{#if bonus}} renders when bonus is true"
  );

  const renderedBonusFalse = await renderTemplateWithTokens(
    templateWithBonus,
    { first_name: "Rahul", bonus: false, bonus_booking_url: "https://cal.com/123" },
    "test-slug"
  );
  assert(
    !renderedBonusFalse.html.includes("Bonus Granted") && renderedBonusFalse.html.includes("Good luck."),
    "Conditional {{#if bonus}} hides block when bonus is false"
  );

  // 3. Unknown token & missing values logging
  const templateWithMissing = "Name: {{first_name}}, Unknown: {{non_existent_key}}, Missing: {{amount_paid}}";
  const renderedMissing = await renderTemplateWithTokens(
    templateWithMissing,
    { first_name: "Rahul", amount_paid: "" },
    "test-slug"
  );
  assert(
    renderedMissing.unknownTokens.includes("non_existent_key"),
    "Detects and logs unknown tokens"
  );
  assert(
    renderedMissing.missingValues.includes("amount_paid"),
    "Detects and logs missing values"
  );
  assert(
    renderedMissing.html === "Name: Rahul, Unknown: , Missing: ",
    "Renders unknown and missing tokens as empty string without crashing"
  );

  // 4. Default Fallback Templates for All Slugs
  const slugs = [
    "money-reality-check",
    "silver",
    "silver-upgrade",
    "gold",
    "diamond",
    "course-complete",
  ];
  let allDefaultsValid = true;
  for (const s of slugs) {
    const tpl = getDefaultTemplateForSlug(s);
    if (!tpl || !tpl.includes("<!DOCTYPE html>") || !tpl.includes("{{first_name}}")) {
      allDefaultsValid = false;
      break;
    }
  }
  assert(allDefaultsValid, "Default fallback templates exist and render for all 6 completion slugs");

  // 5. Order HMAC Token Signing & Tamper Verification
  const testOrderId = "c25c34cb-165b-43d5-94ee-9896580f4f7d";
  const signature = signOrderId(testOrderId);
  const isValid = verifyOrderSignature(testOrderId, signature);
  const isInvalidTampered = verifyOrderSignature("tampered-order-id", signature);
  assert(isValid && !isInvalidTampered, "Order HMAC token correctly verifies authenticity and rejects tampered IDs");

  // 6. Plain Date Formatting ("2 November 2026")
  const formattedDate = formatPlainDate("2026-11-02T10:00:00.000Z");
  assert(
    formattedDate.includes("November") && formattedDate.includes("2026"),
    `Date formats plainly as Day Month Year ("${formattedDate}")`
  );

  // 7. Currency Formatting (Rupees)
  const formattedRupees = formatRupees(18001);
  assert(formattedRupees === "₹18,001", `Currency formats correctly with Indian numbering: "${formattedRupees}"`);

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log("==================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
