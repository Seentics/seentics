import type { ConversionPlatform } from "../../interfaces/conversions";
import { ga4Provider } from "./ga4";
import { metaProvider } from "./meta";
import type { ConversionProvider } from "./types";

const PROVIDERS: Record<ConversionPlatform, ConversionProvider<any>> = { meta: metaProvider, ga4: ga4Provider };

export function getConversionProvider(platform: string): ConversionProvider<any> | null {
  return (PROVIDERS as Record<string, ConversionProvider<any>>)[platform] ?? null;
}
