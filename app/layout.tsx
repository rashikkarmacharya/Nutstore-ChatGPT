import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nutstore ChatGPT Connector",
  description: "A private Nutstore WebDAV connector for ChatGPT."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "4rem auto", padding: "0 1rem", lineHeight: 1.6 }}>
        {children}
      </body>
    </html>
  );
}
