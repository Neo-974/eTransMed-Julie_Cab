import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "./register-sw";

export const metadata: Metadata = {
  title: "eTransMed — Transmissions infirmières",
  description: "Transmissions vocales pour infirmiers libéraux (version test — données fictives)",
  applicationName: "eTransMed",
  appleWebApp: {
    capable: true,
    title: "eTransMed",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0d9488",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
