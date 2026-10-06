import Constants from "expo-constants";

export interface AppConfig {
  readonly apiBaseUrl: string;
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly privacyPolicyUrl: string;
  readonly accountDeletionUrl: string;
  readonly reportUrl: string;
}

type Extra = Partial<Record<keyof AppConfig, unknown>>;

function pick(envValue: string | undefined, extraValue: unknown): string {
  const value = envValue || (typeof extraValue === "string" ? extraValue : "");
  return value.trim();
}

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function readConfig(): AppConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  return {
    apiBaseUrl: trimTrailingSlash(
      pick(process.env.EXPO_PUBLIC_API_BASE_URL, extra.apiBaseUrl),
    ),
    supabaseUrl: pick(process.env.EXPO_PUBLIC_SUPABASE_URL, extra.supabaseUrl),
    supabaseAnonKey: pick(
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      extra.supabaseAnonKey,
    ),
    privacyPolicyUrl: pick(
      process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
      extra.privacyPolicyUrl,
    ),
    accountDeletionUrl: pick(
      process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
      extra.accountDeletionUrl,
    ),
    reportUrl: pick(process.env.EXPO_PUBLIC_REPORT_URL, extra.reportUrl),
  };
}

export const appConfig: AppConfig = readConfig();

export function termsUrl(config: AppConfig = appConfig): string {
  return config.apiBaseUrl ? `${config.apiBaseUrl}/terms` : "";
}
