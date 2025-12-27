import type { Metadata } from "next";
import { Newsreader, Sora } from "next/font/google";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/terminology";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  metadataBase: new URL("https://val.virtuallimit.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Authentication is now handled by middleware
  // Unauthenticated users are redirected to /auth/login
  return (
    <html lang="en">
      <body
        className={`${newsreader.variable} ${sora.variable} font-sans antialiased`}
      >
        <main>{children}</main>
      </body>
    </html>
  );
}
