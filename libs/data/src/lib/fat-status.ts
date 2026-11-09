// Where does a FAT project, phase or unit stand? Shared by the FAT lists and their filter buttons so every list
// uses the same thresholds. Progress is the 0-100 figure the API already calculates.

export type FATState = 'Not started' | 'In progress' | 'Complete';

export function fatState(progress?: number | null): FATState {
  const value = progress || 0;
  if (value >= 100) {
    return 'Complete';
  }
  return value > 0 ? 'In progress' : 'Not started';
}

// Not started first, so unfinished work is easy to find when sorting by status.
export const FAT_STATE_ORDER: { [state: string]: number } = { 'Not started': 0, 'In progress': 1, 'Complete': 2 };
