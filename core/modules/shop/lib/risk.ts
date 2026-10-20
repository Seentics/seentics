import type { CourierRecord, Risk, RiskLevel, RiskReason } from "../interfaces";

/**
 * How risky a cash-on-delivery order looks, from what the seller already knows: their own
 * blacklist and history with this number, the orders just before it, the courier's record for
 * the number, and the order itself. Pure: the service gathers the facts.
 *
 * Every reason carries the seller-facing text, in Bangla, so the label is never a mystery.
 * Scores add up and are clamped to 0–100: high ≥ 60, check 30–59, safe below. A blacklisted
 * number is high whatever else is true.
 */

export type RiskFacts = {
  phone: string;
  address: string;
  blacklisted: boolean;
  /** This seller's earlier orders from this phone, by final status. */
  history: { delivered: number; returned: number; fake: number; cancelled: number };
  /** Other orders from this phone in the last 24 hours (not this one). */
  recentSamePhone: number;
  /** Other orders to the same address (normalised) in the last 24 hours, from other phones. */
  recentSameAddress: number;
  /** Orders from this visitor or IP in the last hour, this one included. */
  recentSameDevice: number;
  courier: CourierRecord | null;
};

const W = {
  blacklisted: 100,
  past_fake: 45,
  past_returned: 25,
  duplicate_phone: 30,
  duplicate_address: 20,
  burst_device: 30,
  invalid_phone: 20,
  short_address: 15,
  courier_low_success: 35,
  courier_good: -25,
  past_delivered: -30,
  new_customer: 5,
} as const;

export const levelFor = (score: number): RiskLevel => (score >= 60 ? "high" : score >= 30 ? "check" : "safe");

/** A number no person has: one digit repeated, or a straight run, after the operator prefix. */
function implausiblePhone(phone: string): boolean {
  const rest = phone.slice(3);
  return /^(\d)\1+$/.test(rest) || "0123456789".includes(rest) || "9876543210".includes(rest);
}

/** Too little to find a door by: under 15 characters or fewer than three words. */
function shortAddress(address: string): boolean {
  const a = address.trim();
  return a.length < 15 || a.split(/[\s,]+/).filter(Boolean).length < 3;
}

export function scoreOrder(f: RiskFacts, now: Date = new Date()): Risk {
  const reasons: RiskReason[] = [];
  let score = 0;
  const add = (code: keyof typeof W, text: string) => {
    reasons.push({ code, text });
    score += W[code];
  };

  if (f.blacklisted) add("blacklisted", "এই নম্বরটি আপনার ব্ল্যাকলিস্টে আছে");
  if (f.history.fake > 0) add("past_fake", `এই নম্বর থেকে আগে ${f.history.fake}টি ভুয়া অর্ডার এসেছে`);
  if (f.history.returned > 0) add("past_returned", `এই ক্রেতা আগে ${f.history.returned}টি অর্ডার ফেরত দিয়েছেন`);
  if (f.recentSamePhone > 0) add("duplicate_phone", `একই নম্বর থেকে গত ২৪ ঘণ্টায় আরও ${f.recentSamePhone}টি অর্ডার`);
  if (f.recentSameAddress > 0) add("duplicate_address", "একই ঠিকানায় অন্য নম্বর থেকে সাম্প্রতিক অর্ডার আছে");
  if (f.recentSameDevice >= 3) add("burst_device", `একই ডিভাইস থেকে ১ ঘণ্টায় ${f.recentSameDevice}টি অর্ডার`);
  if (implausiblePhone(f.phone)) add("invalid_phone", "নম্বরটি সন্দেহজনক দেখাচ্ছে");
  if (shortAddress(f.address)) add("short_address", "ঠিকানা অসম্পূর্ণ মনে হচ্ছে");

  const c = f.courier;
  if (c && c.total >= 3 && c.successRate !== null) {
    if (c.successRate < 60) add("courier_low_success", `কুরিয়ারে ${c.total}টি পার্সেলের মধ্যে মাত্র ${c.delivered}টি ডেলিভারি হয়েছে (${Math.round(c.successRate)}%)`);
    else if (c.successRate >= 85) add("courier_good", `কুরিয়ারে ${c.total}টির মধ্যে ${c.delivered}টি ডেলিভারি হয়েছে (${Math.round(c.successRate)}%)`);
  }
  if (f.history.delivered > 0) add("past_delivered", `আগে ${f.history.delivered}টি অর্ডার সফলভাবে ডেলিভারি হয়েছে`);

  const known = f.history.delivered + f.history.returned + f.history.fake + f.history.cancelled > 0 || (c !== null && c.total > 0);
  if (!known) add("new_customer", "নতুন ক্রেতা, আগের কোনো রেকর্ড নেই");

  const clamped = Math.max(0, Math.min(100, score));
  const level = f.blacklisted ? "high" : levelFor(clamped);
  return { level, score: f.blacklisted ? 100 : clamped, reasons, checkedAt: now.toISOString() };
}

/** Lowercased, punctuation and runs of space folded: "House 12, Road-5" and "house 12 road 5" match. */
export const normalizeAddress = (a: string): string => a.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim().slice(0, 300);
