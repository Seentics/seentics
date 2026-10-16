import type { ZodType } from "zod";
import type { Outcome, ProviderContext } from "../../interfaces";
import type { ConversionPayload, ConversionPlatform, DestinationConfig } from "../../interfaces/conversions";

/** One ad platform: how its credentials look, how to check them, and how to send one event. */
export type ConversionProvider<C = Record<string, string>> = {
  platform: ConversionPlatform;
  credentialSchema: ZodType<C>;
  /** What makes two destinations the same one: the pixel id, the measurement id. */
  accountRef(credentials: C): string;
  /** Checked when connected and when credentials change. `hint` is what the dashboard shows instead of the secret. */
  verify(credentials: C, ctx: ProviderContext): Promise<{ ok: true; hint: string } | { ok: false; message: string }>;
  send(payload: ConversionPayload, credentials: C, config: DestinationConfig, ctx: ProviderContext, testEventCode?: string | null): Promise<Outcome>;
  test(credentials: C, config: DestinationConfig, testEventCode: string | null, ctx: ProviderContext): Promise<{ ok: boolean; message: string }>;
};
