import "server-only";

import { isProductionAppEnv } from "@/lib/app-env";

export const productionSampleBlockedMessage =
  "Sample and demo content is not available in the production environment.";

export const productionTestAccountBlockedMessage =
  "Test accounts cannot sign in to the production environment.";

export function blockSampleContentInProduction(isSample: boolean): string | null {
  if (isProductionAppEnv() && isSample) {
    return productionSampleBlockedMessage;
  }
  return null;
}

export function blockTestAccountInProduction(isTestAccount: boolean): string | null {
  if (isProductionAppEnv() && isTestAccount) {
    return productionTestAccountBlockedMessage;
  }
  return null;
}
