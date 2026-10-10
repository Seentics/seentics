/** Domain types for the api-keys feature. */

export interface ApiParam {
  name: string;
  description: string;
  default?: string;
}

export interface ApiEndpoint {
  path: string;
  method: 'GET';
  group: string;
  summary: string;
  scope: string;
  params: ApiParam[];
  /** A real response, trimmed (core: `api-examples.ts`). */
  example: unknown;
}

export interface ApiCatalogue {
  meta: { base_path: string; auth: string; count: number };
  data: ApiEndpoint[];
}
