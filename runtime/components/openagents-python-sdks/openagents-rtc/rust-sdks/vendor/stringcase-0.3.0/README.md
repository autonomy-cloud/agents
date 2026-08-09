# [stringcase-rust][repo-url] [![crate.io][crateio-img]][crateio-url] [![doc.rs][docrs-img]][docrs-url] [![CI Status][ci-img]][ci-url] [![MIT License][mit-img]][mit-url]

This library provides some functions that convert string cases between camelCase, COBOL-CASE, kebab-case, MACRO_CASE, PascalCase, snake_case and Train-Case.
And this library also provides a trait `Caser` which makes strings enable to convert their cases by their own methods.

Basically, these functions targets the upper and lower cases of only ASCII alphabets for capitalization, and all characters except ASCII alphabets and ASCII numbers are eliminated as word separators.

To limit characters using as separators, the functions named like `*_with_sep` are provided, and to keep specified characters, the functions named like `*_with_keep` are provided.

In this crate, the default behavior of the conversion functions is to insert a separator after a sequence of numbers and symbols, but not before them. (For example, `snake_case("abc123def") ==> "abc123_def"`)
However, for cases where you want to insert a separator before the sequence as well, the functions names like `*_with_nums_as_word` are provided. (For example, `snake_case_with_nums_as_word("abc123def") ==> "abc_123_def"`)

## Install

In `Cargo.toml`, write this crate as a dependency.

```toml
[dependencies]
stringcase = "0.3.0"
```

## Usage

The function contained in this crate can be executed as follows:

```rust
use stringcase::camel_case;

fn main() {
    let input = "foo-bar-baz";
    let camel = camel_case(input);
    assert_eq!(camel, "fooBarBaz");
}
```

And by bringing `Caser` with `use` declaration, it will be able to execute methods of
strings, `String` or `&str`, to convert their cases.

```rust
use stringcase::Caser;

func main() {
    let input = "foo-bar-baz";
    let camel = input.to_camel_case();
    assert_eq!(camel, "fooBarBaz");
}
```

## Supporting Rust versions

This library supports Rust 1.56.1 or later.

```
% cargo msrv
Fetching index
Determining the Minimum Supported Rust Version (MSRV) for toolchain x86_64-apple-darwin
Using check command cargo check
Check for toolchain '1.66.1-x86_64-apple-darwin' succeeded
Check for toolchain '1.61.0-x86_64-apple-darwin' succeeded
Check for toolchain '1.58.1-x86_64-apple-darwin' succeeded
Check for toolchain '1.57.0-x86_64-apple-darwin' succeeded
Check for toolchain '1.56.1-x86_64-apple-darwin' succeeded
   Finished The MSRV is: 1.56.1   █████████████████████████████████████ 00:00:20
```

## License

Copyright (C) 2024 Takayuki Sato

This program is free software under MIT License.<br>
See the file LICENSE in this distribution for more details.


[repo-url]: https://github.com/sttk/stringcase-rust
[crateio-img]: https://img.shields.io/badge/crate.io-ver.0.3.0-fc8d62?logo=rust
[crateio-url]: https://crates.io/crates/stringcase
[docrs-img]: https://img.shields.io/badge/doc.rs-stringcase-66c2a5?logo=docs.rs
[docrs-url]: https://docs.rs/stringcase
[ci-img]: https://github.com/sttk/stringcase-rust/actions/workflows/rust.yml/badge.svg?branch=main
[ci-url]: https://github.com/sttk/stringcase-rust/actions
[mit-img]: https://img.shields.io/badge/license-MIT-green.svg
[mit-url]: https://opensource.org/licenses/MIT
