import type { Metadata } from "next";
import { Lato, PT_Serif } from "next/font/google";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";
import "./globals.css";

const lato = Lato({
  variable: "--font-sans",
  subsets: ["latin"],
  weight:['100', '300', '400', '700', '900']
});

const ptSerif = PT_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ['400', '700']
});


export const metadata: Metadata = {
  title: "MyFlix",
  description: "Stream movies and TV shows",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${lato.variable} ${ptSerif.variable} antialiased bg-[#141414] text-white`}>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
