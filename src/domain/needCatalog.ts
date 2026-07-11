export interface NeedOption {
  id: string;
  label: string;
  /** example placeholder shown in the "who needs this?" text field — must match this need, not a different example */
  userPlaceholder: string;
  /** example placeholders for the 3 capability text fields, in order — must match this need, not a different example */
  capabilityPlaceholders: [string, string, string];
  /**
   * extra capability pills offered alongside `capabilityPlaceholders` (Phase 10's "examples"
   * chips only, never used as a text-field placeholder) — deliberately spans the evolution
   * spectrum (genesis/custom-built/product/commodity) so the capabilities a visitor picks aren't
   * all the same maturity, which matters once Phase 20 asks them to place each on the evolution
   * axis.
   */
  moreCapabilityOptions: string[];
}

/**
 * preset choices for Phase 10's "pick a user need" dropdown. Each option
 * carries its own example placeholders so the form's suggested answers
 * always match the selected need — previously the placeholders were
 * hardcoded to the tea example ("Commuter", "Kettle") regardless of which
 * need was picked, which testers flagged as a content leak (see TODO.md).
 *
 * Several options can share a `userPlaceholder` — each user has multiple needs on offer, not
 * just one — so `userPlaceholder` is intentionally NOT unique across the catalog the way `id`,
 * `label`, and the capability placeholders are (see `needCatalog.test.ts`).
 */
