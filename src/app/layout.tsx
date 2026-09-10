import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perseus Equipment Intelligence",
  description:
    "Data with Purpose. Dealerships with Direction. A secure, role-aware dealership analytics and automated reporting platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
