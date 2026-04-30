import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { HealthBanners } from "@/components/HealthBanners";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SecondBrain — People Knowledge Graph",
  description:
    "A second brain focused on the people in your life. Capture messy notes, build a living graph.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="grid min-h-screen grid-cols-[240px_1fr]">
          <Sidebar />
          <main className="mx-auto w-full max-w-[1280px] px-10 pb-20 pt-8">
            <HealthBanners />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
