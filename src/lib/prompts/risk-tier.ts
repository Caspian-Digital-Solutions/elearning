import type { RiskTier } from "@/lib/prompts/types";

export const riskTierLabels: Record<RiskTier, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const riskTierReminder: Record<RiskTier, string> = {
  low: "Public or generic information only — no client names, live URLs, or confidential figures.",
  medium: "Internal or anonymised examples only; double-check before pasting into an AI tool.",
  high: "Do not paste client data; use fictional stand-ins and keep outputs for internal review.",
};
