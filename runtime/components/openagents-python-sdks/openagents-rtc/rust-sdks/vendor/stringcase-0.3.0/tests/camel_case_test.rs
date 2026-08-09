use stringcase::{camel_case, camel_case_with_keep, camel_case_with_sep};

#[test]
fn it_should_convert_to_camel_case() {
    let converted = camel_case("foo_bar100%BAZQux");
    assert_eq!(converted, "fooBar100BazQux");
}

#[test]
fn it_should_convert_to_camel_case_with_sep() {
    let converted = camel_case_with_sep("foo_bar100%BAZQux", "_");
    assert_eq!(converted, "fooBar100%BazQux");
}

#[test]
fn it_should_convert_to_camel_case_with_keep() {
    let converted = camel_case_with_keep("foo_bar100%BAZQux", "%");
    assert_eq!(converted, "fooBar100%BazQux");
}
