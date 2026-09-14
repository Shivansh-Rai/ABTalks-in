"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useCookieConsent, type CookieChoice } from "@/components/legal/cookie-consent-provider";

function CookiePreferencesContent() {
  const { closePreferences, choice, decide } = useCookieConsent();

  // Initialize directly from the current stored choice without useEffect
  const [analytics, setAnalytics] = useState(() => choice === "all" || choice === "limited");
  const [attribution, setAttribution] = useState(() => choice === "all");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      let nextChoice: CookieChoice = "essential";
      if (analytics && attribution) {
        nextChoice = "all";
      } else if (analytics || attribution) {
        nextChoice = "limited";
      }
      await decide(nextChoice);
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptAll() {
    setSaving(true);
    try {
      setAnalytics(true);
      setAttribution(true);
      await decide("all");
    } finally {
      setSaving(false);
    }
  }

  async function handleNecessaryOnly() {
    setSaving(true);
    try {
      setAnalytics(false);
      setAttribution(false);
      await decide("essential");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-xl sm:max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-4 sm:p-5 gap-3">
      <DialogHeader className="gap-1">
        <DialogTitle className="text-lg font-bold">
          Cookie Preferences
        </DialogTitle>
        <DialogDescription className="text-xs leading-normal">
          Manage your cookie choices on ABTalks. Strictly necessary cookies cannot be disabled. Learn more in our{" "}
          <Link
            href="/cookies"
            className="text-primary underline hover:text-primary/80"
            onClick={closePreferences}
          >
            Cookie Policy
          </Link>
          .
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2.5 py-1 text-sm">
        {/* 1. Strictly Necessary */}
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold text-foreground">
                Strictly Necessary Cookies
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Required for sign-in session, security, and consent choice
              </p>
            </div>
            <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
              Always Active
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Essential to authenticate your account, maintain login sessions, and protect against CSRF attacks.
          </p>
        </div>

        {/* 2. Analytics */}
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold text-foreground">
                Analytics &amp; Performance
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Google Analytics 4 (Consent Mode v2)
              </p>
            </div>
            <Switch
              id="toggle-analytics"
              checked={analytics}
              onCheckedChange={setAnalytics}
              aria-label="Toggle analytics cookies"
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Measures aggregate page views and platform usage on production only. All IPs are anonymized and no personal data is collected.
          </p>
        </div>

        {/* 3. Attribution & Enhancements */}
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold text-foreground">
                Referral Attribution &amp; Media
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Referral link credit and YouTube video thumbnails
              </p>
            </div>
            <Switch
              id="toggle-attribution"
              checked={attribution}
              onCheckedChange={setAttribution}
              aria-label="Toggle attribution and media cookies"
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Remembers referral invite links so members receive credit, and allows tutorial video thumbnails to display before playing.
          </p>
        </div>
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:items-center pt-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={handleNecessaryOnly}
            className="text-xs h-8 px-2.5"
          >
            Necessary only
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={handleAcceptAll}
            className="text-xs h-8 px-2.5"
          >
            Accept all
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={handleSave}
          className="text-xs font-semibold h-8 px-3"
        >
          {saving ? "Saving..." : "Save preferences"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function CookiePreferencesModal() {
  const { isPreferencesOpen, closePreferences } = useCookieConsent();

  return (
    <Dialog
      open={isPreferencesOpen}
      onOpenChange={(open) => {
        if (!open) closePreferences();
      }}
    >
      {isPreferencesOpen && <CookiePreferencesContent />}
    </Dialog>
  );
}
