#![feature(test)]

extern crate test;

use stringcase::{
    kebab_case, kebab_case_with_keep, kebab_case_with_nums_as_word, kebab_case_with_sep,
};
use test::Bencher;

#[bench]
fn bench_kebab_case(b: &mut Bencher) {
    b.iter(|| kebab_case("foo_bar100%BAZQux"));
}

#[bench]
fn bench_kebab_case_with_sep(b: &mut Bencher) {
    b.iter(|| kebab_case_with_sep("foo_bar100%BAZQux", "_"));
}

#[bench]
fn bench_kebab_case_with_keep(b: &mut Bencher) {
    b.iter(|| kebab_case_with_keep("foo_bar100%BAZQux", "%"));
}

#[bench]
fn bench_kebab_case_with_nums_as_word(b: &mut Bencher) {
    b.iter(|| kebab_case_with_nums_as_word("foo_bar100%BAZQux"));
}
