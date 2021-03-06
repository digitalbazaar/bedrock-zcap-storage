# bedrock-zcap-storage ChangeLog

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
