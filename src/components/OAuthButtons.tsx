import { providerConfigured } from "@/lib/oauth";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.95.93-1.95 1.87V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12Z" />
    </svg>
  );
}

export function OAuthButtons() {
  const google = providerConfigured("google");
  const facebook = providerConfigured("facebook");
  if (!google && !facebook) return null;

  return (
    <div className="space-y-3">
      {google && (
        <a href="/api/auth/google" className="btn w-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
          <GoogleIcon /> Continuă cu Google
        </a>
      )}
      {facebook && (
        <a href="/api/auth/facebook" className="btn w-full bg-[#1877F2] text-white hover:bg-[#0f6ae0]">
          <FacebookIcon /> Continuă cu Facebook
        </a>
      )}
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span className="text-xs text-slate-400">sau</span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

const ERRORS: Record<string, string> = {
  oauth_unavailable: "Autentificarea cu acest serviciu nu este configurată.",
  oauth_failed: "Autentificarea a eșuat. Încearcă din nou.",
  oauth_no_email: "Contul nu a furnizat un email. Folosește email și parolă.",
};

export function OAuthError({ error }: { error?: string }) {
  if (!error || !ERRORS[error]) return null;
  return (
    <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300" role="alert">
      {ERRORS[error]}
    </p>
  );
}
