use stringcase::{kebab_case, kebab_case_with_keep, kebab_case_with_sep};

#[test]
fn it_should_convert_to_kebab_case() {
    let converted = kebab_case("foo-bar100%-baz-qux");
    assert_eq!(converted, "foo-bar100-baz-qux");
}

#[test]
fn it_should_convert_to_kebab_case_with_sep() {
    let converted = kebab_case_with_sep("foo_bar100%BAZQux", "_");
    assert_eq!(converted, "foo-bar100%-baz-qux");
}

#[test]
fn it_should_convert_to_kebab_case_with_keep() {
    let converted = kebab_case_with_keep("foo_bar100%BAZQux", "%");
    assert_eq!(converted, "foo-bar100%-baz-qux");
}

#[test]
fn it_should_convert_to_kebab_case_with_nums_as_word() {
    use stringcase::kebab_case_with_nums_as_word as kebab_case;

    let converted = kebab_case("foo-bar100%-baz-qux");
    assert_eq!(converted, "foo-bar-100-baz-qux");
}
