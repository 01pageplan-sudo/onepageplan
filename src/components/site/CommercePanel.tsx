import { useState, useMemo } from "react";
import {
  DollarSign,
  Download,
  RefreshCw,
  Plus,
  AlertCircle,
  CheckCircle2,
  Lock,
  Tag,
  Users,
  ShieldCheck,
  TrendingUp,
  Percent,
  Link as LinkIcon,
  HelpCircle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  adminProcessRefund,
  adminSaveCommerceSettings,
  adminCreateManualGrant,
  adminRunReconciliation,
  adminBulkUploadMembers,
  adminSaveDiscountCode,
  adminSaveReferralPartner,
  adminSaveCompletionTemplate,
  adminRollbackCompletionTemplate,
  type AdminCommerceOrder,
  type AdminManualGrant,
  type AdminReconciliationFlag,
  type AdminDiscountCode,
  type AdminReferralPartner,
  type AdminReferralConversion,
  type AdminCompletionTemplate,
} from "@/lib/admin.functions";

interface CommercePanelProps {
  password: string;
  data: {
    mode: "test" | "live";
    settings: Record<string, any>;
    cohorts: Array<any>;
    orders: AdminCommerceOrder[];
    manualGrants: AdminManualGrant[];
    reconciliationFlags: AdminReconciliationFlag[];
    discountCodes: AdminDiscountCode[];
    referralPartners: AdminReferralPartner[];
    referralConversions: AdminReferralConversion[];
    completionTemplates?: AdminCompletionTemplate[];
    milestoneInfo: {
      activeCount: number;
      currentPrice: number;
      nextThreshold: number | null;
      nextPrice: number | null;
    };
    fyCapturedTotal: number;
    allTimeTotal: number;
    currentFy: string;
  };
  onRefresh: () => void;
}

