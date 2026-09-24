import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from "@/lib/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial display serif for the marketing site's premium
// long-form pages (About). Optical sizing + soft weights keep
// large headlines elegant; falls back to the system serif.
const frauncesSerif = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

// ---- Karmax product identity -------------------------------------
// Single source of truth lives in @/lib/brand (importable from client
// components without a server↔client cycle). Re-exported here for the
// existing importers of this module.
export { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION };

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Karmax",
    "CMS",
    "content platform",
    "AI writing",
    "SEO suite",
    "content automation",
    "WordPress",
    "multi-site",
    "newsletter",
  ],
  authors: [{ name: `${SITE_NAME} Team` }],
  applicationName: SITE_NAME,
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var origSet = Element.prototype.setAttribute;
                  Element.prototype.setAttribute = function(name, value) {
                    if (typeof name === 'string' && (name === 'bis_skin_checked' || name.indexOf('bis_') === 0)) {
                      return;
                    }
                    return origSet.apply(this, arguments);
                  };
                  if (typeof document !== 'undefined') {
                    var clean = function() {
                      var els = document.querySelectorAll('[bis_skin_checked]');
                      for (var i = 0; i < els.length; i++) {
                        els[i].removeAttribute('bis_skin_checked');
                      }
                    };
                    clean();
                    if (document.readyState === 'loading') {
                      document.addEventListener('DOMContentLoaded', clean, { once: true });
                    }
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${frauncesSerif.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
