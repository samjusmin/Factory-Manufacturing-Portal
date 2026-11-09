import { of } from 'rxjs';
import { UnsavedChangesGuard } from './unsaved-changes.guard';

function build(answer: boolean, trigger: string) {
  const dialog: any = { open: jest.fn(() => ({ afterClosed: () => of(answer) })) };
  const router: any = { getCurrentNavigation: () => ({ trigger }) };
  const location: any = { go: jest.fn() };
  return { guard: new UnsavedChangesGuard(dialog, router, location), dialog, location };
}

const state: any = { url: '/config-hardware-checklist/HQ/PC/Kiosk/u1' };

function answer(guard: UnsavedChangesGuard) {
  let result: boolean;
  (guard.canDeactivate({ hasUnsavedChanges: () => true }, null, state) as any).subscribe((value) => (result = value));
  return result;
}

describe('UnsavedChangesGuard', () => {
  it('does not ask when nothing is unsaved', () => {
    const { guard, dialog } = build(true, 'imperative');
    expect(guard.canDeactivate({ hasUnsavedChanges: () => false }, null, state)).toBe(true);
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('leaves when the user chooses Leave', () => {
    const { guard, location } = build(true, 'popstate');
    expect(answer(guard)).toBe(true);
    expect(location.go).not.toHaveBeenCalled();
  });

  it('puts the page back in the history when the user stays after Back', () => {
    const { guard, location } = build(false, 'popstate');
    expect(answer(guard)).toBe(false);
    expect(location.go).toHaveBeenCalledWith(state.url);
  });

  it('leaves the history alone when the user stays after a link', () => {
    const { guard, location } = build(false, 'imperative');
    expect(answer(guard)).toBe(false);
    expect(location.go).not.toHaveBeenCalled();
  });
});
