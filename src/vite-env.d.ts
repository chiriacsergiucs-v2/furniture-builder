/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** The backend's project URL (ADR-126, ADR-127). Absent = no online features in this build. */
  readonly VITE_SUPABASE_URL?: string;
}
