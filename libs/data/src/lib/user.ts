export interface IUser {
    username: string;
    location: Array<ILocation>;
    web_token: string;
    company: string;
    roles: Array<string>;
    // The parts of the app the user holds a role in ('warehouse', 'config', 'fat'). Each gives access to that area and
    // requires its training. Admins can open every area whatever is listed here.
    areas?: Array<string>;
    // The name shown in the training register.
    name?: string;
}

export interface ILocation {
    code: string;
    name: string;
}