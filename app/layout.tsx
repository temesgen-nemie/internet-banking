import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
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
  title: "Internet Banking",
  description:
    "Design, simulate, and manage USSD flows with visual editing, auditing, and permissions.",
  applicationName: "USSD Menu Builder",
  metadataBase: new URL("https://ussdtool.profilesage.com"),
  openGraph: {
    title: "USSD Menu Builder",
    description:
      "Design, simulate, and manage USSD flows with visual editing, auditing, and permissions.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "USSD Menu Builder",
    description:
      "Design, simulate, and manage USSD flows with visual editing, auditing, and permissions.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
