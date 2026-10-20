import { DM_Sans, Domine } from "next/font/google";

export const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const domine = Domine({
  subsets: ["latin"],
  variable: "--font-domine",
  display: "swap",
});

export const fontVariables = `${dmSans.variable} ${domine.variable}`;
