import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContextMap — Keep the thread",
  description: "A reading tool that helps you learn concepts without losing context.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
