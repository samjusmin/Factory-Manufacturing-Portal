import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// FAT checklist templates ship inside the API bundle. Admin edits (FAT "Edit Checklist") are written to this runtime
// folder instead of the source tree, so they take effect immediately, never trigger a rebuild and are cleared whenever
// the API starts (see SeedService). Config's checklists are not files: they live in the hardware catalogue.
export const CHECKLIST_OVERRIDE_DIR = path.join(os.tmpdir(), 'shopfloor-console-checklists');

function overridePath(name: string) {
  return path.join(CHECKLIST_OVERRIDE_DIR, name);
}

function bundled(name: string) {
  return require('./checklist-template/' + name);
}

export function loadTemplate(name: string): any[] {
  const override = overridePath(name);
  if (fs.existsSync(override)) {
    return JSON.parse(fs.readFileSync(override, 'utf8'));
  }
  return JSON.parse(JSON.stringify(bundled(name)));
}

export function saveTemplateOverride(name: string, checklists: any[]) {
  const target = overridePath(name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(checklists, null, 2));
}

export function clearTemplateOverrides() {
  fs.rmSync(CHECKLIST_OVERRIDE_DIR, { recursive: true, force: true });
}
