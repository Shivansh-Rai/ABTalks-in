import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { MotionProvider } from "@/components/shared/motion-provider";
import { SynergyProvider } from "@/components/shared/synergy-provider";
import { NotificationProvider } from "@/components/shared/notification-provider";
import { Toaster } from "@/components/ui/sonner";
import { AppFooter } from "@/components/shared/app-footer";
import { BottomNavGate } from "@/components/shared/bottom-nav-gate";
import { MainShell } from "@/components/shared/main-shell";
import { CookieConsentProvider } from "@/components/legal/cookie-consent-provider";
import { CookieConsentModal } from "@/components/legal/cookie-consent-modal";
import { ChatWidget } from "@/components/chatbot/ChatWidget";
import { isChatbotEnabled } from "@/lib/feature-flags";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["400", "600", "800"],
});

export const metadata: Metadata = {
  title: "ABTalks | 60 Days Challenge",
  description: "Build your coding habit. Get discovered.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className={`${archivo.variable} min-h-full flex flex-col font-sans`}>
        <ThemeProvider
          attribute="class"
          forcedTheme="light"
          disableTransitionOnChange
        >
          <CookieConsentProvider>
            {/* Above SynergyProvider on purpose: BottomNavGate renders one of
                the two bell triggers and sits outside SynergyProvider. */}
            <NotificationProvider>
              <SynergyProvider>
                <MotionProvider>
                  <MainShell>{children}</MainShell>
                </MotionProvider>
              </SynergyProvider>
              <AppFooter />
              <BottomNavGate />
              <Toaster />
              <CookieConsentModal />
              {isChatbotEnabled() && <ChatWidget />}
            </NotificationProvider>
          </CookieConsentProvider>
        </ThemeProvider >
      </body >
    </html >
  );
}
