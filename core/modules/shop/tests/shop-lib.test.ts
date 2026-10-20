import { describe, expect, it } from "bun:test";
import type { Page, Store } from "../interfaces";
import { escapeHtml, safeUrl, scriptJson } from "../lib/html";
import { sniffImage } from "../lib/images";
import { e164Digits, normalizeBdPhone } from "../lib/phone";
import { priceOrder, taka } from "../lib/pricing";
import { renderNotFound, renderProductPage, renderStorePage } from "../lib/render";
import { scoreOrder, type RiskFacts } from "../lib/risk";
import { isValidSlug } from "../lib/slug";
import { parseFraudCheck } from "../lib/steadfast";
import { canMove, purchaseDue } from "../services/order.service";
import { pageSchema } from "../validators/shop.schema";

const store: Store = {
  websiteId: "11111111-1111-1111-1111-111111111111", slug: "rupa-fashion", name: "Rupa <Fashion>", url: "https://seentics.shop/rupa-fashion",
  phone: "01711000000", whatsapp: "01711000000", facebookUrl: "javascript:alert(1)", logoUrl: null, deliveryInsideDhaka: 60, deliveryOutsideDhaka: 120,
  purchaseEventOn: "confirmed", autoBlockHighRisk: false, steadfastConnected: false, createdAt: new Date().toISOString(),
};
const page: Page = {
  id: "22222222-2222-2222-2222-222222222222", slug: "saree", url: "https://seentics.shop/rupa-fashion/saree", status: "published",
  template: "offer", accent: "#e11d48", title: `জামদানি শাড়ি <script>alert("x")</script>`, productName: "Jamdani \"Saree\"",
  price: 1450, comparePrice: 2000, images: ["https://cdn.example/a.jpg", "javascript:alert(1)", "/i/abc.jpg"], description: "লাইন ১\n<b>লাইন ২</b>",
  highlights: ["<img src=x onerror=alert(1)>"], faq: [{ q: "q</summary>", a: "a" }], options: { label: "সাইজ", values: ["M", "<L>"] },
  maxQuantity: 5, freeDelivery: false, thankYouMessage: null, createdAt: "", updatedAt: "", publishedAt: null,
};

describe("phone", () => {
  it("normalises the ways buyers type a number", () => {
    for (const raw of ["01711000000", "+880 1711-000000", "8801711000000", "880-17110 00000", "০১৭১১০০০০০০"]) expect(normalizeBdPhone(raw)).toBe("01711000000");
    for (const raw of ["0171100000", "01211000000", "1711000000x", "", "+1 415 555 0100"]) expect(normalizeBdPhone(raw)).toBeNull();
    expect(e164Digits("01711000000")).toBe("8801711000000");
  });
});

describe("pricing", () => {
  it("works the total out on the server, capping quantity", () => {
    expect(priceOrder({ price: 1450, freeDelivery: false, maxQuantity: 5 }, store, 2, "outside_dhaka")).toEqual({ quantity: 2, unitPrice: 1450, deliveryCharge: 120, total: 3020 });
    expect(priceOrder({ price: 1450, freeDelivery: false, maxQuantity: 5 }, store, 99, "inside_dhaka").quantity).toBe(5);
    expect(priceOrder({ price: 100, freeDelivery: true, maxQuantity: 5 }, store, 1, "outside_dhaka").total).toBe(100);
    expect(taka(100000)).toBe("৳1,00,000");
  });
});