export const NEED_CATALOG: NeedOption[] = [
  {
    id: "hot-tea",
    label: "Hot Tea",
    userPlaceholder: "Commuter",
    capabilityPlaceholders: ["Kettle", "Water", "Electricity"],
    moreCapabilityOptions: [
      "Thermoelectric Mug",
      "Blacksmith's Kettle",
      "Induction Coil Ring",
      "Propane Camp Stove",
      "Instant Hot Water Dispenser",
      "Tea Bag",
      "Vending Machine",
    ],
  },
  {
    id: "reliable-wifi-on-the-train",
    label: "Reliable Wifi on the Train",
    userPlaceholder: "Commuter",
    capabilityPlaceholders: ["Wifi Router", "Train Carriage", "Network Provider"],
    moreCapabilityOptions: [
      "Laser Data Link",
      "Trackside Relay Antenna",
      "Low-Earth-Orbit Satellite Dish",
      "Personal Mobile Hotspot",
      "Onboard Wifi Access Point",
      "Cellular Data Plan",
      "Signal Booster",
    ],
  },
  {
    id: "a-parking-spot-downtown",
    label: "A Parking Spot Downtown",
    userPlaceholder: "Commuter",
    capabilityPlaceholders: ["Parking Garage", "Payment Kiosk", "Security Camera"],
    moreCapabilityOptions: [
      "Valet Drone",
      "Building Super's Driveway",
      "Automated Valet Elevator",
      "Church Parking Lot",
      "Parking App",
      "Parking Meter",
      "Curbside Sensor",
    ],
  },
  {
    id: "messaging-with-friends",
    label: "Messaging with Friends",
    userPlaceholder: "Teenager",
    capabilityPlaceholders: ["Smartphone", "Messaging App", "Mobile Network"],
    moreCapabilityOptions: [
      "Satellite Mesh Pager",
      "CB Radio Channel",
      "Ham Radio Repeater",
      "Home-Hosted Chat Server",
      "Video Call App",
      "Public Wifi Access",
      "SIM Card",
    ],
  },
  {
    id: "streaming-the-latest-show",
    label: "Streaming the Latest Show",
    userPlaceholder: "Teenager",
    capabilityPlaceholders: ["Streaming App", "Wifi Connection", "Subscription Plan"],
    moreCapabilityOptions: [
      "Neural Playback Headset",
      "Shared Family Login",
      "Retinal Projection Display",
      "Borrowed Cable Box",
      "Smart TV",
      "Broadband Internet",
      "HDMI Cable",
    ],
  },
  {
    id: "charging-their-phone-on-the-go",
    label: "Charging Their Phone on the Go",
    userPlaceholder: "Teenager",
    capabilityPlaceholders: ["Portable Charger", "USB Cable", "Charging Port"],
    moreCapabilityOptions: [
      "Solar-Weave Backpack",
      "Salvaged Laptop Battery",
      "Public Wireless Charging Grid",
      "Borrowed Car Charger",
      "Charging Locker",
      "Wall Outlet",
      "Battery Case",
    ],
  },
  {
    id: "fresh-grocery-delivery",
    label: "Fresh Grocery Delivery",
    userPlaceholder: "Home Cook",
    capabilityPlaceholders: ["Delivery Driver", "Refrigerated Storage", "Online Ordering"],
    moreCapabilityOptions: [
      "Delivery Drone",
      "Neighbor's Grocery Run",
      "Autonomous Sidewalk Rover",
      "Farmers Market Stand",
      "Meal Kit Subscription",
      "Delivery Van",
      "Cold Chain Packaging",
    ],
  },
  {
    id: "a-recipe-for-dinner-tonight",
    label: "A Recipe for Dinner Tonight",
    userPlaceholder: "Home Cook",
    capabilityPlaceholders: ["Recipe App", "Pantry Inventory", "Ingredient List"],
    moreCapabilityOptions: [
      "AI Meal Planner",
      "Grandmother's Recipe Card",
      "Smart Fridge Suggestion Engine",
      "Family Cookbook",
      "Cooking Video Platform",
      "Grocery Store",
      "Measuring Cups",
    ],
  },
  {
    id: "meal-prep-containers",
    label: "Meal Prep Containers",
    userPlaceholder: "Home Cook",
    capabilityPlaceholders: ["Container Set", "Food Labels", "Storage Space"],
    moreCapabilityOptions: [
      "Vacuum-Seal Nanocoating",
      "Repurposed Jam Jars",
      "Biodegradable Nanofilm Wrap",
      "Reused Takeout Containers",
      "Vacuum Sealer Machine",
      "Plastic Wrap",
      "Refrigerator",
    ],
  },
  {
    id: "transport-to-the-airport",
    label: "Transport to the Airport",
    userPlaceholder: "Traveler",
    capabilityPlaceholders: ["Driver", "Vehicle", "Road Network"],
    moreCapabilityOptions: [
      "Air Taxi",
      "Neighbor's Carpool",
      "Autonomous Shuttle",
      "Off-Duty Taxi",
      "Rideshare App",
      "Taxi Stand",
      "Toll Road",
    ],
  },
  {
    id: "a-hotel-room-for-the-night",
    label: "A Hotel Room for the Night",
    userPlaceholder: "Traveler",
    capabilityPlaceholders: ["Booking Platform", "Front Desk", "Room Key"],
    moreCapabilityOptions: [
      "Capsule Hotel",
      "Host's Spare Room",
      "Automated Check-In Kiosk",
      "Couch-Surfing Network",
      "Hotel Loyalty App",
      "Housekeeping Service",
      "Air Conditioning Unit",
    ],
  },
  {
    id: "currency-exchanged-for-the-trip",
    label: "Currency Exchanged for the Trip",
    userPlaceholder: "Traveler",
    capabilityPlaceholders: ["Exchange Kiosk", "Local Currency", "Exchange Rate"],
    moreCapabilityOptions: [
      "Cross-Border Crypto Wallet",
      "Street Money Changer",
      "Biometric Payment Wristband",
      "Guesthouse Cash Exchange",
      "Travel Prepaid Card",
      "ATM Machine",
      "Bank Wire Transfer",
    ],
  },
  {
    id: "documents-signed",
    label: "Documents Signed",
    userPlaceholder: "Contractor",
    capabilityPlaceholders: ["E-Signature Tool", "Identity Verification", "Document Storage"],
    moreCapabilityOptions: [
      "Blockchain Notarization",
      "Traveling Notary",
      "Biometric Signature Scanner",
      "Handwritten Ledger",
      "Digital Contract Platform",
      "Fax Machine",
      "Notary Stamp",
    ],
  },
  {
    id: "materials-delivered-to-the-job-site",
    label: "Materials Delivered to the Job Site",
    userPlaceholder: "Contractor",
    capabilityPlaceholders: ["Supplier", "Delivery Truck", "Loading Dock"],
    moreCapabilityOptions: [
      "Drone Freight",
      "Subcontractor's Pickup Truck",
      "Autonomous Cargo Rover",
      "Owner-Operator's Flatbed",
      "Freight Broker App",
      "Shipping Container",
      "Forklift",
    ],
  },
  {
    id: "a-permit-approved",
    label: "A Permit Approved",
    userPlaceholder: "Contractor",
    capabilityPlaceholders: ["Permit Office", "Application Form", "Inspector"],
    moreCapabilityOptions: [
      "Automated Permit Reviewer",
      "Clerk's Direct Line",
      "AI Zoning Compliance Checker",
      "Neighborhood Association Sign-Off",
      "Online Permit Portal",
      "Building Code Manual",
      "Filing Fee",
    ],
  },
  {
    id: "photos-printed",
    label: "Photos Printed",
    userPlaceholder: "Parent",
    capabilityPlaceholders: ["Printer", "Photo Paper", "Ink"],
    moreCapabilityOptions: [
      "Holographic Photo Booth",
      "Neighborhood Darkroom",
      "Light-Field Camera",
      "Film Processing Lab",
      "Photo Printing Kiosk",
      "Photo Frame",
      "Digital Photo Album",
    ],
  },
  {
    id: "a-babysitter-for-date-night",
    label: "A Babysitter for Date Night",
    userPlaceholder: "Parent",
    capabilityPlaceholders: ["Babysitting App", "Background Check", "Reference List"],
    moreCapabilityOptions: [
      "Companion Robot",
      "Trusted Neighbor",
      "Nanny-Matching AI",
      "Church Youth Group Volunteer",
      "Daycare Center",
      "Baby Monitor",
      "Emergency Contact List",
    ],
  },
  {
    id: "school-supplies-for-the-new-year",
    label: "School Supplies for the New Year",
    userPlaceholder: "Parent",
    capabilityPlaceholders: ["Supply List", "Retail Store", "Backpack"],
    moreCapabilityOptions: [
      "3D-Printed Supply Kit",
      "Parent Swap Meet",
      "Smart Backpack Tracker",
      "Teacher's Wish List",
      "School Supply Subscription Box",
      "Notebook Paper",
      "Pencil Case",
    ],
  },
];
