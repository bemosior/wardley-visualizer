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
  { id: "hot-tea", label: "Hot tea" },
  { id: "message-a-friend", label: "Message a friend" },
  { id: "fresh-grocery-delivery", label: "Fresh grocery delivery" },
  { id: "transport-to-the-airport", label: "Transport to the airport" },
  { id: "document-signed", label: "Document signed" },
  { id: "photos-printed", label: "Photos printed" },
];
