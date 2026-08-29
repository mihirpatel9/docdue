/** The document kinds the app understands. `other` is the escape hatch. */
export const DOCUMENT_KINDS = [
  'passport',
  'drivers_license',
  'vehicle_registration',
  'insurance',
  'warranty',
  'membership',
  'visa',
  'certification',
  'other',
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const KIND_LABELS: Record<DocumentKind, string> = {
  passport: 'Passport',
  drivers_license: "Driver's licence",
  vehicle_registration: 'Vehicle registration',
  insurance: 'Insurance',
  warranty: 'Warranty',
  membership: 'Membership',
  visa: 'Visa',
  certification: 'Certification',
  other: 'Other',
};

export type DocumentRow = {
  id: string;
  user_id: string | null;
  title: string;
  kind: DocumentKind;
  issuer: string | null;
  reference: string | null;
  /** ISO calendar date, yyyy-mm-dd. Deliberately not a timestamp. */
  expires_on: string;
  issued_on: string | null;
  notes: string | null;
  /**
   * Legacy. Photos moved into `document_images` in migration V3; the adoption
   * sweep nulls this as it goes. Kept because a column an old row still points
   * at cannot be dropped until every install has completed that sweep, and
   * because dropping it would rewrite the table for no gain.
   */
  image_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  synced_at: string | null;
};

/**
 * A document photo, encrypted at rest with everything else in the vault.
 *
 * `data` is base64 rather than raw bytes — see the V3 comment in migrations.ts.
 */
export type DocumentImage = {
  data: string;
  mime: string;
};

/** A list row, plus whether a photo hangs off it. */
export type DocumentListRow = DocumentRow & {
  /** SQLite has no boolean; this is 0 or 1 from a LEFT JOIN. */
  has_image: number;
};

/** What a caller supplies to create a document — the rest is bookkeeping. */
export type NewDocument = {
  title: string;
  kind: DocumentKind;
  expiresOn: string;
  issuer?: string | null;
  reference?: string | null;
  issuedOn?: string | null;
  notes?: string | null;
  /**
   * `undefined` leaves an existing photo untouched on update; `null` removes
   * it. The two cannot be collapsed — an edit that only changed the title would
   * otherwise silently delete the picture.
   */
  image?: DocumentImage | null;
};

export type ReminderRow = {
  id: string;
  document_id: string;
  offset_days: number;
  fire_at: string;
  /**
   * The OS-level handle from expo-notifications. Device-local by nature — it
   * means nothing on another phone, so sync must never copy this column.
   */
  notification_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  synced_at: string | null;
};
