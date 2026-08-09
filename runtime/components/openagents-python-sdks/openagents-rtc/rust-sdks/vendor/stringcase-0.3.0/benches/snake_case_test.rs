#![feature(test)]

extern crate test;

use stringcase::{
    snake_case, snake_case_with_keep, snake_case_with_nums_as_word, snake_case_with_sep,
};
use test::Bencher;

#[bench]
fn bench_snake_case(b: &mut Bencher) {
    b.iter(|| snake_case("foo_bar100%BAZQux"));
}

#[bench]
fn bench_snake_case_with_sep(b: &mut Bencher) {
    b.iter(|| snake_case_with_sep("foo_bar100%BAZQux", "_"));
}

#[bench]
fn bench_snake_case_with_keep(b: &mut Bencher) {
    b.iter(|| snake_case_with_keep("foo_bar100%BAZQux", "%"));
}

#[bench]
fn bench_snake_case_with_nums_as_word(b: &mut Bencher) {
    b.iter(|| snake_case_with_nums_as_word("foo_bar100%BAZQux"));
}
