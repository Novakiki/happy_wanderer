import type { Metadata } from "next";
import { Newsreader, Sora } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import PasswordGate from "@/components/PasswordGate";

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Happy Wanderer",
  description: "A place to share and explore memories of Valerie Park Anderson",
  metadataBase: new URL("https://val.virtuallimit.com"),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("vals-memory-auth");
  const isAuthenticated = authCookie?.value === "authenticated";

  return (
    <html lang="en">
      <body
        className={`${newsreader.variable} ${sora.variable} font-sans antialiased`}
      >
        {isAuthenticated ? (
          <main>{children}</main>
        ) : (
          <PasswordGate />
        )}
      </body>
    </html>
  );
}
