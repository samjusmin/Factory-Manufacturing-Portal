import { UserController } from './user.controller';
import { UserService } from './user.service';

// A person's company decides which FAT data they can see, so nobody may be able to change their own through the API.
describe('User API', () => {
  it('has no way to change your own company', () => {
    expect((UserController.prototype as any).updateDefaultLoc).toBeUndefined();
    expect((UserService.prototype as any).setDefaultLoc).toBeUndefined();
  });
});
