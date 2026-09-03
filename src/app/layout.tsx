import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SITE_DESCRIPTION_EN, SITE_NAME_EN, getSiteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: SITE_NAME_EN,
    template: "%s · Kash",
  },
  description: SITE_DESCRIPTION_EN,
  applicationName: SITE_NAME_EN,
  other: {
    "format-detection": "telephone=no, date=no, email=no, address=no",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      {...{ "x-ms-format-detection": "none" }}
    >
      <body className="min-h-full flex flex-col" {...{ "x-ms-format-detection": "none" }}>
        {children}
      </body>
    </html>
  );
}
