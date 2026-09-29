import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/common/Navbar/Navbar";
import Footer from "@/components/common/Footer/Footer";
import { siteConfig } from "@/config/site";
import { Suspense } from "react";

// Optimized Sarabun weights (P4)
const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} | ${siteConfig.englishName} ${siteConfig.province}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "โรงพยาบาลเถิน",
    "Thoen Hospital",
    "โรงพยาบาล ลำปาง",
    "สาธารณสุข เถิน",
    "บริการสุขภาพ เถิน",
    "ตรวจสุขภาพ ลำปาง",
    "ฉุกเฉิน 1669 ลำปาง",
  ],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  openGraph: {
    title: `${siteConfig.name} | ${siteConfig.englishName}`,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [
      {
        url: "/images/common/logo-website.webp",
        width: 800,
        height: 800,
        alt: `ตราสัญลักษณ์${siteConfig.name}`,
      },
    ],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} | ${siteConfig.englishName}`,
    description: siteConfig.description,
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
            `,
          }}
        />
      </head>
      <body>
        {/* Skip to main content link for keyboard & screen reader accessibility (A11) */}
        <a href="#main-content" className="skip-to-content">
          ข้ามไปเนื้อหาหลัก
        </a>
        <Suspense fallback={<nav className="navbar" style={{ height: "var(--navbar-height)" }}></nav>}>
          <Navbar />
        </Suspense>
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