describe("render", () => {
  const ctx = { trackerScriptUrl: "https://seentics.com/trackers/seentics.min.js" };
  it("escapes every seller value and drops non-https URLs", () => {
    const html = renderProductPage(store, page, ctx);
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toContain("<img src=x onerror");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("q</summary>");
    expect(html).toContain("Rupa &lt;Fashion&gt;");
    expect(html).toContain("লাইন ১<br>&lt;b&gt;");
    expect(html).toContain('data-website-id="11111111-1111-1111-1111-111111111111"');
    expect(html).toContain("৳1,450");
    expect(html).toContain("28% ছাড়");
    expect(html).toContain('lang="bn"');
    expect(html).toContain("&lt;L&gt;");
  });
  it("keeps the inline script's data from closing the script", () => {
    expect(scriptJson({ a: "</script><script>alert(1)</script>" })).not.toContain("</script>");
    const html = renderProductPage({ ...store, phone: "</script>" }, page, ctx);
    expect(html.match(/<\/script>/g)!.length).toBe(2);
  });
  it("store list and not-found render", () => {
    expect(renderStorePage(store, [page], ctx)).toContain('href="/rupa-fashion/saree"');
    expect(renderNotFound()).toContain("পেজটি পাওয়া যায়নি");
  });
  it("escape helpers", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&`)).toBe("&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;");
    expect(safeUrl("http://x.com")).toBeNull();
    expect(safeUrl("/i/abc.jpg")).toBe("/i/abc.jpg");
  });
});

describe("slugs and images", () => {
  it("allows short lowercase slugs, refuses reserved ones", () => {
    expect(isValidSlug("rupa-fashion")).toBe(true);
    for (const s of ["ab", "Rupa", "-x-", "a--b", "api", "admin", "x".repeat(41)]) expect(isValidSlug(s)).toBe(false);
  });
  it("knows an image by its bytes", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe("png");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))?.ext).toBe("webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("risk", () => {
  const base: RiskFacts = {
    phone: "01711234567", address: "House 12, Road 5, Dhanmondi, Dhaka", blacklisted: false,
    history: { delivered: 0, returned: 0, fake: 0, cancelled: 0 }, recentSamePhone: 0, recentSameAddress: 0, recentSameDevice: 1, courier: null,
  };
  it("a new buyer with a full address is safe", () => {
    const r = scoreOrder(base);
    expect(r.level).toBe("safe");
    expect(r.reasons.map((x) => x.code)).toEqual(["new_customer"]);
  });
  it("blacklisted is high whatever else", () => {
    const r = scoreOrder({ ...base, blacklisted: true, history: { ...base.history, delivered: 5 } });
    expect(r).toMatchObject({ level: "high", score: 100 });
  });
  it("past fakes and a duplicate push to high; deliveries pull down", () => {
    expect(scoreOrder({ ...base, history: { ...base.history, fake: 1 }, recentSamePhone: 1 }).level).toBe("high");
    expect(scoreOrder({ ...base, recentSamePhone: 1 }).level).toBe("check");
    expect(scoreOrder({ ...base, recentSamePhone: 1, history: { ...base.history, delivered: 2 } }).level).toBe("safe");
  });
  it("short address, implausible number and device bursts are flagged", () => {
    const r = scoreOrder({ ...base, phone: "01711111111", address: "Dhaka", recentSameDevice: 4 });
    expect(r.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(["invalid_phone", "short_address", "burst_device"]));
    expect(r.level).toBe("high");
  });
  it("courier record moves the score both ways", () => {
    const bad = { total: 10, delivered: 3, cancelled: 7, successRate: 30, checkedAt: "" };
    const good = { total: 20, delivered: 19, cancelled: 1, successRate: 95, checkedAt: "" };
    expect(scoreOrder({ ...base, courier: bad }).level).toBe("check");
    expect(scoreOrder({ ...base, recentSamePhone: 1, courier: good }).level).toBe("safe");
  });
});

describe("steadfast response", () => {
  it("reads the spellings seen in the wild", () => {
    expect(parseFraudCheck({ total_parcels: 10, total_delivered: 8, total_cancelled: 2 })).toMatchObject({ total: 10, delivered: 8, cancelled: 2, successRate: 80 });
    expect(parseFraudCheck({ data: { success: "4", cancel: "1" } })).toMatchObject({ total: 5, delivered: 4, successRate: 80 });
    expect(parseFraudCheck({ message: "unauthorized" })).toBeNull();
  });
});

describe("purchase trigger", () => {
  const ctx = { atSubmit: false, risk: "safe" as const, holdHighRisk: false };
  it("confirmed: on confirm or beyond, never on dead statuses", () => {
    expect(purchaseDue("confirmed", "new", ctx)).toBe(false);
    expect(purchaseDue("confirmed", "confirmed", ctx)).toBe(true);
    expect(purchaseDue("confirmed", "shipped", ctx)).toBe(true);
    expect(purchaseDue("confirmed", "fake", ctx)).toBe(false);
  });
  it("delivered: only on delivery", () => {
    expect(purchaseDue("delivered", "shipped", ctx)).toBe(false);
    expect(purchaseDue("delivered", "delivered", ctx)).toBe(true);
  });
  it("placed: at submit, unless high risk is held back until confirmed", () => {
    expect(purchaseDue("placed", "new", { ...ctx, atSubmit: true })).toBe(true);
    expect(purchaseDue("placed", "new", { atSubmit: true, risk: "high", holdHighRisk: true })).toBe(false);
    expect(purchaseDue("placed", "confirmed", { atSubmit: false, risk: "high", holdHighRisk: true })).toBe(true);
  });
});

describe("status transitions", () => {
  it("moves forward, closes, and reopens only to new", () => {
    expect(canMove("new", "confirmed")).toBe(true);
    expect(canMove("new", "shipped")).toBe(false);
    expect(canMove("confirmed", "delivered")).toBe(true);
    expect(canMove("shipped", "cancelled")).toBe(false);
    expect(canMove("delivered", "returned")).toBe(true);
    expect(canMove("fake", "new")).toBe(true);
    expect(canMove("fake", "confirmed")).toBe(false);
  });
});

describe("page image URLs", () => {
  const withImage = (url: string) => pageSchema.partial().safeParse({ images: [url] }).success;
  it("takes https, the shop's own /i/ path, and http only on a development host", () => {
    expect(withImage("https://seentics.shop/i/0123456789abcdef0123456789abcdef.png")).toBe(true);
    expect(withImage("/i/0123456789abcdef0123456789abcdef.png")).toBe(true);
    expect(withImage("http://shop.localhost:8000/i/0123456789abcdef0123456789abcdef.png")).toBe(true);
    expect(withImage("http://evil.example/x.png")).toBe(false);
    expect(withImage("javascript:alert(1)")).toBe(false);
  });
});
