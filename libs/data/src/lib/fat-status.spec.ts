import { fatState, FAT_STATE_ORDER } from './fat-status';

describe('fatState', () => {
  it('is Not started at zero or when there is no progress figure', () => {
    expect(fatState(0)).toBe('Not started');
    expect(fatState(undefined)).toBe('Not started');
    expect(fatState(null)).toBe('Not started');
  });

  it('is In progress between 1 and 99', () => {
    expect(fatState(1)).toBe('In progress');
    expect(fatState(99)).toBe('In progress');
  });

  it('is Complete at 100 or above', () => {
    expect(fatState(100)).toBe('Complete');
    expect(fatState(120)).toBe('Complete');
  });

  it('orders unfinished work first', () => {
    expect(FAT_STATE_ORDER['Not started']).toBeLessThan(FAT_STATE_ORDER['In progress']);
    expect(FAT_STATE_ORDER['In progress']).toBeLessThan(FAT_STATE_ORDER['Complete']);
  });
});
