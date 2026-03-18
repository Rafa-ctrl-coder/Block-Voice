import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const geistSans = Geist({variable:"--font-geist-sans",subsets:["latin"]});
const geistMono = Geist_Mono({variable:"--font-geist-mono",subsets:["latin"]});
export const metadata: Metadata = {title:"BlockVoice — Helping residents take back control",description:"Pool together with fellow residents to hold freeholders and managing agents to account. Report issues, share evidence, and challenge unfair charges together."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return(<html lang="en"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>)}