export function CommercePanel({ password, data, onRefresh }: CommercePanelProps) {
  const [subTab, setSubTab] = useState<
    "orders" | "settings" | "manual" | "upload" | "discounts" | "referrals" | "templates" | "reconciliation"
  >("orders");

  const [filterProduct, setFilterProduct] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Template editor state
  const [templateSlug, setTemplateSlug] = useState<
    "money-reality-check" | "silver" | "silver-upgrade" | "gold" | "diamond" | "course-complete"
  >("money-reality-check");
  const [templateHtml, setTemplateHtml] = useState("");
  const [templateNotes, setTemplateNotes] = useState("");

  // Editable settings state
  const [settingsForm, setSettingsForm] = useState(() => ({
    legal_entity_name: data.settings?.legal_entity_name || "Manrrs Wellness LLP",
    registered_address: data.settings?.registered_address || "India",
    gstin: data.settings?.gstin || "",
    sac_code: data.settings?.sac_code || "",
    community_url: data.settings?.community_url || "",
    gold_on_sale: Boolean(data.settings?.gold_on_sale),
    diamond_on_sale: Boolean(data.settings?.diamond_on_sale),
    mrc_base_price: data.settings?.mrc_base_price ?? 601,
    silver_base_price: data.settings?.silver_base_price ?? 6001,
    gold_base_price: data.settings?.gold_base_price ?? 24000,
    gold_completer_price: data.settings?.gold_completer_price ?? 18001,
    diamond_base_price: data.settings?.diamond_base_price ?? 60001,
    diamond_renewal_price: data.settings?.diamond_renewal_price ?? 60001,
    bonus_cohort_count: data.settings?.bonus_cohort_count ?? 2,
    bonus_per_cohort_count: data.settings?.bonus_per_cohort_count ?? 10,
    late_joiner_cohort_id: data.settings?.late_joiner_cohort_id || "",
    mrc_included_bullets:
      data.settings?.mrc_included_bullets ||
      "• Money Reality Check 12 recorded diagnostic sessions\n• 4 diagnostic calculator & audit sheets\n• 1 Thursday guest seat (valid for 60 days)\n• 60 days of community access",
    silver_included_bullets:
      data.settings?.silver_included_bullets ||
      "• Full consolidated financial audit spreadsheet & training\n• Real return calculation model (accounting for 30% tax & inflation)\n• Nomination, MWP Act & insurance protection architecture checklist\n• The One Page Plan template your family can act on\n• Direct access to recorded video sessions with zero expiration",
    gold_included_bullets:
      data.settings?.gold_included_bullets ||
      "• Includes Silver: Lifetime access\n• Advanced wealth transmission & private office sessions\n• Quarterly portfolio architecture reviews\n• Priority cohort positioning",
    diamond_included_bullets:
      data.settings?.diamond_included_bullets ||
      "• Includes Silver and Gold: Lifetime access\n• 12 months of direct Diamond private office advisory\n• Bespoke estate, trust & tax optimization architecture\n• Direct 1-on-1 private advisory access",
    policy_terms_markdown: data.settings?.policy_terms_markdown || "",
    policy_privacy_markdown: data.settings?.policy_privacy_markdown || "",
    policy_refund_markdown: data.settings?.policy_refund_markdown || "",
    policy_shipping_markdown: data.settings?.policy_shipping_markdown || "",
    policy_contact_markdown: data.settings?.policy_contact_markdown || "",
    silver_milestones: Array.isArray(data.settings?.silver_milestones)
      ? data.settings.silver_milestones
      : [{ threshold: 100, price: 7001 }],
  }));

  // Manual grant form state
  const [grantEmail, setGrantEmail] = useState("");
  const [grantName, setGrantName] = useState("");
  const [grantPhone, setGrantPhone] = useState("");
  const [grantProduct, setGrantProduct] = useState("silver");
  const [grantNote, setGrantNote] = useState("");

  // Bulk upload state
  const [bulkCsvText, setBulkCsvText] = useState("");

  // Discount form state
  const [newDiscountCode, setNewDiscountCode] = useState("");
  const [newDiscountType, setNewDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [newDiscountValue, setNewDiscountValue] = useState(500);

  // Referral partner form state
  const [newPartnerCode, setNewPartnerCode] = useState("");
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerEmail, setNewPartnerEmail] = useState("");
  const [newPartnerReward, setNewPartnerReward] = useState(10);

  const showNotice = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return data.orders.filter((o) => {
      if (filterProduct !== "all" && o.product_id !== filterProduct) return false;
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const emailMatch = o.buyer_email?.toLowerCase().includes(q);
        const nameMatch = o.buyer_name?.toLowerCase().includes(q);
        const orderIdMatch = o.razorpay_order_id?.toLowerCase().includes(q);
        if (!emailMatch && !nameMatch && !orderIdMatch) return false;
      }
      return true;
    });
  }, [data.orders, filterProduct, filterStatus, searchQuery]);

  // Handle Save Settings
  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const res = await adminSaveCommerceSettings({
        data: {
          password,
          settings: settingsForm,
        },
      });
      if (res.ok) {
        showNotice("Commerce settings saved successfully.");
        onRefresh();
      } else {
        showNotice(res.error || "Failed to save settings.", "error");
      }
    } catch (err: any) {
      showNotice(err?.message || "Error saving settings.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle Refund Trigger
  const handleRefund = async (orderId: string, amount: number) => {
    if (!confirm(`Are you sure you want to refund ₹${amount}? This will trigger Razorpay refund and revoke product access.`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await adminProcessRefund({
        data: { password, orderId },
      });
      if (res.ok) {
        showNotice(`Refund processed successfully. Refund ID: ${res.refundId || "Completed"}`);
        onRefresh();
      } else {
        showNotice(res.error || "Refund failed.", "error");
      }
    } catch (err: any) {
      showNotice(err?.message || "Refund error.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle Manual Grant
  const handleCreateGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantNote.trim()) {
      showNotice("Reason note is required.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await adminCreateManualGrant({
        data: {
          password,
          email: grantEmail,
          name: grantName,
          phone: grantPhone,
          productId: grantProduct,
          reasonNote: grantNote,
        },
      });
      if (res.ok) {
        showNotice("Manual access grant recorded.");
        setGrantEmail("");
        setGrantName("");
        setGrantPhone("");
        setGrantNote("");
        onRefresh();
      } else {
        showNotice(res.error || "Failed to record grant.", "error");
      }
    } catch (err: any) {
      showNotice(err?.message || "Error creating grant.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle Bulk Upload
  const handleBulkUpload = async () => {
    if (!bulkCsvText.trim()) return;
    const lines = bulkCsvText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const users: Array<Record<string, any>> = [];
    for (const line of lines) {
      // Expect CSV: email, name, phone, tier, cohort_number, notes
      const parts = line.split(",").map((p) => p.trim());
      if (parts[0] && parts[0].includes("@")) {
        users.push({
          email: parts[0],
          name: parts[1] || "",
          phone: parts[2] || "",
          tier: parts[3] || "silver",
          cohort_number: parts[4] ? Number(parts[4]) : undefined,
          notes: parts[5] || "Bulk imported member",
        });
      }
    }

    if (users.length === 0) {
      showNotice("No valid email addresses found in input.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await adminBulkUploadMembers({
        data: { password, users },
      });
      if (res.ok) {
        showNotice(`Imported ${res.importedCount} members successfully.`);
        setBulkCsvText("");
        onRefresh();
      } else {
        showNotice(res.error || "Bulk upload failed.", "error");
      }
    } catch (err: any) {
      showNotice(err?.message || "Error uploading users.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle Create Discount Code
  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscountCode.trim()) return;
    setLoading(true);
    try {
      const res = await adminSaveDiscountCode({
        data: {
          password,
          code: newDiscountCode.trim().toUpperCase(),
          discountType: newDiscountType,
          discountValue: Number(newDiscountValue),
          isActive: true,
        },
      });
      if (res.ok) {
        showNotice(`Discount code ${newDiscountCode.toUpperCase()} created.`);
        setNewDiscountCode("");
        onRefresh();
      } else {
        showNotice(res.error || "Failed to create discount code.", "error");
      }
    } catch (err: any) {
      showNotice(err?.message || "Error saving discount code.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle Create Referral Partner
  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerCode.trim() || !newPartnerEmail.trim()) return;
    setLoading(true);
    try {
      const res = await adminSaveReferralPartner({
        data: {
          password,
          code: newPartnerCode.trim().toLowerCase(),
          partnerName: newPartnerName.trim() || newPartnerCode,
          partnerEmail: newPartnerEmail.trim().toLowerCase(),
          rewardType: "percentage",
          rewardValue: Number(newPartnerReward),
          isActive: true,
        },
      });
      if (res.ok) {
        showNotice(`Referral partner @${newPartnerCode.toLowerCase()} registered.`);
        setNewPartnerCode("");
        setNewPartnerName("");
        setNewPartnerEmail("");
        onRefresh();
      } else {
        showNotice(res.error || "Failed to save referral partner.", "error");
      }
    } catch (err: any) {
      showNotice(err?.message || "Error saving partner.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle Save / Upload Template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateHtml.trim()) {
      showNotice("HTML content is required.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await adminSaveCompletionTemplate({
        data: {
          password,
          slug: templateSlug,
          htmlContent: templateHtml,
          notes: templateNotes || undefined,
        },
      });
      if (res.ok) {
        showNotice(`Active HTML template saved for /complete/${templateSlug} (version ${res.result?.version}).`);
        setTemplateHtml("");
        setTemplateNotes("");
        onRefresh();
      } else {
        showNotice(res.error || "Failed to save template.", "error");
      }
    } catch (err: any) {
      showNotice(err?.message || "Error saving template.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle Rollback Template
  const handleRollbackTemplate = async (slug: string, targetVersion: number) => {
    if (!confirm(`Are you sure you want to rollback /complete/${slug} to version ${targetVersion}?`)) return;
    setLoading(true);
    try {
      const res = await adminRollbackCompletionTemplate({
        data: {
          password,
          slug,
          targetVersion,
        },
      });
      if (res.ok) {
        showNotice(`Rolled back /complete/${slug} to version ${targetVersion}.`);
        onRefresh();
      } else {
        showNotice(res.error || "Rollback failed.", "error");
      }
    } catch (err: any) {
      showNotice(err?.message || "Error rolling back template.", "error");
    } finally {
      setLoading(false);
    }
  };


  // CSV Exporters
  const exportOrdersCsv = () => {
    const headers = [
      "Order Date",
      "Order ID",
      "Payment ID",
      "Product",
      "Pricing Rule",
      "Base Price",
      "Credit Applied",
      "Discount Applied",
      "Total Paid",
      "Buyer Name",
      "Buyer Email",
      "Buyer Phone",
      "Status",
    ];
    const rows = filteredOrders.map((o) => [
      new Date(o.created_at).toISOString(),
      o.razorpay_order_id || o.id,
      o.razorpay_payment_id || "",
      o.product_id,
      o.pricing_rule_applied,
      o.base_price,
      o.credit_applied,
      o.discount_amount,
      o.amount_charged,
      `"${(o.buyer_name || "").replace(/"/g, '""')}"`,
      o.buyer_email,
      o.buyer_phone || "",
      o.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `orders_${Date.now()}.csv`);
    link.click();
  };

  const exportGrantsCsv = () => {
    const headers = ["Date", "Email", "Name", "Phone", "Product", "Reason Note", "Granted By"];
    const rows = data.manualGrants.map((g) => [
      new Date(g.created_at).toISOString(),
      g.email,
      `"${(g.name || "").replace(/"/g, '""')}"`,
      g.phone || "",
      g.product_id,
      `"${(g.reason_note || "").replace(/"/g, '""')}"`,
      g.granted_by,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `manual_grants_${Date.now()}.csv`);
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP METRICS & RAZORPAY MODE INDICATOR */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Razorpay Mode Card */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Gateway Mode
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                data.mode === "live"
                  ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-700 border border-amber-500/30"
              }`}
            >
              {data.mode === "live" ? "Live Mode" : "Test Mode (rzp_test)"}
            </span>
          </div>
          <div className="text-lg font-bold text-foreground">
            {data.mode === "live" ? "Active Production" : "Development Sandbox"}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {data.mode === "live" ? "Real cards and UPI active" : "Test transactions; no live charges"}
          </p>
        </div>

        {/* Current Financial Year Revenue */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            FY {data.currentFy} Revenue
          </span>
          <div className="text-2xl font-bold text-primary font-mono">
            ₹{data.fyCapturedTotal.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-muted-foreground">
            From captured orders since 1 April {data.currentFy.split("-")[0]}
          </p>
        </div>

        {/* All-time Revenue */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            All-Time Revenue
          </span>
          <div className="text-2xl font-bold text-foreground font-mono">
            ₹{data.allTimeTotal.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-muted-foreground">Total captured transactions</p>
        </div>

        {/* Silver Milestone Counter */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Silver Members
            </span>
            <span className="text-xs font-mono font-bold text-[var(--brass)]">
              {data.milestoneInfo.activeCount} Paid
            </span>
          </div>
          <div className="text-lg font-bold text-foreground">
            Current: ₹{data.milestoneInfo.currentPrice.toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {data.milestoneInfo.nextThreshold
              ? `Rises to ₹${data.milestoneInfo.nextPrice?.toLocaleString("en-IN")} at ${data.milestoneInfo.nextThreshold} members`
              : "Base pricing in effect"}
          </p>
        </div>
      </div>

      {/* NOTIFICATION MESSAGE */}
      {message ? (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="underline ml-4">
            Dismiss
          </button>
        </div>
      ) : null}

      {/* SUB-TABS NAVIGATION */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {[
          { id: "orders", label: `Orders (${data.orders.length})` },
          { id: "settings", label: "Commerce Settings" },
          { id: "manual", label: `Manual Grants (${data.manualGrants.length})` },
          { id: "upload", label: "Upload Existing Users" },
          { id: "discounts", label: `Discount Codes (${data.discountCodes.length})` },
          { id: "referrals", label: `Referral Tracking (${data.referralPartners.length})` },
          { id: "templates", label: `Completion Templates (${data.completionTemplates?.length || 0})` },
          { id: "reconciliation", label: `Reconciliation (${data.reconciliationFlags.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              subTab === tab.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 2. ORDERS SUB-TAB */}
      {subTab === "orders" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search email, name or order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs h-8 w-60"
              />
              <select
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="text-xs h-8 border border-border rounded-md px-2 bg-background text-foreground"
              >
                <option value="all">All Products</option>
                <option value="money_reality_check">Money Reality Check</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="diamond">Diamond</option>
                <option value="diamond_renewal">Diamond Renewal</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs h-8 border border-border rounded-md px-2 bg-background text-foreground"
              >
                <option value="all">All Statuses</option>
                <option value="captured">Captured (Paid)</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
                <option value="created">Created (Abandoned)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={exportOrdersCsv} className="h-8 text-xs">
                <Download className="h-3.5 w-3.5 mr-1" /> Export CSV ({filteredOrders.length})
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold">Buyer</th>
                  <th className="p-3 font-semibold">Product</th>
                  <th className="p-3 font-semibold">Rule / Credit</th>
                  <th className="p-3 font-semibold">Amount</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No matching orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{o.buyer_name || "Member"}</div>
                        <div className="text-muted-foreground font-mono text-[11px]">{o.buyer_email}</div>
                        {o.buyer_phone ? (
                          <div className="text-[10px] text-muted-foreground">{o.buyer_phone}</div>
                        ) : null}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-medium text-foreground">{o.product_id}</span>
                        {o.discount_code_applied ? (
                          <div className="text-[10px] text-emerald-600">Promo: {o.discount_code_applied}</div>
                        ) : null}
                        {o.referral_code_applied ? (
                          <div className="text-[10px] text-primary">Ref: {o.referral_code_applied}</div>
                        ) : null}
                      </td>
                      <td className="p-3 text-[11px]">
                        <span className="text-muted-foreground">{o.pricing_rule_applied}</span>
                        {o.credit_applied > 0 ? (
                          <div className="text-emerald-600 font-medium">-₹{o.credit_applied} MRC credit</div>
                        ) : null}
                      </td>
                      <td className="p-3 font-bold text-foreground font-mono whitespace-nowrap">
                        ₹{o.amount_charged.toLocaleString("en-IN")}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            o.status === "captured"
                              ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30"
                              : o.status === "refunded"
                              ? "bg-destructive/15 text-destructive border border-destructive/30"
                              : o.status === "failed"
                              ? "bg-amber-500/15 text-amber-700 border border-amber-500/30"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {o.status === "captured" ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={loading}
                            onClick={() => handleRefund(o.id, o.amount_charged)}
                            className="h-7 text-[11px] px-2.5"
                          >
                            Full Refund
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* 3. COMMERCE SETTINGS SUB-TAB */}
      {subTab === "settings" ? (
        <div className="space-y-6 max-w-4xl">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Base Product Prices */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <DollarSign className="h-4 w-4 text-primary" /> Product Base Prices (INR, Tax Inclusive)
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <Label className="text-xs">Money Reality Check Base Price (₹)</Label>
                  <Input
                    type="number"
                    value={settingsForm.mrc_base_price}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, mrc_base_price: Number(e.target.value) }))}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Silver Base Price (₹) (Subject to milestones)</Label>
                  <Input
                    type="number"
                    value={settingsForm.silver_base_price}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, silver_base_price: Number(e.target.value) }))}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Gold Base Price (₹)</Label>
                  <Input
                    type="number"
                    value={settingsForm.gold_base_price}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, gold_base_price: Number(e.target.value) }))}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Silver Completer Special Gold Upgrade Price (₹)</Label>
                  <Input
                    type="number"
                    value={settingsForm.gold_completer_price}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, gold_completer_price: Number(e.target.value) }))}
                    className="h-8 text-xs mt-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Fixed special price for completers until deadline.</p>
                </div>
                <div>
                  <Label className="text-xs">Diamond Base Price (₹ / Year)</Label>
                  <Input
                    type="number"
                    value={settingsForm.diamond_base_price}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, diamond_base_price: Number(e.target.value) }))}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Diamond Annual Renewal Price (₹)</Label>
                  <Input
                    type="number"
                    value={settingsForm.diamond_renewal_price}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, diamond_renewal_price: Number(e.target.value) }))}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>
            </div>

            {/* On-Sale Switches & 1:1 Bonus */}
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Lock className="h-4 w-4 text-[var(--brass)]" /> On-Sale Switches
                </h3>
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                    <div>
                      <div className="font-semibold text-foreground">Gold On-Sale Switch</div>
                      <div className="text-muted-foreground text-[11px]">
                        {settingsForm.gold_on_sale ? "Gold can be bought by eligible members" : "Gold cannot be bought by anyone"}
                      </div>
                    </div>
                    <Switch
                      checked={settingsForm.gold_on_sale}
                      onCheckedChange={(checked) => setSettingsForm((p) => ({ ...p, gold_on_sale: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                    <div>
                      <div className="font-semibold text-foreground">Diamond On-Sale Switch</div>
                      <div className="text-muted-foreground text-[11px]">
                        {settingsForm.diamond_on_sale ? "Diamond can be bought & renewed" : "Diamond cannot be bought or renewed"}
                      </div>
                    </div>
                    <Switch
                      checked={settingsForm.diamond_on_sale}
                      onCheckedChange={(checked) => setSettingsForm((p) => ({ ...p, diamond_on_sale: checked }))}
                    />
                  </div>
                </div>
              </div>

              {/* 1:1 Bonus Settings */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Users className="h-4 w-4 text-primary" /> 1:1 Bonus Session Config
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <Label className="text-xs">Number of Bonus Cohorts</Label>
                    <Input
                      type="number"
                      value={settingsForm.bonus_cohort_count}
                      onChange={(e) => setSettingsForm((p) => ({ ...p, bonus_cohort_count: Number(e.target.value) }))}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Bonus Spots Per Cohort</Label>
                    <Input
                      type="number"
                      value={settingsForm.bonus_per_cohort_count}
                      onChange={(e) => setSettingsForm((p) => ({ ...p, bonus_per_cohort_count: Number(e.target.value) }))}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  First {settingsForm.bonus_per_cohort_count} buyers in the first {settingsForm.bonus_cohort_count} cohorts receive 1:1 flag automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Silver Milestone Table */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <TrendingUp className="h-4 w-4 text-emerald-600" /> Silver Price Milestone Table
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSettingsForm((p) => ({
                    ...p,
                    silver_milestones: [...p.silver_milestones, { threshold: 200, price: 8001 }],
                  }));
                }}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" /> Add Milestone
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Price rises after every 100 members. Active Silver count currently:{" "}
              <strong>{data.milestoneInfo.activeCount} members</strong>.
            </p>
            <div className="space-y-2">
              {settingsForm.silver_milestones.map((m: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <div className="w-1/2">
                    <Label className="text-[11px]">Member Count Threshold</Label>
                    <Input
                      type="number"
                      value={m.threshold}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSettingsForm((p) => {
                          const updated = [...p.silver_milestones];
                          updated[idx].threshold = val;
                          return { ...p, silver_milestones: updated };
                        });
                      }}
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                  <div className="w-1/2">
                    <Label className="text-[11px]">Price After Threshold (₹)</Label>
                    <Input
                      type="number"
                      value={m.price}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSettingsForm((p) => {
                          const updated = [...p.silver_milestones];
                          updated[idx].price = val;
                          return { ...p, silver_milestones: updated };
                        });
                      }}
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsForm((p) => ({
                        ...p,
                        silver_milestones: p.silver_milestones.filter((_: any, i: number) => i !== idx),
                      }));
                    }}
                    className="text-destructive hover:underline text-xs mt-4"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Legal Entity & Invoicing Details */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <FileText className="h-4 w-4 text-[var(--brass)]" /> Legal Entity & Invoicing Settings
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div>
                <Label className="text-xs">Legal Entity Name</Label>
                <Input
                  value={settingsForm.legal_entity_name}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, legal_entity_name: e.target.value }))}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Registered Address</Label>
                <Input
                  value={settingsForm.registered_address}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, registered_address: e.target.value }))}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">GSTIN (Leave blank for Receipt)</Label>
                <Input
                  value={settingsForm.gstin}
                  placeholder="e.g. 27ABCDE1234F1Z5"
                  onChange={(e) => setSettingsForm((p) => ({ ...p, gstin: e.target.value }))}
                  className="h-8 text-xs mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  While blank, document is "Receipt" with no tax lines. When filled, becomes "Tax Invoice".
                </p>
              </div>
              <div>
                <Label className="text-xs">SAC Code</Label>
                <Input
                  value={settingsForm.sac_code}
                  placeholder="e.g. 999293"
                  onChange={(e) => setSettingsForm((p) => ({ ...p, sac_code: e.target.value }))}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <Label className="text-xs">WhatsApp / Member Community URL (Blank by default)</Label>
              <Input
                value={settingsForm.community_url}
                placeholder="https://chat.whatsapp.com/..."
                onChange={(e) => setSettingsForm((p) => ({ ...p, community_url: e.target.value }))}
                className="h-8 text-xs mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                While blank, nothing about community is shown. When set, each buyer's 60 days run from purchase date or date set.
              </p>
            </div>
          </div>

          {/* Product What's Included Lists */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Tag className="h-4 w-4 text-primary" /> Product "What's Included" Lists (One bullet per line)
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div>
                <Label className="text-xs font-semibold">Money Reality Check Included List</Label>
                <Textarea
                  rows={4}
                  value={settingsForm.mrc_included_bullets}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, mrc_included_bullets: e.target.value }))}
                  className="mt-1 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Silver (The Calm Money System) Included List</Label>
                <Textarea
                  rows={4}
                  value={settingsForm.silver_included_bullets}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, silver_included_bullets: e.target.value }))}
                  className="mt-1 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Gold Included List</Label>
                <Textarea
                  rows={4}
                  value={settingsForm.gold_included_bullets}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, gold_included_bullets: e.target.value }))}
                  className="mt-1 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Diamond Included List</Label>
                <Textarea
                  rows={4}
                  value={settingsForm.diamond_included_bullets}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, diamond_included_bullets: e.target.value }))}
                  className="mt-1 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Legal Policies Markdown */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-[var(--brass)]" /> Legal Policies (Markdown Content)
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Leave blank to show "This policy is being updated." (or standard default for Terms & Privacy).
            </p>
            <div className="space-y-4 text-xs">
              <div>
                <Label className="text-xs font-semibold">Terms of Use Policy Markdown (/terms)</Label>
                <Textarea
                  rows={3}
                  value={settingsForm.policy_terms_markdown}
                  placeholder="Custom terms markdown..."
                  onChange={(e) => setSettingsForm((p) => ({ ...p, policy_terms_markdown: e.target.value }))}
                  className="mt-1 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Privacy Policy Markdown (/privacy)</Label>
                <Textarea
                  rows={3}
                  value={settingsForm.policy_privacy_markdown}
                  placeholder="Custom privacy policy markdown..."
                  onChange={(e) => setSettingsForm((p) => ({ ...p, policy_privacy_markdown: e.target.value }))}
                  className="mt-1 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Cancellation & Refund Policy Markdown (/refund-policy)</Label>
                <Textarea
                  rows={3}
                  value={settingsForm.policy_refund_markdown}
                  placeholder="Custom refund policy markdown..."
                  onChange={(e) => setSettingsForm((p) => ({ ...p, policy_refund_markdown: e.target.value }))}
                  className="mt-1 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Shipping & Delivery Policy Markdown (/shipping-policy)</Label>
                <Textarea
                  rows={3}
                  value={settingsForm.policy_shipping_markdown}
                  placeholder="Custom shipping & digital delivery policy markdown..."
                  onChange={(e) => setSettingsForm((p) => ({ ...p, policy_shipping_markdown: e.target.value }))}
                  className="mt-1 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Additional Contact Info Markdown (/contact)</Label>
                <Textarea
                  rows={2}
                  value={settingsForm.policy_contact_markdown}
                  placeholder="Additional support hours, escalation contacts..."
                  onChange={(e) => setSettingsForm((p) => ({ ...p, policy_contact_markdown: e.target.value }))}
                  className="mt-1 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <Button onClick={handleSaveSettings} disabled={loading} className="w-full">
            {loading ? "Saving Settings..." : "Save All Commerce Settings"}
          </Button>
        </div>
      ) : null}

      {/* 4. MANUAL GRANTS SUB-TAB */}
      {subTab === "manual" ? (
        <div className="space-y-6 max-w-4xl">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Plus className="h-4 w-4 text-primary" /> Grant Access Manually (Offline Payment)
            </h3>
            <form onSubmit={handleCreateGrant} className="grid gap-3 sm:grid-cols-2 text-xs">
              <div>
                <Label className="text-xs">Member Email *</Label>
                <Input
                  type="email"
                  required
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Member Name</Label>
                <Input
                  value={grantName}
                  onChange={(e) => setGrantName(e.target.value)}
                  placeholder="Full Name"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Phone (E.164)</Label>
                <Input
                  value={grantPhone}
                  onChange={(e) => setGrantPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Product Tier *</Label>
                <select
                  value={grantProduct}
                  onChange={(e) => setGrantProduct(e.target.value)}
                  className="w-full h-8 text-xs border border-border rounded-md px-2 bg-background text-foreground mt-1"
                >
                  <option value="money_reality_check">Money Reality Check (12 videos)</option>
                  <option value="silver">Silver (The Calm Money System)</option>
                  <option value="gold">Gold Master Access</option>
                  <option value="diamond">Diamond Elite Access</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Reason Note (Required for offline audit) *</Label>
                <Input
                  required
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                  placeholder="e.g. Offline bank transfer verified on 03/10/2026, UTR: XYZ"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={loading} size="sm" className="w-full">
                  Record Manual Grant & Unlock Access
                </Button>
              </div>
            </form>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Recorded Manual Grants ({data.manualGrants.length})</h3>
            <Button size="sm" variant="outline" onClick={exportGrantsCsv} className="h-8 text-xs">
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold">Email</th>
                  <th className="p-3 font-semibold">Tier</th>
                  <th className="p-3 font-semibold">Reason Note</th>
                  <th className="p-3 font-semibold">Granted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.manualGrants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No manual offline grants recorded yet.
                    </td>
                  </tr>
                ) : (
                  data.manualGrants.map((g) => (
                    <tr key={g.id}>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(g.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td className="p-3 font-mono text-foreground">{g.email}</td>
                      <td className="p-3 font-bold">{g.product_id}</td>
                      <td className="p-3 text-muted-foreground">{g.reason_note}</td>
                      <td className="p-3 text-[11px] font-mono">{g.granted_by}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* 5. UPLOAD EXISTING USERS SUB-TAB */}
      {subTab === "upload" ? (
        <div className="space-y-4 max-w-3xl">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Users className="h-4 w-4 text-primary" /> Bulk Upload Existing Members
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Paste CSV lines with existing members to grant instant multi-source access. Format:
                <br />
                <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">
                  email, name, phone, tier (silver/gold/diamond/mrc), cohort_number, notes
                </code>
              </p>
            </div>

            <textarea
              rows={8}
              value={bulkCsvText}
              onChange={(e) => setBulkCsvText(e.target.value)}
              placeholder="user1@example.com, Milan Dodhia, +919876543210, silver, 1, Existing batch buyer&#10;user2@example.com, Rahul Shah, +919123456789, gold, 1, Direct gold completer"
              className="w-full text-xs font-mono p-3 border border-border rounded-lg bg-background text-foreground"
            />

            <Button onClick={handleBulkUpload} disabled={loading || !bulkCsvText.trim()} className="w-full">
              {loading ? "Processing Batch Import..." : "Import Users Now"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* 6. DISCOUNT CODES SUB-TAB */}
      {subTab === "discounts" ? (
        <div className="space-y-6 max-w-4xl">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Tag className="h-4 w-4 text-emerald-600" /> Create New Discount Code
            </h3>
            <form onSubmit={handleCreateDiscount} className="grid gap-3 sm:grid-cols-3 text-xs">
              <div>
                <Label className="text-xs">Coupon Code *</Label>
                <Input
                  required
                  value={newDiscountCode}
                  onChange={(e) => setNewDiscountCode(e.target.value)}
                  placeholder="e.g. VIP500"
                  className="h-8 text-xs uppercase font-mono mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <select
                  value={newDiscountType}
                  onChange={(e) => setNewDiscountType(e.target.value as any)}
                  className="w-full h-8 text-xs border border-border rounded-md px-2 bg-background text-foreground mt-1"
                >
                  <option value="fixed">Fixed INR Amount (₹)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Value ({newDiscountType === "fixed" ? "₹" : "%"})</Label>
                <Input
                  type="number"
                  required
                  value={newDiscountValue}
                  onChange={(e) => setNewDiscountValue(Number(e.target.value))}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" disabled={loading} size="sm" className="w-full">
                  Create Coupon Code
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-3 font-semibold">Code</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Value</th>
                  <th className="p-3 font-semibold">Usage Count</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.discountCodes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No discount codes created yet.
                    </td>
                  </tr>
                ) : (
                  data.discountCodes.map((d) => (
                    <tr key={d.id}>
                      <td className="p-3 font-mono font-bold text-foreground">{d.code}</td>
                      <td className="p-3 text-muted-foreground uppercase">{d.discount_type}</td>
                      <td className="p-3 font-semibold">
                        {d.discount_type === "fixed" ? `₹${d.discount_value}` : `${d.discount_value}%`}
                      </td>
                      <td className="p-3 font-mono">{d.used_count} uses</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700">
                          {d.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* 7. REFERRAL TRACKING SUB-TAB */}
      {subTab === "referrals" ? (
        <div className="space-y-6 max-w-4xl">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <LinkIcon className="h-4 w-4 text-primary" /> Register Referral Partner
            </h3>
            <form onSubmit={handleCreatePartner} className="grid gap-3 sm:grid-cols-4 text-xs">
              <div>
                <Label className="text-xs">Partner Code *</Label>
                <Input
                  required
                  value={newPartnerCode}
                  onChange={(e) => setNewPartnerCode(e.target.value)}
                  placeholder="e.g. milan"
                  className="h-8 text-xs font-mono mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Partner Name</Label>
                <Input
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  placeholder="Partner Name"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Partner Email *</Label>
                <Input
                  type="email"
                  required
                  value={newPartnerEmail}
                  onChange={(e) => setNewPartnerEmail(e.target.value)}
                  placeholder="partner@example.com"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Reward (%)</Label>
                <Input
                  type="number"
                  value={newPartnerReward}
                  onChange={(e) => setNewPartnerReward(Number(e.target.value))}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div className="sm:col-span-4">
                <Button type="submit" disabled={loading} size="sm" className="w-full">
                  Create Referral Link & Partner
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h4 className="text-xs font-bold text-foreground">Active Referral Partners ({data.referralPartners.length})</h4>
            <div className="space-y-1.5 text-xs">
              {data.referralPartners.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-background">
                  <div>
                    <span className="font-bold font-mono text-primary">?ref={p.code}</span>
                    <span className="text-muted-foreground ml-2">({p.partner_name} · {p.partner_email})</span>
                  </div>
                  <span className="font-semibold text-emerald-600">{p.reward_value}% reward</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold">Referral Code</th>
                  <th className="p-3 font-semibold">Buyer Email</th>
                  <th className="p-3 font-semibold">Order Total</th>
                  <th className="p-3 font-semibold">Commission</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.referralConversions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No referral conversions recorded yet.
                    </td>
                  </tr>
                ) : (
                  data.referralConversions.map((rc) => (
                    <tr key={rc.id}>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">
                        {new Date(rc.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td className="p-3 font-mono font-bold text-primary">{rc.referral_code}</td>
                      <td className="p-3 font-mono">{rc.buyer_email}</td>
                      <td className="p-3 font-mono">₹{rc.order_amount.toLocaleString("en-IN")}</td>
                      <td className="p-3 font-mono font-bold text-emerald-600">₹{rc.reward_amount.toLocaleString("en-IN")}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-700">
                          {rc.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* 7. COMPLETION TEMPLATES SUB-TAB */}
      {subTab === "templates" ? (
        <div className="space-y-6 max-w-4xl">
          {/* Upload / Replace Template Form */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Upload or Replace Completion Page HTML</h3>
              <p className="text-xs text-muted-foreground">
                Paste raw HTML and CSS. The server will safely replace tokens (e.g. <code>&#123;&#123;first_name&#125;&#125;</code>, <code>&#123;&#123;amount_paid&#125;&#125;</code>) before delivering the page.
                A new version is created automatically and previous versions can be restored anytime with 1 click.
              </p>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Target Completion Page</Label>
                  <select
                    value={templateSlug}
                    onChange={(e) => setTemplateSlug(e.target.value as any)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  >
                    <option value="money-reality-check">/complete/money-reality-check</option>
                    <option value="silver">/complete/silver</option>
                    <option value="silver-upgrade">/complete/silver-upgrade</option>
                    <option value="gold">/complete/gold</option>
                    <option value="diamond">/complete/diamond</option>
                    <option value="course-complete">/course/complete</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Version Notes (Optional)</Label>
                  <Input
                    value={templateNotes}
                    onChange={(e) => setTemplateNotes(e.target.value)}
                    placeholder="e.g. Added celebration confetti banner"
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground">Complete HTML & CSS Content</Label>
                <Textarea
                  value={templateHtml}
                  onChange={(e) => setTemplateHtml(e.target.value)}
                  placeholder="<!DOCTYPE html><html><head>...</head><body><h1>Welcome {{first_name}}</h1>...</body></html>"
                  rows={8}
                  className="mt-1 font-mono text-xs"
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Supported tokens: <code>&#123;&#123;first_name&#125;&#125;</code>, <code>&#123;&#123;product_name&#125;&#125;</code>, <code>&#123;&#123;amount_paid&#125;&#125;</code>, <code>&#123;&#123;invoice_url&#125;&#125;</code>, <code>&#123;&#123;member_area_url&#125;&#125;</code>, <code>&#123;&#123;#if bonus&#125;&#125;...&#123;&#123;/if&#125;&#125;</code>
                </span>
                <Button type="submit" size="sm" disabled={loading || !templateHtml.trim()} className="text-xs">
                  Save & Activate Version
                </Button>
              </div>
            </form>
          </div>

          {/* Version History & Rollback Table */}
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <div className="p-3 border-b border-border bg-muted/30">
              <h4 className="text-xs font-bold text-foreground">Template Versions & Rollback</h4>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-3 font-semibold">Slug</th>
                  <th className="p-3 font-semibold">Version</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Notes</th>
                  <th className="p-3 font-semibold">Created</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(!data.completionTemplates || data.completionTemplates.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No custom templates uploaded yet. Clean built-in fallback layouts are serving all completion slugs.
                    </td>
                  </tr>
                ) : (
                  data.completionTemplates.map((tpl) => (
                    <tr key={tpl.id} className={tpl.is_active ? "bg-primary/5" : ""}>
                      <td className="p-3 font-mono font-bold text-primary">/complete/{tpl.slug}</td>
                      <td className="p-3 font-mono">v{tpl.version}</td>
                      <td className="p-3">
                        {tpl.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted text-muted-foreground">
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{tpl.notes || "-"}</td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">
                        {new Date(tpl.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3 text-right">
                        {!tpl.is_active ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRollbackTemplate(tpl.slug, tpl.version)}
                            disabled={loading}
                            className="text-[11px] h-7"
                          >
                            Rollback to v{tpl.version}
                          </Button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-medium">Serving live</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* 8. RECONCILIATION SUB-TAB */}
      {subTab === "reconciliation" ? (
        <div className="space-y-4 max-w-4xl">
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
            <div>
              <h3 className="text-sm font-bold text-foreground">Razorpay Automated Reconciliation</h3>
              <p className="text-xs text-muted-foreground">
                Compares recent captured Razorpay payments against database access grants and flags mismatches.
              </p>
            </div>
            <Button size="sm" onClick={handleRunReconciliation} disabled={loading} className="text-xs">
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Run Reconciliation Now
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-3 font-semibold">Flagged Date</th>
                  <th className="p-3 font-semibold">Payment / Order ID</th>
                  <th className="p-3 font-semibold">Email</th>
                  <th className="p-3 font-semibold">Amount</th>
                  <th className="p-3 font-semibold">Issue Detected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.reconciliationFlags.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-emerald-600 font-medium">
                      ✓ Zero reconciliation flags. All captured payments match granted access.
                    </td>
                  </tr>
                ) : (
                  data.reconciliationFlags.map((rf) => (
                    <tr key={rf.id}>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">
                        {new Date(rf.flagged_at).toLocaleDateString("en-IN")}
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        <div>{rf.razorpay_payment_id || "-"}</div>
                        <div className="text-muted-foreground">{rf.razorpay_order_id || "-"}</div>
                      </td>
                      <td className="p-3 font-mono">{rf.email || "-"}</td>
                      <td className="p-3 font-mono font-bold">₹{rf.amount || 0}</td>
                      <td className="p-3 text-destructive font-medium">{rf.issue_type}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
