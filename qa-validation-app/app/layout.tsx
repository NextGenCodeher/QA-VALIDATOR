import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Q&A Validation Platform | Expert ML Review",
  description:
    "Industry-grade expert validation platform for machine learning-generated question-answer pairs. Score, annotate, and export validated datasets.",
  keywords: "ML validation, Q&A review, expert annotation, machine learning, NLP evaluation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
