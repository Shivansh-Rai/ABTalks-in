"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import "@/components/profile/profile-wizard.css";
import "./account-settings.css";
import { AvatarEditor } from "@/components/profile/avatar-editor";
import { DeleteOwnAccountDialog } from "@/components/profile/delete-own-account-dialog";
import { PasswordSettingsForm } from "@/components/settings/password-settings-form";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form";
import type { EmailNotificationPreference } from "@/features/notification/email-preferences";

type SectionId = "account" | "security" | "notifications" | "danger";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "security", label: "Password & sign-in" },
  { id: "notifications", label: "Notifications" },
  { id: "danger", label: "Delete account" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0] + parts[1]![0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

function formatMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function AccountSettings({
  fullName,
  email,
  imageUrl,
  phone,
  phoneVerified,
  memberSince,
  hasCandidateProfile,
  avatarUploadEnabled,
  googleConnected,
  notificationPreferences,
  security,
}: {
  fullName: string;
  email: string;
  imageUrl: string | null;
  phone: string | null;
  phoneVerified: boolean;
  /** ISO string; dates do not cross the server/client boundary as objects. */
  memberSince: string;
  hasCandidateProfile: boolean;
  avatarUploadEnabled: boolean;
  googleConnected: boolean;
  notificationPreferences: EmailNotificationPreference[];
  /** Null when email login (ENABLE_EMAIL_LOGIN) is off: no password to manage. */
  security: { hasPassword: boolean; googleOnly: boolean; needsCode: boolean } | null;
}) {
  const sections = SECTIONS.filter(
    (s) => s.id !== "danger" || hasCandidateProfile,
  );
  const [active, setActive] = useState<SectionId>("account");

  // Highlight the Quick Link for the section in view. The page scrolls inside
  // the shell's content area, not the window, so that is the observer root.
  useEffect(() => {
    const root = document.querySelector(".abt-content-scroll");
    const targets = sections
      .map((s) => document.getElementById(`settings-${s.id}`))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first) setActive(first.target.id.replace("settings-", "") as SectionId);
      },
      { root, rootMargin: "-80px 0px -55% 0px", threshold: 0 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
    // `sections` is derived from a prop that never changes on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCandidateProfile]);

  function goTo(id: SectionId) {
    setActive(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`settings-${id}`)
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  const avatar = (
    <div className="as-avatar-wrap">
      <div className="as-avatar">
        {imageUrl ? (
          // Avatar URLs are user-supplied remotes; next/image is not
          // configured for arbitrary hosts here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" />
        ) : (
          <span aria-hidden>{initials(fullName)}</span>
        )}
      </div>
      {hasCandidateProfile ? (
        <AvatarEditor unavailable={!avatarUploadEnabled} />
      ) : null}
    </div>
  );

  return (
    <div className="as-root">
      <div className="as-workspace">
        {/* ---- left card: identity + Quick Links ---- */}
        <aside className="as-side-card" aria-label="Account settings">
          <div className="as-identity">
            {avatar}
            <div className="as-identity-copy">
              <p className="as-identity-name">{fullName}</p>
              <p className="as-identity-email">{email}</p>
            </div>
            {hasCandidateProfile ? (
              <Link href="/profile" className="as-btn as-btn-outline as-btn-block">
                View profile
              </Link>
            ) : null}
          </div>

          <nav className="as-quick" aria-label="Settings sections">
            <h2 className="as-quick-title">Quick Links</h2>
            <ul>
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`as-quick-item${active === s.id ? " as-current" : ""}${s.id === "danger" ? " as-quick-danger" : ""}`}
                    aria-current={active === s.id ? "true" : undefined}
                    onClick={() => goTo(s.id)}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* ---- main column ---- */}
        <div className="as-main">
          <header className="as-page-head">
            <h1>Account settings</h1>
            <p>Manage how you sign in, what we email you and your account.</p>
          </header>

          {/* Mobile: the side card is hidden, so identity + tabs come here. */}
          <div className="as-mobile-identity">
            {avatar}
            <div className="as-identity-copy">
              <p className="as-identity-name">{fullName}</p>
              <p className="as-identity-email">{email}</p>
            </div>
          </div>
          <nav className="as-mobile-tabs" aria-label="Settings sections">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`as-chip${active === s.id ? " as-current" : ""}`}
                aria-current={active === s.id ? "true" : undefined}
                onClick={() => goTo(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* ---- Account ---- */}
          <section id="settings-account" className="as-card" aria-labelledby="as-h-account">
            <div className="as-card-head">
              <span className="as-card-icon" aria-hidden>
                <UserRound />
              </span>
              <div>
                <h2 id="as-h-account">Account</h2>
                <p>Your sign-in identity. Name and phone are edited in your profile.</p>
              </div>
            </div>
            <dl className="as-rows">
              <div className="as-row">
                <dt>Full name</dt>
                <dd>
                  <span>{fullName}</span>
                  {hasCandidateProfile ? (
                    <Link href="/profile?step=basic" className="as-link">
                      Edit in profile
                    </Link>
                  ) : null}
                </dd>
              </div>
              <div className="as-row">
                <dt>Email</dt>
                <dd>
                  <span className="as-break">{email}</span>
                  <span className="as-tag as-tag-muted">
                    <Lock aria-hidden /> Can&apos;t be changed
                  </span>
                </dd>
              </div>
              <div className="as-row">
                <dt>Phone</dt>
                <dd>
                  {phone ? (
                    <>
                      <span>{phone}</span>
                      {phoneVerified ? (
                        <span className="as-tag as-tag-ok">
                          <CheckCircle2 aria-hidden /> Verified
                        </span>
                      ) : (
                        <span className="as-tag as-tag-warn">Not verified</span>
                      )}
                    </>
                  ) : (
                    <span className="as-muted">Not added</span>
                  )}
                  {hasCandidateProfile ? (
                    <Link href="/profile?step=basic" className="as-link">
                      {phone ? "Manage in profile" : "Add in profile"}
                    </Link>
                  ) : null}
                </dd>
              </div>
              <div className="as-row">
                <dt>Member since</dt>
                <dd>
                  <span>{formatMonthYear(memberSince)}</span>
                </dd>
              </div>
            </dl>
          </section>

          {/* ---- Password & sign-in ---- */}
          <section id="settings-security" className="as-card" aria-labelledby="as-h-security">
            <div className="as-card-head">
              <span className="as-card-icon" aria-hidden>
                <ShieldCheck />
              </span>
              <div>
                <h2 id="as-h-security">Password &amp; sign-in</h2>
                <p>The ways you can get into your account.</p>
              </div>
            </div>

            <ul className="as-methods">
              <li>
                <span className="as-method-icon" aria-hidden>
                  <Mail />
                </span>
                <span className="as-method-copy">
                  <strong>Email code</strong>
                  <span>A one-time code sent to {email}</span>
                </span>
                <span className="as-tag as-tag-ok">Always on</span>
              </li>
              {security && !security.googleOnly ? (
                <li>
                  <span className="as-method-icon" aria-hidden>
                    <KeyRound />
                  </span>
                  <span className="as-method-copy">
                    <strong>Password</strong>
                    <span>
                      {security.hasPassword
                        ? "Sign in with your email and password"
                        : "Add a password as an extra way in"}
                    </span>
                  </span>
                  <span
                    className={`as-tag ${security.hasPassword ? "as-tag-ok" : "as-tag-muted"}`}
                  >
                    {security.hasPassword ? "Set" : "Not set"}
                  </span>
                </li>
              ) : null}
              <li>
                <span className="as-method-icon as-google" aria-hidden>
                  G
                </span>
                <span className="as-method-copy">
                  <strong>Google</strong>
                  <span>
                    {googleConnected
                      ? "Linked to this account"
                      : "Use \"Continue with Google\" on the sign-in page with this email"}
                  </span>
                </span>
                <span className={`as-tag ${googleConnected ? "as-tag-ok" : "as-tag-muted"}`}>
                  {googleConnected ? "Connected" : "Not connected"}
                </span>
              </li>
            </ul>

            {security ? (
              <div className="as-subsection">
                <h3>{security.hasPassword ? "Change password" : "Set a password"}</h3>
                <div className="as-form-slot">
                  <PasswordSettingsForm
                    email={email}
                    audience="candidate"
                    hasPassword={security.hasPassword}
                    googleOnly={security.googleOnly}
                    needsCode={security.needsCode}
                    backHref="/settings"
                    backLabel="Back to account settings"
                  />
                </div>
              </div>
            ) : null}
          </section>

          {/* ---- Notifications ---- */}
          <section
            id="settings-notifications"
            className="as-card"
            aria-labelledby="as-h-notifications"
          >
            <div className="as-card-head">
              <span className="as-card-icon" aria-hidden>
                <Bell />
              </span>
              <div>
                <h2 id="as-h-notifications">Notifications</h2>
                <p>Choose which emails you get. In-app notifications are always on.</p>
              </div>
            </div>
            {notificationPreferences.length > 0 ? (
              <NotificationPreferencesForm preferences={notificationPreferences} />
            ) : (
              <p className="as-muted as-empty">
                There are no email notifications to manage right now.
              </p>
            )}
          </section>

          {/* ---- Delete account ---- */}
          {hasCandidateProfile ? (
            <section
              id="settings-danger"
              className="as-card as-card-danger"
              aria-labelledby="as-h-danger"
            >
              <div className="as-card-head">
                <span className="as-card-icon as-card-icon-danger" aria-hidden>
                  <TriangleAlert />
                </span>
                <div>
                  <h2 id="as-h-danger">Delete account</h2>
                  <p>
                    This removes your profile and data from Klymb AI. It can&apos;t
                    be undone.
                  </p>
                </div>
              </div>
              <div className="as-danger-action">
                <DeleteOwnAccountDialog />
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
