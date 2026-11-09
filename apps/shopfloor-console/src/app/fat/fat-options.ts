// The choices the FAT admin forms offer. One list for every page, so Add Phase, Add Unit and Add Checklist
// can never disagree about what a machine type or an option is called.

export interface FatChoice {
  value: string;
  name: string;
}

export const FAT_UNIT_TYPES: FatChoice[] = [
  { value: 'unit-z', name: 'Unit Z' },
  { value: 'unit-z-plus', name: 'Unit Z+' },
  { value: 'unit-z-compact', name: 'Unit Z-C' },
  { value: 'unit-w2', name: 'Unit W2' },
  { value: 'unit-x1', name: 'Unit X1' },
  { value: 'unit-v1', name: 'Unit V1' },
  { value: 'unit-v2', name: 'Unit V2' },
  { value: 'unit-y-standard', name: 'Unit Y Standard' },
  { value: 'unit-y-hybrid-rotate', name: 'Unit Y Hybrid Rotating Desk' },
  { value: 'unit-y-hybrid-fixed', name: 'Unit Y Hybrid Fixed Desk' },
  { value: 'unit-y-air', name: 'Unit Y Air' },
  { value: 'kiosk-b', name: 'Kiosk B' },
];

export const FAT_CHECKERS: FatChoice[] = [
  { value: 'tenant-a', name: 'Meridian' },
  { value: 'partner-a', name: 'Partner A' },
  { value: 'partner-b', name: 'Partner B' },
  { value: 'partner-c', name: 'Partner C' },
  { value: 'partner-d', name: 'Partner D' },
];

// Optional extras a unit can have; each adds its own checklist category.
export const FAT_UNIT_OPTIONS: FatChoice[] = [
  { value: 'FATaccess', name: 'Access BP' },
  { value: 'FATdocreader', name: 'Document Reader' },
  { value: 'FAThandheld', name: 'Handheld Scanner' },
  { value: 'FATpayment', name: 'Payment Terminal' },
  { value: 'FATnfc', name: 'NFC' },
  { value: 'FATmagnetic', name: 'Magnetic Card' },
  { value: 'FATbio', name: 'Bio Module' },
  { value: 'FATdisability', name: 'Disability Pad' },
  { value: 'FATmic', name: 'Microphone' },
  { value: 'FATled', name: 'LED' },
  { value: 'FATasi', name: 'ASI' },
  { value: 'FATswitch', name: 'Switch' },
  { value: 'FATshutter', name: 'Roller Shutter' },
];

// The readable name of a machine type, falling back to the stored value for one this list does not know.
export function unitTypeName(value: string): string {
  const found = FAT_UNIT_TYPES.find(t => t.value === value);
  return found ? found.name : value;
}
