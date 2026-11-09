# Manufacturing Portal

A portfolio-sanitized version of a manufacturing communications app: an Nx monorepo
with an Angular frontend ([apps/shopfloor-console](apps/shopfloor-console)) and a NestJS API
([apps/api](apps/api)).

## Running the demo

No external services are required: no MongoDB install, directory server, mail server or ERP.

```
npm install --legacy-peer-deps
npx nx serve api   # NestJS API   -> http://localhost:3333/api
npm start          # Angular app  -> http://localhost:4200
```

On Node 17+ the old webpack in this Angular 12 workspace needs the legacy OpenSSL provider, so set
`NODE_OPTIONS=--openssl-legacy-provider` before `npm start`, `nx serve` and `nx build`
(PowerShell: `$env:NODE_OPTIONS="--openssl-legacy-provider"`).

### Demo accounts

| Username | Password | Role | What they see |
| --- | --- | --- | --- |
| `admin` | `admin123` | Admin | Everything, including Config admin, editing checklists and the Training register |
| `operator` | `operator123` | Operator | Warehouse (production, orders, receiving, inventory), their own location's Config, and FAT |
| `partner` | `partner123` | External partner | Only the FAT phases and units assigned to them |

What a non-admin can open depends on the **roles** (Warehouse, Config, FAT) an admin gives them in the Training
register. The pages are hidden and the API refuses requests for an area the person does not hold.

### Training register

Admins open **Training** to see each location, who is registered there, the roles they hold and where their
training stands. Each role requires a set of modules (listed in
[training-catalogue.ts](libs/data/src/lib/training-catalogue.ts)); every module is renewed 2 years after it was
completed. Modules that are expired or were never done show in red, and ones renewing within 60 days in amber.
Admins can record or clear a completion and change a person's roles from their page. Expired training is shown
only: it never blocks access. A change of roles takes effect at the person's next sign-in.

### How the demo works without the original infrastructure

- **Database**: if `MONGODB_URL` isn't set, the API starts an in-memory MongoDB
  (`mongodb-memory-server`) and loads demo data on boot (see
  [seed.service.ts](apps/api/src/app/seed/seed.service.ts)): stock, production and purchase orders,
  FAT projects with units and checklists, Config hardware units, hardware models, PC images, locations,
  extra people with roles, and a training register. Everything resets when the API restarts.
- **Auth**: the original Active Directory / LDAP login is replaced by a local mock strategy
  ([mock-auth.strategy.ts](apps/api/src/app/auth/mock-auth.strategy.ts)). Sessions are still JWTs.
- **ERP**: the original app synced stock and orders with an ERP over SOAP. When `NAV_DOMAIN` isn't
  set, receiving goods, consuming components and completing output update the local database only,
  and inventory adjusts to match.
- **Email**: without `EMAIL_HOST`, outgoing mail is captured locally (nodemailer `jsonTransport`).
- **Edit Checklist** (admin) saves FAT template changes to a runtime folder in your OS temp directory
  (`shopfloor-console-checklists`), never to the source tree; they apply immediately to new units and are
  cleared whenever the API restarts (FAT &rarr; Edit Checklist).
- **Config hardware catalogue**: the kinds of hardware are data, not code. A *category* (PC, Network Switch,
  UNIT-W1...) says whether its units have a PC image and which parts they have; a *hardware type* (Kiosk A PC,
  5-port D-Link...) belongs to one category and carries the checklist a new unit starts from. An admin adds, edits
  and removes them under Config &rarr; Manage &rarr; Item Checklists. The access tree in Edit Locations, the
  Hardware List categories and the Image List's PC types all read from it.
- **Config units**: every category works the same way: location &rarr; category &rarr; hardware type &rarr; units
  &rarr; a unit's page. A unit is identified by its **serial no.** (unique across Config), has a model, may have a
  PC image (only categories that use one) and parts (each with its own serial no.), and is allocated to a project or
  to **STOCK**. The unit page has the same checklist as FAT (answer buttons, progress, mark-complete, unsaved-changes
  warning and the "someone else saved first" merge), without the second-checker field. The model is filled in when
  the location has only one for the category and chosen from a list when it has several.
- **Config projects**: an admin creates the project codes each location can use in *Edit Locations* &rarr;
  *Projects*. Every location always has STOCK for items not allocated to a project; units can be moved to a project
  later. A code a unit still uses cannot be removed.
- **Config location access**: *Edit Locations* lets an admin choose, per location, which hardware types, PC images
  and hardware models it can use, and its projects. The models chosen under *Hardware Access* (from the Hardware
  List) are what appear in the Model list when that location adds a unit.

All product/company names, hardware model codenames, and QA checklist content in this repo have
been genericized and replaced with invented sample data. None of it reflects real products,
customers, or credentials.

## Tests

```
npx nx test api
npx nx test shopfloor-console
npx nx test data
```

Built with [Nx](https://nx.dev), Angular 12 and NestJS 7.
