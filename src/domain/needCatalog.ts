export interface NeedOption {
  id: string;
  label: string;
}

/**
 * preset choices for Phase 1's "pick a user need" dropdown. Shape is
 * deliberately minimal ({id, label}) so Phase 3's question bank can reuse
 * the same pattern later.
 */
export const NEED_CATALOG: NeedOption[] = [
  { id: "hot-drinkable-tea", label: "Hot, drinkable tea" },
  { id: "message-a-friend-instantly", label: "A way to message a friend instantly" },
  { id: "groceries-delivered", label: "Fresh groceries delivered to my door" },
  { id: "taxi-to-the-airport", label: "A taxi to the airport" },
  { id: "document-signed-and-notarized", label: "A document signed and notarized" },
  { id: "photos-printed-quickly", label: "Photos printed quickly" },
];
