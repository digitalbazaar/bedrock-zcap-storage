# bedrock-zcap-storage ChangeLog

## 7.1.0 - 2022-xx-xx

### Changed
- Add `package.json` `files` field.
- Lint module.
- Update dependencies.

## 7.0.0 - 2022-04-28

### Changed
- **BREAKING**: Update peer deps:
  - `@bedrock/core@6`
  - `@bedrock/mongodb@10`.

## 6.0.0 - 2022-04-01

### Changed
- **BREAKING**: Rename package to `@bedrock/zcap-storage`.
- **BREAKING**: Convert to module (ESM).
- **BREAKING**: Remove default export.
- **BREAKING**: Require node 14.x.

## 5.2.0 - 2022-03-29

### Changed
- Update peer deps:
  - `bedrock@4.5`
  - `bedrock-mongodb@8.5`.
- Update internals to use esm style and use `esm.js` to
  transpile to CommonJS.

## 5.1.0 - 2022-02-13

### Added
- Add cache to `zcaps` collection.

## 5.0.0 - 2022-01-11

### Changed
- **BREAKING**: Get `invoker` for internal indexing from
  `capability.controller` and require `capability.controller` field to be set.
- **BREAKING**: This version is compatible with zcap@7.

## 4.1.1 - 2021-12-14

### Changed
- Fix bug with database functions that were not being properly awaited inside
  `authorization.find` and `zcaps.get`.

### Added
- Add coverage tests in order to make sure all functions are working properly.

## 4.1.0 - 2021-11-29

### Added
- Added optional `explain` param to get more details about database performance.
- Added database tests in order to check database performance.

## 4.0.1 - 2021-11-23

### Changed
- **BREAKING**: Removed deprecated `fields` option. This should have been
  removed in 4.0.0 but was fixed in this immediate patch release.

## 4.0.0 - 2021-11-23

### Added
- **BREAKING**: Automatically remove zcap revocations that have expired from
  storage.
- Add `count()` method for counting zcap revocations associated with a
  particular `rootTarget`.

### Changed
- **BREAKING**: Change internal collection names to follow naming convention.
  This version is incompatible with previous versions and there is no
  auto-migration code.
- **BREAKING**: Change database format for storing revocations. The record
  format has been simplified to remove unnecessary database hashing. This
  version is incompatible with previous versions and there is no auto-migration
  code.
- **BREAKING**: Require a `rootTarget` to be associated with stored zcap
  revocations so that they can be aggregated against a particular root object
  or resource.

## 3.3.0 - 2021-07-23

### Changed
- Update peer dependencies; use bedrock@4.

## 3.2.0 - 2020-10-20

### Changed
- Update peer and test deps.

## 3.1.0 - 2020-07-07

### Changed
- Update peer deps, test deps and CI workflow.

### Fixed
- Fix usage of the MongoDB projection API.

## 3.0.0 - 2020-06-09

### Changed
- **BREAKING**: Upgrade `bedrock-mongodb` to ^7.0.0.
- Changed mongodb API methods to mongo driver 3.5.

### Added
- find now supports options.projection.
- If both fields and options.projection are defined find throws.

## 2.0.0 - 2020-02-26

### Changed
- **BREAKING**: Namespace mongo collections based on convention.

### Added
- Revocations API.

## 1.2.0 - 2020-01-10

### Added
- Support passing an array of invocation targets to `storage.get`.

## 1.1.0 - 2019-11-18

### Changed
- Update dependencies.

## 1.0.0 - 2019-08-02

## 0.1.0 - 2019-08-02

### Added
- Added core files.

- See git history for changes.
