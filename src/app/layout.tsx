import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/common/Navbar/Navbar";
import Footer from "@/components/common/Footer/Footer";

import { Suspense } from "react";

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-plex-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["200", "300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "โรงพยาบาลเถิน | Thoen Hospital ลำปาง",
    template: "%s | โรงพยาบาลเถิน",
  },
  description:
    "โรงพยาบาลเถิน จังหวัดลำปาง ให้บริการด้านสุขภาพอย่างครบวงจร ด้วยทีมแพทย์และบุคลากรที่มีคุณภาพ พร้อมดูแลสุขภาพของประชาชนในพื้นที่อำเภอเถินและใกล้เคียง",
  keywords: [
    "โรงพยาบาลเถิน",
    "Thoen Hospital",
    "โรงพยาบาล ลำปาง",
    "สาธารณสุข เถิน",
    "บริการสุขภาพ เถิน",
  ],
  openGraph: {
    title: "โรงพยาบาลเถิน | Thoen Hospital",
    description:
      "โรงพยาบาลเถิน จังหวัดลำปาง ให้บริการด้านสุขภาพอย่างครบวงจร",
    locale: "th_TH",
    type: "website",
  },
  icons: {
    icon: "/images/common/logo-website.webp",
    shortcut: "/images/common/logo-website.webp",
    apple: "/images/common/logo-website.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={ibmPlexSansThai.variable}>
      <body style={{ fontFamily: "var(--font-family)" }}>
        <Suspense fallback={<nav className="navbar" style={{ height: "var(--navbar-height)" }}></nav>}>
          <Navbar />
        </Suspense>
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
