import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Z.ai Code Scaffold - AI-Powered Development",
  description: "Modern Next.js scaffold optimized for AI-powered development with Z.ai. Built with TypeScript, Tailwind CSS, and shadcn/ui.",
  keywords: ["Z.ai", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui", "AI development", "React"],
  authors: [{ name: "Z.ai Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Z.ai Code Scaffold",
    description: "AI-powered development with modern React stack",
    url: "https://chat.z.ai",
    siteName: "Z.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Z.ai Code Scaffold",
    description: "AI-powered development with modern React stack",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Strip browser-extension-injected attributes (e.g. bis_skin_checked from
          Bitdefender, data-lastpass-installed from LastPass, Grammarly attrs, etc.)
          BEFORE React hydrates. These extensions add attributes to the DOM after
          server render, causing hydration mismatch warnings. This script runs
          synchronously in <head> before hydration and keeps stripping via a
          MutationObserver so the attributes never reach React's reconciler.
        */}
        <script dangerouslySetInnerHTML={{
          __html: `(function(){var A=['bis_skin_checked','data-lastpass-installed','data-lp-timestamp','data-bitdefender','cz-shortcut-listen','data-new-gr-c-s-check-loaded','data-gr-c-s-loaded','data-gr-ext-installed','data-grammarly'];function s(){var sel='['+A.join('],[')+']';document.querySelectorAll(sel).forEach(function(el){A.forEach(function(a){el.removeAttribute(a);})});}s();var o=new MutationObserver(function(m){m.forEach(function(mut){if(mut.type==='attributes'&&A.indexOf(mut.attributeName)!==-1){mut.target.removeAttribute(mut.attributeName);}});});if(document.documentElement){o.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:A});}})();`,
        }} />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
