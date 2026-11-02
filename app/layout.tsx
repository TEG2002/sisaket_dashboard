import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบติดตามข้อมูลผู้ป่วยเข้ารับการบำบัด จ.ศรีสะเกษ",
  description: "แดชบอร์ดบริหารข้อมูลผู้ป่วยเข้ารับการบำบัดในหมู่บ้าน/ชุมชน รายอำเภอ จังหวัดศรีสะเกษ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Prompt:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

