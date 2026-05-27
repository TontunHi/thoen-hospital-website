import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={ibmPlexSansThai.variable}>
      <body style={{ fontFamily: "var(--font-family)" }}>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
