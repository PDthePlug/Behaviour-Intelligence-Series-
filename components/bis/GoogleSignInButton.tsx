"use client";

import { useEffect, useRef, useState } from "react";
import { readApiResponse } from "@/lib/api-response";
import { LearnerProfile } from "./types";

type GoogleCredentialResponse = { credential?: string };
type GoogleIdentity = {
  initialize(options: { client_id: string; nonce: string; callback: (response: GoogleCredentialResponse) => void; ux_mode: "popup"; auto_select: boolean; cancel_on_tap_outside: boolean }): void;
  renderButton(target: HTMLElement, options: { type: "standard"; theme: "outline"; size: "large"; text: "continue_with"; shape: "rectangular"; logo_alignment: "left"; width: number }): void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentity() {
  if (window.google?.accounts.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-bis-google-identity]");
    const script = existing ?? document.createElement("script");
    const loaded = () => window.google?.accounts.id ? resolve() : reject(new Error("Google sign-in did not initialise."));
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", () => reject(new Error("Google sign-in could not be loaded.")), { once: true });
    if (!existing) {
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.bisGoogleIdentity = "true";
      document.head.appendChild(script);
    }
  });
  return googleScriptPromise;
}

export function GoogleSignInButton({ selectedPattern, profileStyle, country, onAuthenticated, onError }: { selectedPattern: string; profileStyle: string; country: string; onAuthenticated: (profile: LearnerProfile) => void; onError: (message: string) => void }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ selectedPattern, profileStyle, country, onAuthenticated, onError });
  const [enabled, setEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    propsRef.current = { selectedPattern, profileStyle, country, onAuthenticated, onError };
  }, [selectedPattern, profileStyle, country, onAuthenticated, onError]);

  useEffect(() => {
    let active = true;
    const buttonNode = buttonRef.current;
    async function initialise() {
      try {
        const configResponse = await fetch("/api/auth/google", { credentials: "include", cache: "no-store" });
        const config = await readApiResponse<{ enabled: boolean; clientId?: string; nonce?: string; error?: string }>(configResponse, "Google sign-in is unavailable right now.");
        if (!active || !config.enabled || !config.clientId || !config.nonce) return;
        await loadGoogleIdentity();
        if (!active || !buttonNode || !window.google?.accounts.id) return;
        setEnabled(true);
        window.google.accounts.id.initialize({
          client_id: config.clientId,
          nonce: config.nonce,
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: async ({ credential }) => {
            if (!credential) return propsRef.current.onError("Google did not return an identity credential.");
            setSubmitting(true);
            propsRef.current.onError("");
            try {
              const current = propsRef.current;
              const authResponse = await fetch("/api/auth/google", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential, selectedPattern: current.selectedPattern, profileStyle: current.profileStyle, country: current.country }),
              });
              const data = await readApiResponse<{ profile?: LearnerProfile; error?: string }>(authResponse, "Google sign-in could not be completed. Please try again.");
              if (!data.profile) throw new Error("Google did not return a learner profile.");
              current.onAuthenticated(data.profile);
            } catch (error) {
              propsRef.current.onError(error instanceof Error ? error.message : "Google sign-in could not be completed.");
            } finally {
              setSubmitting(false);
            }
          },
        });
        buttonNode.replaceChildren();
        window.google.accounts.id.renderButton(buttonNode, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.min(400, Math.max(250, buttonNode.clientWidth || 360)),
        });
      } catch (error) {
        if (active) propsRef.current.onError(error instanceof Error ? error.message : "Google sign-in is unavailable right now.");
      }
    }
    void initialise();
    return () => {
      active = false;
      buttonNode?.replaceChildren();
    };
  }, []);

  return (
    <div className={`google-auth-option ${enabled ? "ready" : ""}`} aria-live="polite">
      <div ref={buttonRef} className="google-auth-button" />
      {submitting && <span>Opening your private BIS space…</span>}
      <div className="google-auth-divider"><span>or use your email</span></div>
    </div>
  );
}
