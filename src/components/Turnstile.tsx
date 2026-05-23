import React, { useEffect, useRef } from "react";

declare global {
  interface ImportMeta {
    readonly env: Record<string, string | undefined>;
  }
  interface Window {
    onloadTurnstileCallback?: () => void;
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileProps {
  onVerify: (token: string | null) => void;
  theme?: "light" | "dark" | "auto";
}

// Cloudflare's official always-passes testing sitekey:
const DEFAULT_SITE_KEY = "1x00000000000000000000AA";

export const Turnstile: React.FC<TurnstileProps> = ({ onVerify, theme = "dark" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    // Load Turnstile global script if not present
    const scriptId = "cloudflare-turnstile-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initializeTurnstile = () => {
      if (!active || !containerRef.current || !window.turnstile) return;

      // Avoid double rendering
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {}
        widgetIdRef.current = null;
      }

      const siteKey = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || DEFAULT_SITE_KEY;

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: theme,
          callback: (token) => {
            if (active) onVerify(token);
          },
          "expired-callback": () => {
            if (active) onVerify(null);
          },
          "error-callback": () => {
            if (active) onVerify(null);
          },
        });
        widgetIdRef.current = id;
      } catch (err) {
        console.error("Turnstile render error:", err);
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initializeTurnstile();
      };
      document.head.appendChild(script);
    } else {
      if (window.turnstile) {
        initializeTurnstile();
      } else {
        script.addEventListener("load", initializeTurnstile);
      }
    }

    return () => {
      active = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {}
      }
      if (script) {
        script.removeEventListener("load", initializeTurnstile);
      }
    };
  }, [onVerify, theme]);

  return (
    <div className="flex justify-center my-3.5 origin-center scale-95 transition-transform duration-200">
      <div ref={containerRef} className="min-h-[65px] flex items-center justify-center bg-[#080c14]/40 rounded-xl" />
    </div>
  );
};
