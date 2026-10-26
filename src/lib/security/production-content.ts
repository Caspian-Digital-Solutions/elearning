import "server-only";

import { isProductionAppEnv } from "@/lib/app-env";

export const productionSampleBlockedMessage =
  "Sample and demo content is not available in the production environment.";

export const productionTestAccountBlockedMessage =
  "Test accounts cannot sign in to the production environment.";

export function isSamplePromptTitle(title: string): boolean {
  return title.trim().toUpperCase().startsWith("SAMPLE");
}

export function blockSampleContentInProduction(isSample: boolean): string | null {
  if (isProductionAppEnv() && isSample) {
    return productionSampleBlockedMessage;
  }
  return null;
}

export function blockSamplePromptInProduction(title: string, isSampleFlag?: boolean): string | null {
  return blockSampleContentInProduction(Boolean(isSampleFlag) || isSamplePromptTitle(title));
}

export function blockTestAccountInProduction(isTestAccount: boolean): string | null {
  if (isProductionAppEnv() && isTestAccount) {
    return productionTestAccountBlockedMessage;
  }
  return null;
}
