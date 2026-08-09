use stringcase::{snake_case, snake_case_with_keep, snake_case_with_sep};

#[test]
fn it_should_convert_to_snake_case() {
    let converted = snake_case("foo-bar100%-baz-qux");
    assert_eq!(converted, "foo_bar100_baz_qux");
}

#[test]
fn it_should_convert_to_snake_case_with_sep() {
    let converted = snake_case_with_sep("foo_bar100%BAZQux", "_");
    assert_eq!(converted, "foo_bar100%_baz_qux");
}

#[test]
fn it_should_convert_to_snake_case_with_keep() {
    let converted = snake_case_with_keep("foo_bar100%BAZQux", "%");
    assert_eq!(converted, "foo_bar100%_baz_qux");
}

#[test]
fn it_should_convert_to_snake_case_with_nums_as_word() {
    use stringcase::snake_case_with_nums_as_word as snake_case;

    let converted = snake_case("foo-bar100%-baz-qux");
    assert_eq!(converted, "foo_bar_100_baz_qux");
}
