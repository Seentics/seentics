import { describe, expect, it } from "bun:test";
import { absolutizeCssUrls, looksLikeCss } from "../services/stylesheets/css-rewrite";

const BASE = "https://shop.test/_next/static/css/app.css";

describe("absolutizeCssUrls", () => {
  it("rewrites relative url() targets, quoted and unquoted, against the stylesheet URL", () => {
    const css = `@font-face{src:url(../media/font.woff2) format("woff2"),url('./a b.woff')}.x{background:url( "/img/bg.png" )}`;
    expect(absolutizeCssUrls(css, BASE)).toBe(
      `@font-face{src:url("https://shop.test/_next/static/media/font.woff2") format("woff2"),url("https://shop.test/_next/static/css/a%20b.woff")}.x{background:url("https://shop.test/img/bg.png")}`,
    );
  });

  it("rewrites @import in both its string and url() forms", () => {
    const css = `@import "theme.css";@import url(print.css) print;@IMPORT 'https://cdn.test/x.css';`;
    expect(absolutizeCssUrls(css, BASE)).toBe(
      `@import "https://shop.test/_next/static/css/theme.css";@import url("https://shop.test/_next/static/css/print.css") print;@IMPORT 'https://cdn.test/x.css';`,
    );
  });

  it("leaves data:, absolute, protocol-less absolute and fragment references alone — except resolving //host", () => {
    const css = `a{b:url(data:image/png;base64,AAA=)}c{d:url("https://cdn.test/i.png")}e{f:url(#grad)}g{h:url(//cdn.test/j.png)}`;
    expect(absolutizeCssUrls(css, BASE)).toBe(
      `a{b:url(data:image/png;base64,AAA=)}c{d:url("https://cdn.test/i.png")}e{f:url(#grad)}g{h:url("https://cdn.test/j.png")}`,
    );
  });

  it("does not touch url( inside comments or ordinary strings", () => {
    const css = `/* url(x.png) */ .a{content:"url(y.png)"} .b{background:url(z.png)}`;
    expect(absolutizeCssUrls(css, BASE)).toBe(
      `/* url(x.png) */ .a{content:"url(y.png)"} .b{background:url("https://shop.test/_next/static/css/z.png")}`,
    );
  });

  it("handles escapes and a ) inside a quoted url", () => {
    const css = `.a{background:url("a)b.png")} .b{background:url(c\\(d.png)} .c{background:url("q\\"r.png")}`;
    expect(absolutizeCssUrls(css, BASE)).toBe(
      `.a{background:url("https://shop.test/_next/static/css/a)b.png")} .b{background:url("https://shop.test/_next/static/css/c(d.png")} .c{background:url("https://shop.test/_next/static/css/q%22r.png")}`,
    );
  });

  it("does not mistake a longer identifier for url(", () => {
    const css = `.a{mask:myurl(x.png);background:image-url(y.png)}`;
    expect(absolutizeCssUrls(css, BASE)).toBe(css);
  });

  it("returns the input unchanged for an unusable base", () => {
    expect(absolutizeCssUrls(".a{b:url(c.png)}", "not a url")).toBe(".a{b:url(c.png)}");
  });
});

describe("looksLikeCss", () => {
  it("accepts rule blocks and refuses markup", () => {
    expect(looksLikeCss("body{margin:0}")).toBe(true);
    expect(looksLikeCss("﻿@charset \"utf-8\";")).toBe(true);
    expect(looksLikeCss("<!DOCTYPE html><html><body>Not found</body></html>")).toBe(false);
    expect(looksLikeCss("  <html>{}</html>")).toBe(false);
    expect(looksLikeCss("just some text")).toBe(false);
  });
});
