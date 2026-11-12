"use client";

import { useState } from "react";
import type { MlResult, RegimeData } from "../lib/types";
import { RegimeGatePanel } from "./RegimeGatePanel";

export function RegimeGatePanelClient({
  mlResults,
  regimes,
  defaultPair,
}: {
  mlResults: MlResult[];
  regimes: RegimeData;
  defaultPair: string;
}) {
  const [selectedPair, setSelectedPair] = useState(defaultPair);
  return (
    <RegimeGatePanel
      mlResults={mlResults}
      regimes={regimes}
      selectedPair={selectedPair}
      onSelectPair={setSelectedPair}
    />
  );
}
