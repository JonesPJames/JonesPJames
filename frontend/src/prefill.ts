/** Tiny module-level state for prefilling Nová zakázka from Kalkulačka, Import or the client card. */
import type { LineItem } from "./components/LineItemEditor";

type Prefill = {
  client_name?: string;
  title?: string;
  prace?: LineItem[];
  material?: LineItem[];
  doprava?: LineItem[];
  description?: string;
};

let _prefill: Prefill | null = null;

export function setPrefill(p: Prefill) {
  _prefill = p;
}
export function consumePrefill(): Prefill | null {
  const p = _prefill;
  _prefill = null;
  return p;
}
