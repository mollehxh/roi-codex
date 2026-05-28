/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRELOAD_DATASET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
