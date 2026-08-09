use stringcase::{macro_case, macro_case_with_keep, macro_case_with_sep};

#[test]
fn it_should_convert_to_macro_case() {
    let converted = macro_case("foo-bar100%-baz-qux");
    assert_eq!(converted, "FOO_BAR100_BAZ_QUX");
}

#[test]
fn it_should_convert_to_macro_case_with_sep() {
    let converted = macro_case_with_sep("foo_bar100%BAZQux", "_");
    assert_eq!(converted, "FOO_BAR100%_BAZ_QUX");
}

#[test]
fn it_should_convert_to_macro_case_with_keep() {
    let converted = macro_case_with_keep("foo_bar100%BAZQux", "%");
    assert_eq!(converted, "FOO_BAR100%_BAZ_QUX");
}

#[test]
fn it_should_convert_to_macro_case_with_nums_as_word() {
    use stringcase::macro_case_with_nums_as_word as macro_case;

    let converted = macro_case("foo-bar100%-baz-qux");
    assert_eq!(converted, "FOO_BAR_100_BAZ_QUX");
}
