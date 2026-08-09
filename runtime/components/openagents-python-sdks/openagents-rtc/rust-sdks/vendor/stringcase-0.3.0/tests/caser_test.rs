use stringcase::Caser;

#[test]
fn it_should_convert_to_camel_case_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_camel_case();
    assert_eq!(converted, "fooBar100BazQux");
}

#[test]
fn it_should_convert_to_camel_case_with_sep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_camel_case_with_sep("_");
    assert_eq!(converted, "fooBar100BazQux");
}

#[test]
fn it_should_convert_to_camel_case_with_keep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_camel_case_with_keep("#");
    assert_eq!(converted, "fooBar100BazQux");
}

#[test]
fn it_should_convert_to_cobol_case_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_cobol_case();
    assert_eq!(converted, "FOO-BAR100-BAZ-QUX");
}

#[test]
fn it_should_convert_to_cobol_case_with_nums_as_word_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_cobol_case_with_nums_as_word();
    assert_eq!(converted, "FOO-BAR-100-BAZ-QUX");
}

#[test]
fn it_should_convert_to_cobol_case_with_sep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_cobol_case_with_sep("_");
    assert_eq!(converted, "FOO-BAR100-BAZ-QUX");
}

#[test]
fn it_should_convert_to_cobol_case_with_keep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_cobol_case_with_keep("#");
    assert_eq!(converted, "FOO-BAR100-BAZ-QUX");
}

#[test]
fn it_should_convert_to_kebab_case_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_kebab_case();
    assert_eq!(converted, "foo-bar100-baz-qux");
}

#[test]
fn it_should_convert_to_kebab_case_with_nums_as_word_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_kebab_case_with_nums_as_word();
    assert_eq!(converted, "foo-bar-100-baz-qux");
}

#[test]
fn it_should_convert_to_kebab_case_with_sep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_kebab_case_with_sep("_");
    assert_eq!(converted, "foo-bar100-baz-qux");
}

#[test]
fn it_should_convert_to_kebab_case_with_keep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_kebab_case_with_keep("#");
    assert_eq!(converted, "foo-bar100-baz-qux");
}

#[test]
fn it_should_convert_to_macro_case_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_macro_case();
    assert_eq!(converted, "FOO_BAR100_BAZ_QUX");
}

#[test]
fn it_should_convert_to_macro_case_with_nums_as_word_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_macro_case_with_nums_as_word();
    assert_eq!(converted, "FOO_BAR_100_BAZ_QUX");
}

#[test]
fn it_should_convert_to_macro_case_with_sep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_macro_case_with_sep("_");
    assert_eq!(converted, "FOO_BAR100_BAZ_QUX");
}

#[test]
fn it_should_convert_to_macro_case_with_keep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_macro_case_with_keep("#");
    assert_eq!(converted, "FOO_BAR100_BAZ_QUX");
}

#[test]
fn it_should_convert_to_pascal_case_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_pascal_case();
    assert_eq!(converted, "FooBar100BazQux");
}

#[test]
fn it_should_convert_to_pascal_case_with_sep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_pascal_case_with_sep("_");
    assert_eq!(converted, "FooBar100BazQux");
}

#[test]
fn it_should_convert_to_pascal_case_with_keep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_pascal_case_with_keep("#");
    assert_eq!(converted, "FooBar100BazQux");
}

#[test]
fn it_should_convert_to_snake_case_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_snake_case();
    assert_eq!(converted, "foo_bar100_baz_qux");
}

#[test]
fn it_should_convert_to_snake_case_with_nums_as_word_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_snake_case_with_nums_as_word();
    assert_eq!(converted, "foo_bar_100_baz_qux");
}

#[test]
fn it_should_convert_to_snake_case_with_sep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_snake_case_with_sep("_");
    assert_eq!(converted, "foo_bar100_baz_qux");
}

#[test]
fn it_should_convert_to_snake_case_with_keep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_snake_case_with_keep("#");
    assert_eq!(converted, "foo_bar100_baz_qux");
}

#[test]
fn it_should_convert_to_train_case_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_train_case();
    assert_eq!(converted, "Foo-Bar100-Baz-Qux");
}

#[test]
fn it_should_convert_to_train_case_with_nums_as_word_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_train_case_with_nums_as_word();
    assert_eq!(converted, "Foo-Bar-100-Baz-Qux");
}

#[test]
fn it_should_convert_to_train_case_with_sep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_train_case();
    assert_eq!(converted, "Foo-Bar100-Baz-Qux");
}

#[test]
fn it_should_convert_to_train_case_with_keep_by_method_of_string() {
    let converted = "foo_bar100BAZQux".to_train_case_with_keep("#");
    assert_eq!(converted, "Foo-Bar100-Baz-Qux");
}
