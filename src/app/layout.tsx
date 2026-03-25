import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { WalletProvider } from "@/components/WalletProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Solana AI Trading Bot",
  description: "Multi-strategy AI trading bot with auto-learning for Solana",
  keywords: ["Solana", "Trading Bot", "AI", "DeFi", "Phantom", "Wallet"],
  authors: [{ name: "Solana AI Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Solana AI Trading Bot",
    description: "Multi-strategy AI trading bot with auto-learning",
    url: "https://solana-ai-bot.com",
    siteName: "Solana AI Bot",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Solana AI Trading Bot",
    description: "Multi-strategy AI trading bot with auto-learning",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <WalletProvider>
          {children}
          <Toaster />
        </WalletProvider>
      </body>
    </html>
  );
}
