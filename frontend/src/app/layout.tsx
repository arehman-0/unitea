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
  title: "UniTea - Anonymous Campus Rumors",
  description: "A decentralized, self-correcting trust system for anonymous campus rumors",
  keywords: ["anonymous", "campus", "rumors", "trust", "university"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-void text-chalk min-h-screen`}
      >
        <div className="noise-overlay" />
        {children}
      </body>
    </html>
  );
}
