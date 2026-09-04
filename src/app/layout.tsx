import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/common/Navbar/Navbar";
import Footer from "@/components/common/Footer/Footer";

import { Suspense } from "react";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
  authors: [{ name: "โรงพยาบาลเถิน" }],
  creator: "โรงพยาบาลเถิน",
  publisher: "โรงพยาบาลเถิน",
  openGraph: {
    title: "โรงพยาบาลเถิน | Thoen Hospital",
    description:
      "โรงพยาบาลเถิน จังหวัดลำปาง ให้บริการด้านสุขภาพอย่างครบวงจร ด้วยทีมแพทย์และบุคลากรที่มีคุณภาพ",
    url: siteUrl,
    siteName: "โรงพยาบาลเถิน",
    images: [
      {
        url: "/images/common/logo-website.webp",
        width: 800,
        height: 800,
        alt: "ตราสัญลักษณ์โรงพยาบาลเถิน",
      },
    ],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "โรงพยาบาลเถิน | Thoen Hospital",
    description:
      "โรงพยาบาลเถิน จังหวัดลำปาง ให้บริการด้านสุขภาพอย่างครบวงจร",
    images: ["/images/common/logo-website.webp"],
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
    <html lang="th" className={sarabun.variable} data-scroll-behavior="smooth">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('unhandledrejection', function(event) {
                if (event.reason instanceof Event) {
                  console.warn('Caught unhandled Promise rejection (Event):', event.reason.type, event.reason);
                  event.preventDefault();
                }
              });
            `
          }}
        />
      </head>
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
