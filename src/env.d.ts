/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_PA_API_URL?: string;
  readonly PUBLIC_FEDERAL_API_URL?: string;
  readonly PUBLIC_FEDERAL_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
