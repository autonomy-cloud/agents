# Changelog

All notable changes to uniffi-dart will be documented in this file.

## v0.1.0+v0.30.0

Initial release of uniffi-dart targeting uniffi-rs v0.30.0.

### Dart binding generation

- All primitive types with bounds checking
- Strings, bytes, optionals, sequences, and maps
- Records with default values and named constructors
- Enums (flat and complex) with variant support
- Objects with constructors, methods, and disposable pattern
- Error types and exception handling
- Custom types
- Durations and timestamps

### Async support

- Async/Future support for functions, methods, and constructors
- Callback interfaces (UDL and proc-macro)
- Trait interfaces
- Stream support via extension macros

### Code generation

- Named parameters for generated functions and objects
- Multiple namespace support
- Dart Native Assets with `@Native` annotations
- Configurable library loading strategy
- Formatted generated Dart code

### Testing

- Comprehensive test suite
- CI with downstream testing (rust-payjoin and bdk-dart)
