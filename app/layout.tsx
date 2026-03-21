import type { Metadata } from "next";
import localFont from "next/font/local";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import PortraitLock from "@/components/PortraitLock";
import OnboardingGuard from "@/components/OnboardingGuard";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import "./globals.css";

const netflixSans = localFont({
  src: [
    { path: "../public/font/NetflixSans-Th.ttf", weight: "100", style: "normal" },
    { path: "../public/font/NetflixSans-ThIt.ttf", weight: "100", style: "italic" },
    { path: "../public/font/NetflixSans-Lt.ttf", weight: "300", style: "normal" },
    { path: "../public/font/NetflixSans-LtIt.ttf", weight: "300", style: "italic" },
    { path: "../public/font/NetflixSans-Rg.ttf", weight: "400", style: "normal" },
    { path: "../public/font/NetflixSans-It.ttf", weight: "400", style: "italic" },
    { path: "../public/font/NetflixSans-Md.ttf", weight: "500", style: "normal" },
    { path: "../public/font/NetflixSans-MdIt.ttf", weight: "500", style: "italic" },
    { path: "../public/font/NetflixSans-Bd.ttf", weight: "700", style: "normal" },
    { path: "../public/font/NetflixSans-BdIt.ttf", weight: "700", style: "italic" },
    { path: "../public/font/NetflixSans-Blk.ttf", weight: "900", style: "normal" },
    { path: "../public/font/NetflixSans-BlkIt.ttf", weight: "900", style: "italic" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Popflix",
  applicationName: "Popflix",
  description: "Stream movies and TV shows",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Popflix",
  },
  icons: {
    icon: "/icon-512.png",
    shortcut: "/icon-192.png",
    apple: "/apple-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#e50914",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${netflixSans.variable} antialiased bg-[#141414] text-white`}>
        <Providers>
          <OnboardingGuard />
          <div className="hidden md:block">
            <Navbar />
          </div>
          {children}
          <MobileBottomNav />
          <PWAInstallBanner />
          <PortraitLock />
        </Providers>
      </body>
    </html>
  );
}
