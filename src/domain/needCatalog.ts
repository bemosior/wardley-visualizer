export interface NeedOption {
  id: string;
  label: string;
  /** example placeholder shown in the "who needs this?" text field — must match this need, not a different example */
  userPlaceholder: string;
  /** example placeholders for the 3 capability text fields, in order — must match this need, not a different example */
  capabilityPlaceholders: [string, string, string];
}

/**
 * preset choices for Phase 1's "pick a user need" dropdown. Each option
 * carries its own example placeholders so the form's suggested answers
 * always match the selected need — previously the placeholders were
 * hardcoded to the tea example ("Commuter", "Kettle") regardless of which
 * need was picked, which testers flagged as a content leak (see TODO.md).
 */
export const NEED_CATALOG: NeedOption[] = [
  {
    id: "hot-tea",
    label: "Hot Tea",
    userPlaceholder: "Commuter",
    capabilityPlaceholders: ["Kettle", "Water", "Electricity"],
  },
  {
    id: "messaging-with-friends",
    label: "Messaging with Friends",
    userPlaceholder: "Teenager",
    capabilityPlaceholders: ["Smartphone", "Messaging App", "Mobile Network"],
  },
  {
    id: "fresh-grocery-delivery",
    label: "Fresh Grocery Delivery",
    userPlaceholder: "Home Cook",
    capabilityPlaceholders: ["Delivery Driver", "Refrigerated Storage", "Online Ordering"],
  },
  {
    id: "transport-to-the-airport",
    label: "Transport to the Airport",
    userPlaceholder: "Traveler",
    capabilityPlaceholders: ["Driver", "Vehicle", "Road Network"],
  },
  {
    id: "documents-signed",
    label: "Documents Signed",
    userPlaceholder: "Contractor",
    capabilityPlaceholders: ["E-Signature Tool", "Identity Verification", "Document Storage"],
  },
  {
    id: "photos-printed",
    label: "Photos Printed",
    userPlaceholder: "Parent",
    capabilityPlaceholders: ["Printer", "Photo Paper", "Ink"],
  },
];
