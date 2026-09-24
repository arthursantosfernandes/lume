import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ProvedorSessao } from "@/components/Sessao";

export const metadata: Metadata = {
  title: "Lumê — Prontuário Estético",
  description: "Prontuário eletrônico para profissionais de estética",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: "Lumê", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7E9A83",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        <ProvedorSessao>{children}</ProvedorSessao>
      </body>
    </html>
  );
}
