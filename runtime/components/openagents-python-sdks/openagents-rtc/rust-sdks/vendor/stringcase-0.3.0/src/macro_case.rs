// Copyright (C) 2024 Takayuki Sato. All Rights Reserved.
// This program is free software under MIT License.
// See the file LICENSE in this distribution for more details.

/// Converts a string to macro case.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is macro case.
///
/// This function targets the upper and lower cases of ASCII alphabets for
/// capitalization, and all characters except ASCII alphabets and ASCII numbers
/// are replaced to underscores as word separators.
///
/// ```rust
///     let m = stringcase::macro_case("fooBar123Baz");
///     assert_eq!(m, "FOO_BAR123_BAZ");
/// ```
pub fn macro_case(input: &str) -> String {
    let mut result = String::with_capacity(input.len() + input.len() / 2);
    // .len returns byte count but ok in this case!

    enum ChIs {
        FirstOfStr,
        NextOfUpper,
        NextOfContdUpper,
        NextOfSepMark,
        NextOfKeepedMark,
        Others,
    }
    let mut flag = ChIs::FirstOfStr;

    for ch in input.chars() {
        if ch.is_ascii_uppercase() {
            match flag {
                ChIs::FirstOfStr => {
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
                ChIs::NextOfUpper | ChIs::NextOfContdUpper => {
                    result.push(ch);
                    flag = ChIs::NextOfContdUpper;
                }
                _ => {
                    result.push('_');
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
            }
        } else if ch.is_ascii_lowercase() {
            match flag {
                ChIs::NextOfContdUpper => match result.pop() {
                    Some(prev) => {
                        result.push('_');
                        result.push(prev);
                    }
                    None => (), // impossible
                },
                ChIs::NextOfSepMark | ChIs::NextOfKeepedMark => {
                    result.push('_');
                }
                _ => (),
            }
            result.push(ch.to_ascii_uppercase());
            flag = ChIs::Others;
        } else if ch.is_ascii_digit() {
            match flag {
                ChIs::NextOfSepMark => result.push('_'),
                _ => (),
            }
            result.push(ch);
            flag = ChIs::NextOfKeepedMark;
        } else {
            match flag {
                ChIs::FirstOfStr => (),
                _ => flag = ChIs::NextOfSepMark,
            }
        }
    }

    result
}

/// Converts a string to macro case.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is macro case.
///
/// This function targets the upper and lower cases of ASCII alphabets and ASCII numbers
/// for capitalization, and all characters except ASCII alphabets and ASCII numbers
/// are replaced to underscores as word separators.
///
/// ```rust
///     let m = stringcase::macro_case_with_nums_as_word("fooBar123Baz");
///     assert_eq!(m, "FOO_BAR_123_BAZ");
/// ```
pub fn macro_case_with_nums_as_word(input: &str) -> String {
    let mut result = String::with_capacity(input.len() + input.len() / 2);
    // .len returns byte count but ok in this case!

    enum ChIs {
        FirstOfStr,
        NextOfUpper,
        NextOfContdUpper,
        NextOfSepMark,
        NextOfKeepedMark, // = next of number
        Others,
    }
    let mut flag = ChIs::FirstOfStr;

    for ch in input.chars() {
        if ch.is_ascii_uppercase() {
            match flag {
                ChIs::FirstOfStr => {
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
                ChIs::NextOfUpper | ChIs::NextOfContdUpper => {
                    result.push(ch);
                    flag = ChIs::NextOfContdUpper;
                }
                _ => {
                    result.push('_');
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
            }
        } else if ch.is_ascii_lowercase() {
            match flag {
                ChIs::NextOfContdUpper => match result.pop() {
                    Some(prev) => {
                        result.push('_');
                        result.push(prev);
                    }
                    None => (), // impossible
                },
                ChIs::NextOfSepMark | ChIs::NextOfKeepedMark => {
                    result.push('_');
                }
                _ => (),
            }
            result.push(ch.to_ascii_uppercase());
            flag = ChIs::Others;
        } else if ch.is_ascii_digit() {
            match flag {
                ChIs::FirstOfStr => (),
                ChIs::NextOfKeepedMark => (),
                _ => result.push('_'),
            }
            result.push(ch);
            flag = ChIs::NextOfKeepedMark;
        } else {
            match flag {
                ChIs::FirstOfStr => (),
                _ => flag = ChIs::NextOfSepMark,
            }
        }
    }

    result
}

/// Converts a string to macro case using the specified characters as
/// separators.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is macro case.
///
/// This function targets only the upper and lower cases of ASCII alphabets for
/// capitalization, and the characters specified as the second argument of this
/// function are regarded as word separators and are replaced to underscores.
///
/// ```rust
///     let m = stringcase::macro_case_with_sep("foo-Bar100%Baz", "- ");
///     assert_eq!(m, "FOO_BAR100%_BAZ");
/// ```
pub fn macro_case_with_sep(input: &str, seps: &str) -> String {
    let mut result = String::with_capacity(input.len() + input.len() / 2);
    // .len returns byte count but ok in this case!

    enum ChIs {
        FirstOfStr,
        NextOfUpper,
        NextOfContdUpper,
        NextOfSepMark,
        NextOfKeepedMark,
        Others,
    }
    let mut flag = ChIs::FirstOfStr;

    for ch in input.chars() {
        if seps.contains(ch) {
            match flag {
                ChIs::FirstOfStr => (),
                _ => flag = ChIs::NextOfSepMark,
            }
        } else if ch.is_ascii_uppercase() {
            match flag {
                ChIs::FirstOfStr => {
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
                ChIs::NextOfUpper | ChIs::NextOfContdUpper => {
                    result.push(ch);
                    flag = ChIs::NextOfContdUpper;
                }
                _ => {
                    result.push('_');
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
            }
        } else if ch.is_ascii_lowercase() {
            match flag {
                ChIs::NextOfContdUpper => match result.pop() {
                    Some(prev) => {
                        result.push('_');
                        result.push(prev);
                    }
                    None => (), // impossible
                },
                ChIs::NextOfSepMark | ChIs::NextOfKeepedMark => {
                    result.push('_');
                }
                _ => (),
            }
            result.push(ch.to_ascii_uppercase());
            flag = ChIs::Others;
        } else {
            match flag {
                ChIs::NextOfSepMark => result.push('_'),
                _ => (),
            }
            result.push(ch);
            flag = ChIs::NextOfKeepedMark;
        }
    }

    result
}

/// Converts a string to macro case using characters other than the specified
/// characters as separators.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is macro case.
///
/// This function targets only the upper and lower cases of ASCII alphabets for
/// capitalization, and the characters other than the specified characters as
/// the second argument of this function are regarded as word separators and
/// are replaced to underscores.
///
/// ```rust
///     let m = stringcase::macro_case_with_keep("foo-bar100%baz", "%");
///     assert_eq!(m, "FOO_BAR100%_BAZ");
/// ```
pub fn macro_case_with_keep(input: &str, keeped: &str) -> String {
    let mut result = String::with_capacity(input.len() + input.len() / 2);
    // .len returns byte count but ok in this case!

    enum ChIs {
        FirstOfStr,
        NextOfUpper,
        NextOfContdUpper,
        NextOfSepMark,
        NextOfKeepedMark,
        Others,
    }
    let mut flag = ChIs::FirstOfStr;

    for ch in input.chars() {
        if ch.is_ascii_uppercase() {
            match flag {
                ChIs::FirstOfStr => {
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
                ChIs::NextOfUpper | ChIs::NextOfContdUpper => {
                    result.push(ch);
                    flag = ChIs::NextOfContdUpper;
                }
                _ => {
                    result.push('_');
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
            }
        } else if ch.is_ascii_lowercase() {
            match flag {
                ChIs::NextOfContdUpper => match result.pop() {
                    Some(prev) => {
                        result.push('_');
                        result.push(prev);
                    }
                    None => (), // impossible
                },
                ChIs::NextOfSepMark | ChIs::NextOfKeepedMark => {
                    result.push('_');
                }
                _ => (),
            }
            result.push(ch.to_ascii_uppercase());
            flag = ChIs::Others;
        } else if ch.is_ascii_digit() || keeped.contains(ch) {
            match flag {
                ChIs::NextOfSepMark => result.push('_'),
                _ => (),
            }
            result.push(ch);
            flag = ChIs::NextOfKeepedMark;
        } else {
            match flag {
                ChIs::FirstOfStr => (),
                _ => flag = ChIs::NextOfSepMark,
            }
        }
    }

    result
}

#[cfg(test)]
mod tests_of_macro_case {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = macro_case("abcDefGHIjk");
        assert_eq!(result, "ABC_DEF_GH_IJK");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = macro_case("AbcDefGHIjk");
        assert_eq!(result, "ABC_DEF_GH_IJK");
    }

    #[test]
    fn it_should_convert_snake_case() {
        let result = macro_case("abc_def_ghi");
        assert_eq!(result, "ABC_DEF_GHI");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = macro_case("abc-def-ghi");
        assert_eq!(result, "ABC_DEF_GHI");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = macro_case("Abc-Def-Ghi");
        assert_eq!(result, "ABC_DEF_GHI");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = macro_case("ABC_DEF_GHI");
        assert_eq!(result, "ABC_DEF_GHI");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = macro_case("ABC-DEF-GHI");
        assert_eq!(result, "ABC_DEF_GHI");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = macro_case("abc123-456defG89HIJklMN12");
        assert_eq!(result, "ABC123_456_DEF_G89_HI_JKL_MN12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = macro_case("123abc456def");
        assert_eq!(result, "123_ABC456_DEF");

        let result = macro_case("123ABC456DEF");
        assert_eq!(result, "123_ABC456_DEF");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = macro_case(":.abc~!@def#$ghi%&jk(lm)no/?");
        assert_eq!(result, "ABC_DEF_GHI_JK_LM_NO");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = macro_case("");
        assert_eq!(result, "");
    }

    #[test]
    fn it_should_treat_number_sequence_by_default() {
        let result = macro_case("abc123Def456#Ghi789");
        assert_eq!(result, "ABC123_DEF456_GHI789");

        let result = macro_case("ABC123-DEF456#GHI789");
        assert_eq!(result, "ABC123_DEF456_GHI789");

        let result = macro_case("abc123-def456#ghi789");
        assert_eq!(result, "ABC123_DEF456_GHI789");

        let result = macro_case("ABC123_DEF456#GHI789");
        assert_eq!(result, "ABC123_DEF456_GHI789");

        let result = macro_case("Abc123Def456#Ghi789");
        assert_eq!(result, "ABC123_DEF456_GHI789");

        let result = macro_case("abc123_def456#ghi789");
        assert_eq!(result, "ABC123_DEF456_GHI789");

        let result = macro_case("Abc123-Def456#-Ghi789");
        assert_eq!(result, "ABC123_DEF456_GHI789");

        let result = macro_case("000-abc123_def456#ghi789");
        assert_eq!(result, "000_ABC123_DEF456_GHI789");
    }
}

#[cfg(test)]
mod tests_of_macro_case_with_nums_as_word {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = macro_case_with_nums_as_word("abcDefGHIjk");
        assert_eq!(result, "ABC_DEF_GH_IJK");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = macro_case_with_nums_as_word("AbcDefGHIjk");
        assert_eq!(result, "ABC_DEF_GH_IJK");
    }

    #[test]
    fn it_should_convert_snake_case() {
        let result = macro_case_with_nums_as_word("abc_def_ghi");
        assert_eq!(result, "ABC_DEF_GHI");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = macro_case_with_nums_as_word("abc-def-ghi");
        assert_eq!(result, "ABC_DEF_GHI");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = macro_case_with_nums_as_word("Abc-Def-Ghi");
        assert_eq!(result, "ABC_DEF_GHI");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = macro_case_with_nums_as_word("ABC_DEF_GHI");
        assert_eq!(result, "ABC_DEF_GHI");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = macro_case_with_nums_as_word("ABC-DEF-GHI");
        assert_eq!(result, "ABC_DEF_GHI");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = macro_case_with_nums_as_word("abc123-456defG89HIJklMN12");
        assert_eq!(result, "ABC_123_456_DEF_G_89_HI_JKL_MN_12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = macro_case_with_nums_as_word("123abc456def");
        assert_eq!(result, "123_ABC_456_DEF");

        let result = macro_case_with_nums_as_word("123ABC456DEF");
        assert_eq!(result, "123_ABC_456_DEF");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = macro_case_with_nums_as_word(":.abc~!@def#$ghi%&jk(lm)no/?");
        assert_eq!(result, "ABC_DEF_GHI_JK_LM_NO");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = macro_case_with_nums_as_word("");
        assert_eq!(result, "");
    }

    #[test]
    fn it_should_treat_number_sequence_as_word() {
        let result = macro_case_with_nums_as_word("abc123Def456#Ghi789");
        assert_eq!(result, "ABC_123_DEF_456_GHI_789");

        let result = macro_case_with_nums_as_word("ABC123-DEF456#GHI789");
        assert_eq!(result, "ABC_123_DEF_456_GHI_789");

        let result = macro_case_with_nums_as_word("abc123-def456#ghi789");
        assert_eq!(result, "ABC_123_DEF_456_GHI_789");

        let result = macro_case_with_nums_as_word("ABC123_DEF456#GHI789");
        assert_eq!(result, "ABC_123_DEF_456_GHI_789");

        let result = macro_case_with_nums_as_word("Abc123Def456#Ghi789");
        assert_eq!(result, "ABC_123_DEF_456_GHI_789");

        let result = macro_case_with_nums_as_word("abc123_def456#ghi789");
        assert_eq!(result, "ABC_123_DEF_456_GHI_789");

        let result = macro_case_with_nums_as_word("Abc123-Def456#-Ghi789");
        assert_eq!(result, "ABC_123_DEF_456_GHI_789");

        let result = macro_case_with_nums_as_word("000-abc123_def456#ghi789");
        assert_eq!(result, "000_ABC_123_DEF_456_GHI_789");
    }
}

#[cfg(test)]
mod tests_of_macro_case_with_sep {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = macro_case_with_sep("abcDefGHIjk", "-_");
        assert_eq!(result, "ABC_DEF_GH_IJK");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = macro_case_with_sep("AbcDefGHIjk", "-_");
        assert_eq!(result, "ABC_DEF_GH_IJK");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = macro_case_with_sep("abc-def-ghi", "-");
        assert_eq!(result, "ABC_DEF_GHI");

        let result = macro_case_with_sep("abc-def-ghi", "_");
        assert_eq!(result, "ABC-_DEF-_GHI");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = macro_case_with_sep("Abc-Def-Ghi", "-");
        assert_eq!(result, "ABC_DEF_GHI");

        let result = macro_case_with_sep("Abc-Def-Ghi", "_");
        assert_eq!(result, "ABC-_DEF-_GHI");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = macro_case_with_sep("ABC_DEF_GHI", "_");
        assert_eq!(result, "ABC_DEF_GHI");

        let result = macro_case_with_sep("ABC_DEF_GHI", "-");
        assert_eq!(result, "ABC__DEF__GHI");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = macro_case_with_sep("ABC-DEF-GHI", "-");
        assert_eq!(result, "ABC_DEF_GHI");

        let result = macro_case_with_sep("ABC-DEF-GHI", "_");
        assert_eq!(result, "ABC-_DEF-_GHI");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = macro_case_with_sep("abc123-456defG89HIJklMN12", "-");
        assert_eq!(result, "ABC123_456_DEF_G89_HI_JKL_MN12");

        let result = macro_case_with_sep("abc123-456defG89HIJklMN12", "_");
        assert_eq!(result, "ABC123-456_DEF_G89_HI_JKL_MN12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = macro_case_with_sep("123abc456def", "_");
        assert_eq!(result, "123_ABC456_DEF");

        let result = macro_case_with_sep("123ABC456DEF", "_");
        assert_eq!(result, "123_ABC456_DEF");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = macro_case_with_sep(":.abc~!@def#$ghi%&jk(lm)no/?", ":@$&()/");
        assert_eq!(result, "._ABC~!_DEF#_GHI%_JK_LM_NO_?");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = macro_case_with_sep("", "_-");
        assert_eq!(result, "");
    }
}

#[cfg(test)]
mod tests_of_macro_case_with_keep {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = macro_case_with_keep("abcDefGHIjk", "-_");
        assert_eq!(result, "ABC_DEF_GH_IJK");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = macro_case_with_keep("AbcDefGHIjk", "-_");
        assert_eq!(result, "ABC_DEF_GH_IJK");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = macro_case_with_keep("abc-def-ghi", "_");
        assert_eq!(result, "ABC_DEF_GHI");

        let result = macro_case_with_keep("abc-def-ghi", "-");
        assert_eq!(result, "ABC-_DEF-_GHI");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = macro_case_with_keep("Abc-Def-Ghi", "_");
        assert_eq!(result, "ABC_DEF_GHI");

        let result = macro_case_with_keep("Abc-Def-Ghi", "-");
        assert_eq!(result, "ABC-_DEF-_GHI");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = macro_case_with_keep("ABC_DEF_GHI", "-");
        assert_eq!(result, "ABC_DEF_GHI");

        let result = macro_case_with_keep("ABC_DEF_GHI", "_");
        assert_eq!(result, "ABC__DEF__GHI");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = macro_case_with_keep("ABC-DEF-GHI", "_");
        assert_eq!(result, "ABC_DEF_GHI");

        let result = macro_case_with_keep("ABC-DEF-GHI", "-");
        assert_eq!(result, "ABC-_DEF-_GHI");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = macro_case_with_keep("abc123-456defG89HIJklMN12", "_");
        assert_eq!(result, "ABC123_456_DEF_G89_HI_JKL_MN12");

        let result = macro_case_with_keep("abc123-456defG89HIJklMN12", "-");
        assert_eq!(result, "ABC123-456_DEF_G89_HI_JKL_MN12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = macro_case_with_keep("123abc456def", "_");
        assert_eq!(result, "123_ABC456_DEF");

        let result = macro_case_with_keep("123ABC456DEF", "_");
        assert_eq!(result, "123_ABC456_DEF");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = macro_case_with_keep(":.abc~!@def#$ghi%&jk(lm)no/?", ".~!#%?");
        assert_eq!(result, "._ABC~!_DEF#_GHI%_JK_LM_NO_?");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = macro_case_with_sep("", "_-");
        assert_eq!(result, "");
    }
}
