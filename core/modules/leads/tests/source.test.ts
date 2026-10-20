import { describe, expect, it } from "bun:test";
import { sourceOf } from "../lib/source";

describe("sourceOf", () => {
  it("names the big sites however they are spelt", () => {
    expect(sourceOf("https://shop.example/?utm_source=fb&utm_campaign=eid", "")).toBe("facebook");
    expect(sourceOf("https://shop.example/", "https://l.facebook.com/l.php?u=x")).toBe("facebook");
    expect(sourceOf("https://shop.example/", "https://www.google.com.bd/")).toBe("google");
    expect(sourceOf("https://shop.example/?utm_source=IG", "")).toBe("instagram");
    expect(sourceOf("https://shop.example/", "https://t.co/abc")).toBe("x");
    expect(sourceOf("https://shop.example/", "https://youtu.be/abc")).toBe("youtube");
  });

  it("prefers the UTM source over the referrer, and keeps any other host as it is", () => {
    expect(sourceOf("https://shop.example/?utm_source=newsletter", "https://www.google.com/")).toBe("newsletter");
    expect(sourceOf("https://shop.example/", "https://www.daraz.com.bd/item")).toBe("daraz.com.bd");
  });

  it("is null for a visit with neither", () => {
    expect(sourceOf("https://shop.example/", "")).toBeNull();
  });
});
