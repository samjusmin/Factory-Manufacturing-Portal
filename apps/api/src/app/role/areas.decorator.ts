import { SetMetadata } from '@nestjs/common';
import { TrainingArea } from '@webproject/data';

export const AREAS_KEY = 'areas';

// Marks a controller or route as belonging to part of the app ('warehouse', 'config' or 'fat'). Used with AreasGuard:
// the caller must hold a role in one of the listed areas (admins may open every area).
export const Areas = (...areas: TrainingArea[]) => SetMetadata(AREAS_KEY, areas);
