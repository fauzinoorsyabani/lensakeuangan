export type ReceiptImageState = "loading" | "loaded" | "error";
export type ReceiptImageEvent = "reset" | "load" | "error";

export function transitionReceiptImageState(_state: ReceiptImageState, event: ReceiptImageEvent): ReceiptImageState {
  if (event === "load") return "loaded";
  if (event === "error") return "error";
  return "loading";
}
