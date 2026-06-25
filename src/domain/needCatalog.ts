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
  { id: "hot-tea", label: "Hot Tea" },
  { id: "messaging-with-friends", label: "Messaging with Friends" },
  { id: "fresh-grocery-delivery", label: "Fresh Grocery Delivery" },
  { id: "transport-to-the-airport", label: "Transport to the Airport" },
  { id: "documents-signed", label: "Documents Signed" },
  { id: "photos-printed", label: "Photos Printed" },
];
