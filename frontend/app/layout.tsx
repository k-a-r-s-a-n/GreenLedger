import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "../context/WalletContext";

export const metadata: Metadata = {
  title: "GreenLedger — AI Energy & Carbon Optimization Platform",
  description: "Real-time Windows telemetry monitoring, XGBoost power prediction, verified carbon reduction, and Web3 achievement marketplace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-gray-100 antialiased selection:bg-cyber-emerald/30 selection:text-cyber-neon">
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
