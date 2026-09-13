import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "../context/WalletContext";
import { Providers } from "../components/Providers";
import { Syne, Plus_Jakarta_Sans } from "next/font/google";

// Lusion-inspired typography: Syne for futuristic creative display headlines,
// Plus Jakarta Sans for clean, high-clarity technical & UI typography.
const syne = Syne({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GreenLedger — AI Energy & Carbon Optimization Platform",
  description:
    "Real-time Windows telemetry monitoring, XGBoost power prediction, verified carbon reduction, and Web3 achievement marketplace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${syne.variable} ${plusJakartaSans.variable} min-h-screen bg-black text-white antialiased selection:bg-emerald-500/30 selection:text-white font-sans`}
      >
        <Providers>
          <WalletProvider>{children}</WalletProvider>
        </Providers>
      </body>
    </html>
  );
}
