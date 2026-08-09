#![feature(test)]

extern crate test;

use stringcase::{pascal_case, pascal_case_with_keep, pascal_case_with_sep};
use test::Bencher;

#[bench]
fn bench_pascal_case(b: &mut Bencher) {
    b.iter(|| pascal_case("foo_bar100%BAZQux"));
}

#[bench]
fn bench_pascal_case_with_sep(b: &mut Bencher) {
    b.iter(|| pascal_case_with_sep("foo_bar100%BAZQux", "_"));
}

#[bench]
fn bench_pascal_case_with_keep(b: &mut Bencher) {
    b.iter(|| pascal_case_with_keep("foo_bar100%BAZQux", "%"));
}
