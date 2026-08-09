// Copyright (C) 2024 Takayuki Sato. All Rights Reserved.
// This program is free software under MIT License.
// See the file LICENSE in this distribution for more details.

/// Converts a string to snake case.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is snake case.
///
/// This function targets the upper and lower cases of ASCII alphabets for
/// capitalization, and all characters except ASCII alphabets and ASCII numbers
/// are replaced to underscores as word separators.
///
/// ```rust
///     let snake = stringcase::snake_case("fooBar123Baz");
///     assert_eq!(snake, "foo_bar123_baz");
/// ```
pub fn snake_case(input: &str) -> String {
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
                    result.push(ch.to_ascii_lowercase());
                    flag = ChIs::NextOfUpper;
                }
                ChIs::NextOfUpper | ChIs::NextOfContdUpper => {
                    result.push(ch.to_ascii_lowercase());
                    flag = ChIs::NextOfContdUpper;
                }
                _ => {
                    result.push('_');
                    result.push(ch.to_ascii_lowercase());
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
            result.push(ch);
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

/// Converts a string to snake case.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is snake case.
///
/// This function targets the upper and lower cases of ASCII alphabets and ASCII numbers
/// for capitalization, and all characters except ASCII alphabets and ASCII numbers
/// are replaced to underscores as word separators.
///
/// ```rust
///     let snake = stringcase::snake_case_with_nums_as_word("fooBar123Baz");
///     assert_eq!(snake, "foo_bar_123_baz");
/// ```
pub fn snake_case_with_nums_as_word(input: &str) -> String {
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
                    result.push(ch.to_ascii_lowercase());
                    flag = ChIs::NextOfUpper;
                }
                ChIs::NextOfUpper | ChIs::NextOfContdUpper => {
                    result.push(ch.to_ascii_lowercase());
                    flag = ChIs::NextOfContdUpper;
                }
                _ => {
                    result.push('_');
                    result.push(ch.to_ascii_lowercase());
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
            result.push(ch);
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

/// Converts a string to snake case using the specified characters as
/// separators.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is snake case.
///
/// This function targets only the upper and lower cases of ASCII alphabets for
/// capitalization, and the characters specified as the second argument of this
/// function are regarded as word separators and are replaced to underscores.
///
/// ```rust
///     let snake = stringcase::snake_case_with_sep("foo-Bar100%Baz", "- ");
///     assert_eq!(snake, "foo_bar100%_baz");
/// ```
pub fn snake_case_with_sep(input: &str, seps: &str) -> String {
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
                    result.push(ch.to_ascii_lowercase());
                    flag = ChIs::NextOfUpper;
                }
                ChIs::NextOfUpper | ChIs::NextOfContdUpper => {
                    result.push(ch.to_ascii_lowercase());
                    flag = ChIs::NextOfContdUpper;
                }
                _ => {
                    result.push('_');
                    result.push(ch.to_ascii_lowercase());
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
            result.push(ch);
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

/// Converts a string to snake case using characters other than the specified
/// characters as separators.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is snake case.
///
/// This function targets only the upper and lower cases of ASCII alphabets for
/// capitalization, and the characters other than the specified characters as
/// the second argument of this function are regarded as word separators and
/// are replaced to underscores.
///
/// ```rust
///     let snake = stringcase::snake_case_with_keep("foo-bar100%baz", "%");
///     assert_eq!(snake, "foo_bar100%_baz");
/// ```
pub fn snake_case_with_keep(input: &str, keeped: &str) -> String {
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
                    result.push(ch.to_ascii_lowercase());
                    flag = ChIs::NextOfUpper;
                }
                ChIs::NextOfUpper | ChIs::NextOfContdUpper => {
                    result.push(ch.to_ascii_lowercase());
                    flag = ChIs::NextOfContdUpper;
                }
                _ => {
                    result.push('_');
                    result.push(ch.to_ascii_lowercase());
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
            result.push(ch);
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
mod tests_of_snake_case {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = snake_case("abcDefGHIjk");
        assert_eq!(result, "abc_def_gh_ijk");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = snake_case("AbcDefGHIjk");
        assert_eq!(result, "abc_def_gh_ijk");
    }

    #[test]
    fn it_should_convert_snake_case() {
        let result = snake_case("abc_def_ghi");
        assert_eq!(result, "abc_def_ghi");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = snake_case("abc-def-ghi");
        assert_eq!(result, "abc_def_ghi");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = snake_case("Abc-Def-Ghi");
        assert_eq!(result, "abc_def_ghi");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = snake_case("ABC_DEF_GHI");
        assert_eq!(result, "abc_def_ghi");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = snake_case("ABC-DEF-GHI");
        assert_eq!(result, "abc_def_ghi");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = snake_case("abc123-456defG789HIJklMN12");
        assert_eq!(result, "abc123_456_def_g789_hi_jkl_mn12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = snake_case("123abc456def");
        assert_eq!(result, "123_abc456_def");

        let result = snake_case("123ABC456DEF");
        assert_eq!(result, "123_abc456_def");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = snake_case(":.abc~!@def#$ghi%&jk(lm)no/?");
        assert_eq!(result, "abc_def_ghi_jk_lm_no");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = snake_case("");
        assert_eq!(result, "");
    }
}

#[cfg(test)]
mod tests_of_snake_case_with_nums_as_word {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = snake_case_with_nums_as_word("abcDefGHIjk");
        assert_eq!(result, "abc_def_gh_ijk");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = snake_case_with_nums_as_word("AbcDefGHIjk");
        assert_eq!(result, "abc_def_gh_ijk");
    }

    #[test]
    fn it_should_convert_snake_case() {
        let result = snake_case_with_nums_as_word("abc_def_ghi");
        assert_eq!(result, "abc_def_ghi");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = snake_case_with_nums_as_word("abc-def-ghi");
        assert_eq!(result, "abc_def_ghi");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = snake_case_with_nums_as_word("Abc-Def-Ghi");
        assert_eq!(result, "abc_def_ghi");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = snake_case_with_nums_as_word("ABC_DEF_GHI");
        assert_eq!(result, "abc_def_ghi");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = snake_case_with_nums_as_word("ABC-DEF-GHI");
        assert_eq!(result, "abc_def_ghi");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = snake_case_with_nums_as_word("abc123-456defG789HIJklMN12");
        assert_eq!(result, "abc_123_456_def_g_789_hi_jkl_mn_12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = snake_case_with_nums_as_word("123abc456def");
        assert_eq!(result, "123_abc_456_def");

        let result = snake_case_with_nums_as_word("123ABC456DEF");
        assert_eq!(result, "123_abc_456_def");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = snake_case_with_nums_as_word(":.abc~!@def#$ghi%&jk(lm)no/?");
        assert_eq!(result, "abc_def_ghi_jk_lm_no");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = snake_case_with_nums_as_word("");
        assert_eq!(result, "");
    }
}

#[cfg(test)]
mod tests_of_snake_case_with_sep {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = snake_case_with_sep("abcDefGHIjk", "-_");
        assert_eq!(result, "abc_def_gh_ijk");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = snake_case_with_sep("AbcDefGHIjk", "-_");
        assert_eq!(result, "abc_def_gh_ijk");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = snake_case_with_sep("abc-def-ghi", "-");
        assert_eq!(result, "abc_def_ghi");

        let result = snake_case_with_sep("abc-def-ghi", "_");
        assert_eq!(result, "abc-_def-_ghi");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = snake_case_with_sep("Abc-Def-Ghi", "-");
        assert_eq!(result, "abc_def_ghi");

        let result = snake_case_with_sep("Abc-Def-Ghi", "_");
        assert_eq!(result, "abc-_def-_ghi");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = snake_case_with_sep("ABC_DEF_GHI", "_");
        assert_eq!(result, "abc_def_ghi");

        let result = snake_case_with_sep("ABC_DEF_GHI", "-");
        assert_eq!(result, "abc__def__ghi");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = snake_case_with_sep("ABC-DEF-GHI", "-");
        assert_eq!(result, "abc_def_ghi");

        let result = snake_case_with_sep("ABC-DEF-GHI", "_");
        assert_eq!(result, "abc-_def-_ghi");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = snake_case_with_sep("abc123-456defG789HIJklMN12", "-");
        assert_eq!(result, "abc123_456_def_g789_hi_jkl_mn12");

        let result = snake_case_with_sep("abc123-456defG789HIJklMN12", "_");
        assert_eq!(result, "abc123-456_def_g789_hi_jkl_mn12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = snake_case_with_sep("123abc456def", "-");
        assert_eq!(result, "123_abc456_def");

        let result = snake_case_with_sep("123ABC456DEF", "_");
        assert_eq!(result, "123_abc456_def");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = snake_case_with_sep(":.abc~!@def#$ghi%&jk(lm)no/?", ":@$&()/");
        assert_eq!(result, "._abc~!_def#_ghi%_jk_lm_no_?");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = snake_case_with_sep("", "_-");
        assert_eq!(result, "");
    }
}

#[cfg(test)]
mod tests_of_snake_case_with_keep {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = snake_case_with_keep("abcDefGHIjk", "-_");
        assert_eq!(result, "abc_def_gh_ijk");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = snake_case_with_keep("AbcDefGHIjk", "-_");
        assert_eq!(result, "abc_def_gh_ijk");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = snake_case_with_keep("abc-def-ghi", "_");
        assert_eq!(result, "abc_def_ghi");

        let result = snake_case_with_keep("abc-def-ghi", "-");
        assert_eq!(result, "abc-_def-_ghi");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = snake_case_with_keep("Abc-Def-Ghi", "_");
        assert_eq!(result, "abc_def_ghi");

        let result = snake_case_with_keep("Abc-Def-Ghi", "-");
        assert_eq!(result, "abc-_def-_ghi");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = snake_case_with_keep("ABC_DEF_GHI", "-");
        assert_eq!(result, "abc_def_ghi");

        let result = snake_case_with_keep("ABC_DEF_GHI", "_");
        assert_eq!(result, "abc__def__ghi");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = snake_case_with_keep("ABC-DEF-GHI", "_");
        assert_eq!(result, "abc_def_ghi");

        let result = snake_case_with_keep("ABC-DEF-GHI", "-");
        assert_eq!(result, "abc-_def-_ghi");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = snake_case_with_keep("abc123-456defG789HIJklMN12", "_");
        assert_eq!(result, "abc123_456_def_g789_hi_jkl_mn12");

        let result = snake_case_with_keep("abc123-456defG789HIJklMN12", "-");
        assert_eq!(result, "abc123-456_def_g789_hi_jkl_mn12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = snake_case_with_keep("123abc456def", "-");
        assert_eq!(result, "123_abc456_def");

        let result = snake_case_with_keep("123ABC456DEF", "_");
        assert_eq!(result, "123_abc456_def");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = snake_case_with_keep(":.abc~!@def#$ghi%&jk(lm)no/?", ".~!#%?");
        assert_eq!(result, "._abc~!_def#_ghi%_jk_lm_no_?");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = snake_case_with_sep("", "_-");
        assert_eq!(result, "");
    }
}
