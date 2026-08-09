#![feature(test)]

extern crate test;

use stringcase::{
    macro_case, macro_case_with_keep, macro_case_with_nums_as_word, macro_case_with_sep,
};
use test::Bencher;

#[bench]
fn bench_macro_case(b: &mut Bencher) {
    b.iter(|| macro_case("foo_bar100%BAZQux"));
}

#[bench]
fn bench_macro_case_with_sep(b: &mut Bencher) {
    b.iter(|| macro_case_with_sep("foo_bar100%BAZQux", "_"));
}

#[bench]
fn bench_macro_case_with_keep(b: &mut Bencher) {
    b.iter(|| macro_case_with_keep("foo_bar100%BAZQux", "%"));
}

#[bench]
fn bench_macro_case_with_nums_as_word(b: &mut Bencher) {
    b.iter(|| macro_case_with_nums_as_word("foo_bar100%BAZQux"));
}
