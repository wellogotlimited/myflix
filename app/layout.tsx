import type { Metadata } from "next";
import localFont from "next/font/local";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import PortraitLock from "@/components/PortraitLock";
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
  title: "MyFlix",
  description: "Stream movies and TV shows",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
          <div className="hidden md:block">
            <Navbar />
          </div>
          {children}
          <MobileBottomNav />
          <PortraitLock />
        </Providers>
      </body>
    </html>
  );
}
