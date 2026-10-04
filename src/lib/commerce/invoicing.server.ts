/**
 * Commerce Foundation: Invoice & Receipt Generator
 * Formats Indian FY sequential receipts/tax invoices, handles GST/non-GST layout,
 * credit lines, and renders clean printable HTML.
 */

import { createPublicServerClient } from "@/lib/supabase-public.server";

export interface InvoiceRecord {
  id: string;
  order_id: string;
  invoice_number: string;
  financial_year: string;
  document_type: "Receipt" | "Tax Invoice";
  legal_entity_name: string;
  registered_address: string;
  gstin: string | null;
  sac_code: string | null;
  buyer_name: string;
  buyer_email: string;
  product_id: string;
  product_name: string;
  includes_description: string;
  term_description: string;
  base_price: number;
  credit_applied: number;
  special_upgrade_discount: number;
  discount_amount: number;
  amount_paid: number;
  tax_breakup: Record<string, number> | null;
  download_token: string;
  issued_at: string;
}

export function generateFiscalYearInvoiceNumber(
  prefix: "INV" | "RCPT",
  sequenceNumber: number,
  date: Date = new Date(),
): string {
  const year = date.getFullYear();
  const fyStart = date.getMonth() >= 3 ? year : year - 1;
  const fyEndShort = String((fyStart + 1) % 100).padStart(2, "0");
  const seqPadded = String(sequenceNumber).padStart(4, "0");
  return `${prefix}-${fyStart}-${fyEndShort}/${seqPadded}`;
}

export async function getInvoiceByToken(token: string): Promise<InvoiceRecord | null> {
  const db = createPublicServerClient();
  const { data, error } = await db
    .from("invoices" as never)
    .select("*")
    .eq("download_token" as never, token as never)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data as unknown as InvoiceRecord;
}

export function renderInvoiceHtml(inv: InvoiceRecord): string {
  const isTaxInvoice = inv.document_type === "Tax Invoice" && Boolean(inv.gstin);
  const formattedDate = new Date(inv.issued_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${inv.document_type} - ${inv.invoice_number}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; background: #fdfdfd; margin: 0; padding: 24px; line-height: 1.5; }
    .invoice-card { max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 36px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #222; padding-bottom: 20px; margin-bottom: 24px; }
    .brand { font-size: 20px; font-weight: 700; color: #4A5A3A; }
    .doc-title { font-size: 22px; font-weight: 800; text-transform: uppercase; text-align: right; margin: 0; }
    .doc-meta { font-size: 12px; color: #666; text-align: right; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-size: 13px; margin-bottom: 24px; }
    .meta-col strong { display: block; font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th { text-align: left; padding: 10px 8px; background: #f7f7f7; border-bottom: 1px solid #ddd; font-size: 11px; text-transform: uppercase; color: #555; }
    td { padding: 12px 8px; border-bottom: 1px solid #eee; }
    .tar { text-align: right; }
    .total-row td { font-weight: 700; font-size: 15px; border-top: 2px solid #222; border-bottom: none; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; background: #e8eee4; color: #3b4e2d; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #777; text-align: center; }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice-card { border: none; box-shadow: none; padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="no-print" style="margin-bottom: 16px; text-align: right;">
      <button onclick="window.print()" style="background: #4A5A3A; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 600;">Print / Save PDF</button>
    </div>

    <div class="header">
      <div>
        <div class="brand">${inv.legal_entity_name}</div>
        <div style="font-size: 12px; color: #555; margin-top: 4px; max-width: 280px;">${inv.registered_address}</div>
        ${isTaxInvoice && inv.gstin ? `<div style="font-size: 12px; color: #333; margin-top: 2px;"><strong>GSTIN:</strong> ${inv.gstin}</div>` : ""}
      </div>
      <div>
        <h1 class="doc-title">${inv.document_type}</h1>
        <div class="doc-meta"><strong>No:</strong> ${inv.invoice_number}</div>
        <div class="doc-meta"><strong>Date:</strong> ${formattedDate}</div>
        <div class="doc-meta"><strong>FY:</strong> ${inv.financial_year}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <strong>Billed To:</strong>
        <div>${inv.buyer_name || "Valued Member"}</div>
        <div style="color: #666;">${inv.buyer_email}</div>
      </div>
      <div class="meta-col" style="text-align: right;">
        <strong>Membership Details:</strong>
        <div><span class="badge">${inv.product_name}</span></div>
        <div style="font-size: 12px; color: #555; margin-top: 4px;">${inv.term_description}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          ${isTaxInvoice && inv.sac_code ? `<th class="tar">SAC Code</th>` : ""}
          <th class="tar">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${inv.product_name}</strong>
            <div style="font-size: 11px; color: #666; margin-top: 2px;">${inv.includes_description}</div>
          </td>
          ${isTaxInvoice && inv.sac_code ? `<td class="tar">${inv.sac_code}</td>` : ""}
          <td class="tar">₹${inv.base_price.toLocaleString("en-IN")}</td>
        </tr>
        ${
          inv.credit_applied > 0
            ? `<tr>
                <td style="color: #2e7d32;">Less: Money Reality Check Upgrade Credit (₹601)</td>
                ${isTaxInvoice && inv.sac_code ? `<td></td>` : ""}
                <td class="tar" style="color: #2e7d32;">-₹${inv.credit_applied.toLocaleString("en-IN")}</td>
              </tr>`
            : ""
        }
        ${
          inv.special_upgrade_discount > 0
            ? `<tr>
                <td style="color: #2e7d32;">Less: Silver Completer Special Upgrade Benefit</td>
                ${isTaxInvoice && inv.sac_code ? `<td></td>` : ""}
                <td class="tar" style="color: #2e7d32;">-₹${inv.special_upgrade_discount.toLocaleString("en-IN")}</td>
              </tr>`
            : ""
        }
        ${
          inv.discount_amount > 0
            ? `<tr>
                <td style="color: #2e7d32;">Less: Promo Discount Code</td>
                ${isTaxInvoice && inv.sac_code ? `<td></td>` : ""}
                <td class="tar" style="color: #2e7d32;">-₹${inv.discount_amount.toLocaleString("en-IN")}</td>
              </tr>`
            : ""
        }
        ${
          isTaxInvoice
            ? `<tr>
                <td colspan="${inv.sac_code ? 2 : 1}" style="font-size: 11px; color: #666;">Inclusive of all applicable GST (9% CGST + 9% SGST / 18% IGST)</td>
                <td class="tar" style="font-size: 11px; color: #666;">Included</td>
              </tr>`
            : ""
        }
        <tr class="total-row">
          <td>Total Paid (INR)</td>
          ${isTaxInvoice && inv.sac_code ? `<td></td>` : ""}
          <td class="tar">₹${inv.amount_paid.toLocaleString("en-IN")}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <div>This is a computer-generated ${inv.document_type.toLowerCase()} for electronic delivery. Verified via payment gateway.</div>
      <div style="margin-top: 4px;">${inv.legal_entity_name} · connect@onepageplan.in · onepageplan.in</div>
    </div>
  </div>
</body>
</html>`;
}
