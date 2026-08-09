// Copyright (C) 2024 Takayuki Sato. All Rights Reserved.
// This program is free software under MIT License.
// See the file LICENSE in this distribution for more details.

/// Converts a string to pascal case.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is pascal case.
///
/// This function targets the upper and lower cases of ASCII alphabets for
/// capitalization, and all characters except ASCII alphabets and ASCII numbers
/// are eliminated as word separators.
///
/// ```rust
///     let pascal = stringcase::pascal_case("foo_bar_baz");
///     assert_eq!(pascal, "FooBarBaz");
/// ```
pub fn pascal_case(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    // .len returns byte count but ok in this case!

    enum ChIs {
        FirstOfStr,
        NextOfUpper,
        NextOfMark,
        Others,
    }
    let mut flag = ChIs::FirstOfStr;

    for ch in input.chars() {
        if ch.is_ascii_uppercase() {
            match flag {
                ChIs::NextOfUpper => {
                    result.push(ch.to_ascii_lowercase());
                    //flag = ChIs::nextOfUpper;
                }
                _ => {
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
            }
        } else if ch.is_ascii_lowercase() {
            match flag {
                ChIs::NextOfUpper => match result.pop() {
                    Some(prev) => {
                        result.push(prev.to_ascii_uppercase());
                        result.push(ch);
                        flag = ChIs::Others;
                    }
                    None => (), // impossible
                },
                ChIs::FirstOfStr | ChIs::NextOfMark => {
                    result.push(ch.to_ascii_uppercase());
                    flag = ChIs::NextOfUpper;
                }
                _ => {
                    result.push(ch);
                    flag = ChIs::Others;
                }
            }
        } else if ch.is_ascii_digit() {
            result.push(ch);
            flag = ChIs::NextOfMark;
        } else {
            match flag {
                ChIs::FirstOfStr => (),
                _ => flag = ChIs::NextOfMark,
            }
        }
    }

    result
}

/// Converts a string to pascal case using the specified characters as
/// separators.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is pascal case.
///
/// This function targets only the upper and lower cases of ASCII alphabets for
/// capitalization, and the characters specified as the second argument of this
/// function are regarded as word separators and are eliminated.
///
/// ```rust
///     let pascal = stringcase::pascal_case_with_sep("foo-Bar100%Baz", "- ");
///     assert_eq!(pascal, "FooBar100%Baz");
/// ```
pub fn pascal_case_with_sep(input: &str, seps: &str) -> String {
    let mut result = String::with_capacity(input.len());
    // .len returns byte count but ok in this case!

    enum ChIs {
        FirstOfStr,
        NextOfUpper,
        NextOfMark,
        Others,
    }
    let mut flag = ChIs::FirstOfStr;

    for ch in input.chars() {
        if seps.contains(ch) {
            match flag {
                ChIs::FirstOfStr => (),
                _ => flag = ChIs::NextOfMark,
            }
        } else if ch.is_ascii_uppercase() {
            match flag {
                ChIs::NextOfUpper => {
                    result.push(ch.to_ascii_lowercase());
                    //flag = ChIs::NextOfUpper;
                }
                _ => {
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
            }
        } else if ch.is_ascii_lowercase() {
            match flag {
                ChIs::NextOfUpper => match result.pop() {
                    Some(prev) => {
                        result.push(prev.to_ascii_uppercase());
                        result.push(ch);
                        flag = ChIs::Others;
                    }
                    None => (), // impossible
                },
                ChIs::FirstOfStr | ChIs::NextOfMark => {
                    flag = ChIs::NextOfUpper;
                    result.push(ch.to_ascii_uppercase());
                }
                _ => {
                    result.push(ch);
                    flag = ChIs::Others;
                }
            }
        } else {
            result.push(ch);
            flag = ChIs::NextOfMark;
        }
    }

    result
}

/// Converts a string to pascal case using characters other than the specified
/// characters as separators.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is pascal case.
///
/// This function targets only the upper and lower cases of ASCII alphabets for
/// capitalization, and the characters other than the specified characters as
/// the second argument of this function are regarded as word separators and
/// are eliminated.
///
/// ```rust
///     let pascal = stringcase::pascal_case_with_keep("foo-bar100%baz", "%");
///     assert_eq!(pascal, "FooBar100%Baz");
/// ```
pub fn pascal_case_with_keep(input: &str, keeped: &str) -> String {
    let mut result = String::with_capacity(input.len());
    // .len returns byte count but ok in this case!

    enum ChIs {
        FirstOfStr,
        NextOfUpper,
        NextOfMark,
        Others,
    }
    let mut flag = ChIs::FirstOfStr;

    for ch in input.chars() {
        if ch.is_ascii_uppercase() {
            match flag {
                ChIs::NextOfUpper => {
                    result.push(ch.to_ascii_lowercase());
                    //flag = ChIs::NextOfUpper;
                }
                _ => {
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
            }
        } else if ch.is_ascii_lowercase() {
            match flag {
                ChIs::NextOfUpper => match result.pop() {
                    Some(prev) => {
                        result.push(prev.to_ascii_uppercase());
                        result.push(ch);
                        flag = ChIs::Others;
                    }
                    None => (), // impossible
                },
                ChIs::FirstOfStr | ChIs::NextOfMark => {
                    result.push(ch.to_ascii_uppercase());
                    flag = ChIs::NextOfUpper;
                }
                _ => {
                    result.push(ch);
                    flag = ChIs::Others;
                }
            }
        } else if ch.is_ascii_digit() || keeped.contains(ch) {
            result.push(ch);
            flag = ChIs::NextOfMark;
        } else {
            match flag {
                ChIs::FirstOfStr => (),
                _ => flag = ChIs::NextOfMark,
            }
        }
    }

    result
}

#[cfg(test)]
mod tests_of_pascal_case {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = pascal_case("abcDefGHIjk");
        assert_eq!(result, "AbcDefGhIjk");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = pascal_case("AbcDefGHIjk");
        assert_eq!(result, "AbcDefGhIjk");
    }

    #[test]
    fn it_should_convert_snake_case() {
        let result = pascal_case("abc_def_ghi");
        assert_eq!(result, "AbcDefGhi");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = pascal_case("abc-def-ghi");
        assert_eq!(result, "AbcDefGhi");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = pascal_case("Abc-Def-Ghi");
        assert_eq!(result, "AbcDefGhi");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = pascal_case("ABC_DEF_GHI");
        assert_eq!(result, "AbcDefGhi");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = pascal_case("ABC-DEF-GHI");
        assert_eq!(result, "AbcDefGhi");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = pascal_case("abc123-456defG789HIJklMN12");
        assert_eq!(result, "Abc123456DefG789HiJklMn12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = pascal_case("123abc456def");
        assert_eq!(result, "123Abc456Def");

        let result = pascal_case("123ABC456DEF");
        assert_eq!(result, "123Abc456Def");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = pascal_case(":.abc~!@def#$ghi%&jk(lm)no/?");
        assert_eq!(result, "AbcDefGhiJkLmNo");
    }

    #[test]
    fn it_should_convert_emtpy() {
        let result = pascal_case("");
        assert_eq!(result, "");
    }

    #[test]
    fn it_should_treat_number_sequence_by_default() {
        let result = pascal_case("abc123Def456#Ghi789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("ABC123-DEF456#GHI789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("abc123-def456#ghi789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("ABC123_DEF456#GHI789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("Abc123Def456#Ghi789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("abc123_def456#ghi789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("Abc123-Def456#-Ghi789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("000-abc123_def456#ghi789");
        assert_eq!(result, "000Abc123Def456Ghi789");
    }

    #[test]
    fn it_should_treat_number_sequence_as_word() {
        let result = pascal_case("abc123Def456#Ghi789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("ABC-123-DEF-456#GHI-789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("abc-123-def-456#ghi-789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("ABC_123_DEF_456#GHI_789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("Abc123Def456#Ghi789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("abc_123_def_456#ghi_789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("Abc-123-Def-456#Ghi-789");
        assert_eq!(result, "Abc123Def456Ghi789");

        let result = pascal_case("000_abc_123_def_456#ghi_789");
        assert_eq!(result, "000Abc123Def456Ghi789");
    }
}

#[cfg(test)]
mod tests_of_pascal_case_with_sep {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = pascal_case_with_sep("abcDefGHIjk", "-_");
        assert_eq!(result, "AbcDefGhIjk");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = pascal_case_with_sep("AbcDefGHIjk", "-_");
        assert_eq!(result, "AbcDefGhIjk");
    }

    #[test]
    fn it_should_convert_snake_case() {
        let result = pascal_case_with_sep("abc_def_ghi", "_");
        assert_eq!(result, "AbcDefGhi");

        let result = pascal_case_with_sep("abc_def_ghi", "-");
        assert_eq!(result, "Abc_Def_Ghi");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = pascal_case_with_sep("abc-def-ghi", "-");
        assert_eq!(result, "AbcDefGhi");

        let result = pascal_case_with_sep("abc-def-ghi", "_");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = pascal_case_with_sep("Abc-Def-Ghi", "-");
        assert_eq!(result, "AbcDefGhi");

        let result = pascal_case_with_sep("Abc-Def-Ghi", "_");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = pascal_case_with_sep("ABC_DEF_GHI", "_");
        assert_eq!(result, "AbcDefGhi");

        let result = pascal_case_with_sep("ABC_DEF_GHI", "-");
        assert_eq!(result, "Abc_Def_Ghi");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = pascal_case_with_sep("ABC_DEF_GHI", "_");
        assert_eq!(result, "AbcDefGhi");

        let result = pascal_case_with_sep("ABC_DEF_GHI", "-");
        assert_eq!(result, "Abc_Def_Ghi");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = pascal_case_with_sep("abc123-456defG789HIJklMN12", "-");
        assert_eq!(result, "Abc123456DefG789HiJklMn12");

        let result = pascal_case_with_sep("abc123-456defG789HIJklMN12", "_");
        assert_eq!(result, "Abc123-456DefG789HiJklMn12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = pascal_case_with_sep("123abc456def", "_");
        assert_eq!(result, "123Abc456Def");

        let result = pascal_case_with_sep("123ABC456DEF", "_");
        assert_eq!(result, "123Abc456Def");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = pascal_case_with_sep(":.abc~!@def#$ghi%&jk(lm)no/?", ":@$&()/");
        assert_eq!(result, ".Abc~!Def#Ghi%JkLmNo?");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = pascal_case_with_sep("", "-_");
        assert_eq!(result, "");
    }
}

#[cfg(test)]
mod tests_of_pascal_case_with_keep {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = pascal_case_with_keep("abcDefGHIjk", "-_");
        assert_eq!(result, "AbcDefGhIjk");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = pascal_case_with_keep("AbcDefGHIjk", "-_");
        assert_eq!(result, "AbcDefGhIjk");
    }

    #[test]
    fn it_should_convert_snake_case() {
        let result = pascal_case_with_keep("abc_def_ghi", "-");
        assert_eq!(result, "AbcDefGhi");

        let result = pascal_case_with_keep("abc_def_ghi", "_");
        assert_eq!(result, "Abc_Def_Ghi");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = pascal_case_with_keep("abc-def-ghi", "_");
        assert_eq!(result, "AbcDefGhi");

        let result = pascal_case_with_keep("abc-def-ghi", "-");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = pascal_case_with_keep("Abc-Def-Ghi", "_");
        assert_eq!(result, "AbcDefGhi");

        let result = pascal_case_with_keep("Abc-Def-Ghi", "-");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = pascal_case_with_keep("ABC_DEF_GHI", "-");
        assert_eq!(result, "AbcDefGhi");

        let result = pascal_case_with_keep("ABC_DEF_GHI", "_");
        assert_eq!(result, "Abc_Def_Ghi");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = pascal_case_with_keep("ABC-DEF-GHI", "_");
        assert_eq!(result, "AbcDefGhi");

        let result = pascal_case_with_keep("ABC-DEF-GHI", "-");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = pascal_case_with_keep("abc123-456defG789HIJklMN12", "_");
        assert_eq!(result, "Abc123456DefG789HiJklMn12");

        let result = pascal_case_with_keep("abc123-456defG789HIJklMN12", "-");
        assert_eq!(result, "Abc123-456DefG789HiJklMn12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = pascal_case_with_keep("123abc456def", "_");
        assert_eq!(result, "123Abc456Def");

        let result = pascal_case_with_keep("123ABC456DEF", "_");
        assert_eq!(result, "123Abc456Def");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = pascal_case_with_keep(":.abc~!@def#$ghi%&jk(lm)no/?", ".~!#%?");
        assert_eq!(result, ".Abc~!Def#Ghi%JkLmNo?");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = pascal_case_with_keep("", "-_");
        assert_eq!(result, "");
    }
}
