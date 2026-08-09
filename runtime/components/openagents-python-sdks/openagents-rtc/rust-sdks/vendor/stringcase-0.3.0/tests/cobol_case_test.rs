use stringcase::{cobol_case, cobol_case_with_keep, cobol_case_with_sep};

#[test]
fn it_should_convert_to_cobol_case() {
    let converted = cobol_case("foo_bar100%BAZQux");
    assert_eq!(converted, "FOO-BAR100-BAZ-QUX");
}

#[test]
fn it_should_convert_to_cobol_case_with_sep() {
    let converted = cobol_case_with_sep("foo_bar100%BAZQux", "_");
    assert_eq!(converted, "FOO-BAR100%-BAZ-QUX");
}

#[test]
fn it_should_convert_to_cobol_case_with_keep() {
    let converted = cobol_case_with_keep("foo_bar100%BAZQux", "%");
    assert_eq!(converted, "FOO-BAR100%-BAZ-QUX");
}

#[test]
fn it_should_convert_to_cobol_case_with_nums_as_word() {
    use stringcase::cobol_case_with_nums_as_word as cobol_case;

    let converted = cobol_case("foo_bar100%BAZQux");
    assert_eq!(converted, "FOO-BAR-100-BAZ-QUX");
}
