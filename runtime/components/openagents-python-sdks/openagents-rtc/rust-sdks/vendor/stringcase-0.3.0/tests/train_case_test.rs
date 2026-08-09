use stringcase::{train_case, train_case_with_keep, train_case_with_sep};

#[test]
fn it_should_convert_to_train_case() {
    let converted = train_case("foo-bar100%-baz-qux");
    assert_eq!(converted, "Foo-Bar100-Baz-Qux");
}

#[test]
fn it_should_convert_to_train_case_with_sep() {
    let converted = train_case_with_sep("foo_bar100%BAZQux", "_");
    assert_eq!(converted, "Foo-Bar100%-Baz-Qux");
}

#[test]
fn it_should_convert_to_train_case_with_keep() {
    let converted = train_case_with_keep("foo_bar100%BAZQux", "%");
    assert_eq!(converted, "Foo-Bar100%-Baz-Qux");
}

#[test]
fn it_should_convert_to_train_case_with_nums_as_word() {
    use stringcase::train_case_with_nums_as_word as train_case;

    let converted = train_case("foo-bar100%-baz-qux");
    assert_eq!(converted, "Foo-Bar-100-Baz-Qux");
}
