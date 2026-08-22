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
  image_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  synced_at: string | null;
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
  imagePath?: string | null;
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
