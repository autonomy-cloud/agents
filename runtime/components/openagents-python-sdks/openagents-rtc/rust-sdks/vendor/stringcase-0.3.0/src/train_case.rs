// Copyright (C) 2024 Takayuki Sato. All Rights Reserved.
// This program is free software under MIT License.
// See the file LICENSE in this distribution for more details.

/// Converts a string to train case.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is train case.
///
/// This function targets the upper and lower cases of ASCII alphabets for
/// capitalization, and all characters except ASCII alphabets and ASCII numbers
/// are replaced to hyphens as word separators.
///
/// ```rust
///     let train = stringcase::train_case("fooBar123Baz");
///     assert_eq!(train, "Foo-Bar123-Baz");
/// ```
pub fn train_case(input: &str) -> String {
    let mut result = String::with_capacity(input.len() * 2);
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
                    result.push(ch.to_ascii_lowercase());
                    flag = ChIs::NextOfContdUpper;
                }
                _ => {
                    result.push('-');
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
            }
        } else if ch.is_ascii_lowercase() {
            match flag {
                ChIs::FirstOfStr => {
                    result.push(ch.to_ascii_uppercase());
                }
                ChIs::NextOfContdUpper => match result.pop() {
                    Some(prev) => {
                        result.push('-');
                        result.push(prev.to_ascii_uppercase());
                        result.push(ch);
                    }
                    None => (), // impossible
                },
                ChIs::NextOfSepMark | ChIs::NextOfKeepedMark => {
                    result.push('-');
                    result.push(ch.to_ascii_uppercase());
                }
                _ => {
                    result.push(ch);
                }
            }
            flag = ChIs::Others;
        } else if ch.is_ascii_digit() {
            match flag {
                ChIs::NextOfSepMark => result.push('-'),
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

/// Converts a string to train case.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is train case.
///
/// This function targets the upper and lower cases of ASCII alphabets and ASCII numbers
/// for capitalization, and all characters except ASCII alphabets and ASCII numbers
/// are replaced to hyphens as word separators.
///
/// ```rust
///     let train = stringcase::train_case_with_nums_as_word("fooBar123Baz");
///     assert_eq!(train, "Foo-Bar-123-Baz");
/// ```
pub fn train_case_with_nums_as_word(input: &str) -> String {
    let mut result = String::with_capacity(input.len() * 2);
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
                    result.push(ch.to_ascii_lowercase());
                    flag = ChIs::NextOfContdUpper;
                }
                _ => {
                    result.push('-');
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
            }
        } else if ch.is_ascii_lowercase() {
            match flag {
                ChIs::FirstOfStr => {
                    result.push(ch.to_ascii_uppercase());
                }
                ChIs::NextOfContdUpper => match result.pop() {
                    Some(prev) => {
                        result.push('-');
                        result.push(prev.to_ascii_uppercase());
                        result.push(ch);
                    }
                    None => (), // impossible
                },
                ChIs::NextOfSepMark | ChIs::NextOfKeepedMark => {
                    result.push('-');
                    result.push(ch.to_ascii_uppercase());
                }
                _ => {
                    result.push(ch);
                }
            }
            flag = ChIs::Others;
        } else if ch.is_ascii_digit() {
            match flag {
                ChIs::FirstOfStr => (),
                ChIs::NextOfKeepedMark => (),
                _ => result.push('-'),
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

/// Converts a string to train case using the specified characters as
/// separators.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is train case.
///
/// This function targets only the upper and lower cases of ASCII alphabets for
/// capitalization, and the characters specified as the second argument of this
/// function are regarded as word separators and are replaced to hyphens.
///
/// ```rust
///     let train = stringcase::train_case_with_sep("foo-Bar100%Baz", "- ");
///     assert_eq!(train, "Foo-Bar100%-Baz");
/// ```
pub fn train_case_with_sep(input: &str, seps: &str) -> String {
    let mut result = String::with_capacity(input.len() * 2);
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
                    result.push(ch.to_ascii_lowercase());
                    flag = ChIs::NextOfContdUpper;
                }
                _ => {
                    result.push('-');
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
            }
        } else if ch.is_ascii_lowercase() {
            match flag {
                ChIs::FirstOfStr => {
                    result.push(ch.to_ascii_uppercase());
                }
                ChIs::NextOfContdUpper => match result.pop() {
                    Some(prev) => {
                        result.push('-');
                        result.push(prev.to_ascii_uppercase());
                        result.push(ch);
                    }
                    None => (), // impossible
                },
                ChIs::NextOfSepMark | ChIs::NextOfKeepedMark => {
                    result.push('-');
                    result.push(ch.to_ascii_uppercase());
                }
                _ => {
                    result.push(ch);
                }
            }
            flag = ChIs::Others;
        } else {
            match flag {
                ChIs::NextOfSepMark => result.push('-'),
                _ => (),
            }
            result.push(ch);
            flag = ChIs::NextOfKeepedMark;
        }
    }

    result
}

/// Converts a string to train case using characters other than the specified
/// characters as separators.
///
/// This function takes a string slice as its argument, then returns a `String`
/// of which the case style is train case.
///
/// This function targets only the upper and lower cases of ASCII alphabets for
/// capitalization, and the characters other than the specified characters as
/// the second argument of this function are regarded as word separators and
/// are replaced to hyphens.
///
/// ```rust
///     let train = stringcase::train_case_with_keep("foo-bar100%baz", "%");
///     assert_eq!(train, "Foo-Bar100%-Baz");
/// ```
pub fn train_case_with_keep(input: &str, keeped: &str) -> String {
    let mut result = String::with_capacity(input.len() * 2);
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
                    result.push(ch.to_ascii_lowercase());
                    flag = ChIs::NextOfContdUpper;
                }
                _ => {
                    result.push('-');
                    result.push(ch);
                    flag = ChIs::NextOfUpper;
                }
            }
        } else if ch.is_ascii_lowercase() {
            match flag {
                ChIs::FirstOfStr => {
                    result.push(ch.to_ascii_uppercase());
                }
                ChIs::NextOfContdUpper => match result.pop() {
                    Some(prev) => {
                        result.push('-');
                        result.push(prev.to_ascii_uppercase());
                        result.push(ch);
                    }
                    None => (), // impossible
                },
                ChIs::NextOfSepMark | ChIs::NextOfKeepedMark => {
                    result.push('-');
                    result.push(ch.to_ascii_uppercase());
                }
                _ => {
                    result.push(ch);
                }
            }
            flag = ChIs::Others;
        } else if ch.is_ascii_digit() || keeped.contains(ch) {
            match flag {
                ChIs::NextOfSepMark => result.push('-'),
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
mod tests_of_train_case {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = train_case("abcDefGHIjk");
        assert_eq!(result, "Abc-Def-Gh-Ijk");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = train_case("AbcDefGHIjk");
        assert_eq!(result, "Abc-Def-Gh-Ijk");
    }

    #[test]
    fn it_should_convert_snake_case() {
        let result = train_case("abc_def_ghi");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = train_case("abc-def-ghi");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = train_case("Abc-Def-Ghi");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = train_case("ABC_DEF_GHI");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = train_case("ABC-DEF-GHI");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = train_case("abc123-456defG789HIJklMN12");
        assert_eq!(result, "Abc123-456-Def-G789-Hi-Jkl-Mn12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = train_case("123abc456def");
        assert_eq!(result, "123-Abc456-Def");

        let result = train_case("123ABC456DEF");
        assert_eq!(result, "123-Abc456-Def");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = train_case(":.abc~!@def#$ghi%&jk(lm)no/?");
        assert_eq!(result, "Abc-Def-Ghi-Jk-Lm-No");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = train_case("");
        assert_eq!(result, "");
    }

    #[test]
    fn it_should_treat_number_sequence_by_default() {
        let result = train_case("abc123Def456#Ghi789");
        assert_eq!(result, "Abc123-Def456-Ghi789");

        let result = train_case("ABC123-DEF456#GHI789");
        assert_eq!(result, "Abc123-Def456-Ghi789");

        let result = train_case("abc123-def456#ghi789");
        assert_eq!(result, "Abc123-Def456-Ghi789");

        let result = train_case("ABC123_DEF456#GHI789");
        assert_eq!(result, "Abc123-Def456-Ghi789");

        let result = train_case("Abc123Def456#Ghi789");
        assert_eq!(result, "Abc123-Def456-Ghi789");

        let result = train_case("abc123_def456#ghi789");
        assert_eq!(result, "Abc123-Def456-Ghi789");

        let result = train_case("Abc123-Def456#-Ghi789");
        assert_eq!(result, "Abc123-Def456-Ghi789");

        let result = train_case("000-abc123_def456#ghi789");
        assert_eq!(result, "000-Abc123-Def456-Ghi789");
    }
}

#[cfg(test)]
mod tests_of_train_case_with_nums_as_word {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = train_case_with_nums_as_word("abcDefGHIjk");
        assert_eq!(result, "Abc-Def-Gh-Ijk");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = train_case_with_nums_as_word("AbcDefGHIjk");
        assert_eq!(result, "Abc-Def-Gh-Ijk");
    }

    #[test]
    fn it_should_convert_snake_case() {
        let result = train_case_with_nums_as_word("abc_def_ghi");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = train_case_with_nums_as_word("abc-def-ghi");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = train_case_with_nums_as_word("Abc-Def-Ghi");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = train_case_with_nums_as_word("ABC_DEF_GHI");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = train_case_with_nums_as_word("ABC-DEF-GHI");
        assert_eq!(result, "Abc-Def-Ghi");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = train_case_with_nums_as_word("abc123-456defG789HIJklMN12");
        assert_eq!(result, "Abc-123-456-Def-G-789-Hi-Jkl-Mn-12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = train_case_with_nums_as_word("123abc456def");
        assert_eq!(result, "123-Abc-456-Def");

        let result = train_case_with_nums_as_word("123ABC456DEF");
        assert_eq!(result, "123-Abc-456-Def");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = train_case_with_nums_as_word(":.abc~!@def#$ghi%&jk(lm)no/?");
        assert_eq!(result, "Abc-Def-Ghi-Jk-Lm-No");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = train_case_with_nums_as_word("");
        assert_eq!(result, "");
    }

    #[test]
    fn it_should_treat_number_sequence_as_word() {
        let result = train_case_with_nums_as_word("abc123Def456#Ghi789");
        assert_eq!(result, "Abc-123-Def-456-Ghi-789");

        let result = train_case_with_nums_as_word("ABC123-DEF456#GHI789");
        assert_eq!(result, "Abc-123-Def-456-Ghi-789");

        let result = train_case_with_nums_as_word("abc123-def456#ghi789");
        assert_eq!(result, "Abc-123-Def-456-Ghi-789");

        let result = train_case_with_nums_as_word("ABC123_DEF456#GHI789");
        assert_eq!(result, "Abc-123-Def-456-Ghi-789");

        let result = train_case_with_nums_as_word("Abc123Def456#Ghi789");
        assert_eq!(result, "Abc-123-Def-456-Ghi-789");

        let result = train_case_with_nums_as_word("abc123_def456#ghi789");
        assert_eq!(result, "Abc-123-Def-456-Ghi-789");

        let result = train_case_with_nums_as_word("Abc123-Def456#-Ghi789");
        assert_eq!(result, "Abc-123-Def-456-Ghi-789");

        let result = train_case_with_nums_as_word("000-abc123_def456#ghi789");
        assert_eq!(result, "000-Abc-123-Def-456-Ghi-789");
    }
}

#[cfg(test)]
mod tests_of_train_case_with_sep {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = train_case_with_sep("abcDefGHIjk", "-_");
        assert_eq!(result, "Abc-Def-Gh-Ijk");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = train_case_with_sep("AbcDefGHIjk", "-_");
        assert_eq!(result, "Abc-Def-Gh-Ijk");
    }

    #[test]
    fn it_should_convert_snake_case() {
        let result = train_case_with_sep("abc_def_ghi", "_");
        assert_eq!(result, "Abc-Def-Ghi");

        let result = train_case_with_sep("abc_def_ghi", "-");
        assert_eq!(result, "Abc_-Def_-Ghi");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = train_case_with_sep("abc-def-ghi", "-");
        assert_eq!(result, "Abc-Def-Ghi");

        let result = train_case_with_sep("abc-def-ghi", "_");
        assert_eq!(result, "Abc--Def--Ghi");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = train_case_with_sep("Abc-Def-Ghi", "-");
        assert_eq!(result, "Abc-Def-Ghi");

        let result = train_case_with_sep("Abc-Def-Ghi", "_");
        assert_eq!(result, "Abc--Def--Ghi");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = train_case_with_sep("ABC_DEF_GHI", "_");
        assert_eq!(result, "Abc-Def-Ghi");

        let result = train_case_with_sep("ABC_DEF_GHI", "-");
        assert_eq!(result, "Abc_-Def_-Ghi");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = train_case_with_sep("ABC-DEF-GHI", "-");
        assert_eq!(result, "Abc-Def-Ghi");

        let result = train_case_with_sep("ABC-DEF-GHI", "_");
        assert_eq!(result, "Abc--Def--Ghi");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = train_case_with_sep("abc123-456defG789HIJklMN12", "-");
        assert_eq!(result, "Abc123-456-Def-G789-Hi-Jkl-Mn12");

        let result = train_case_with_sep("abc123-456defG789HIJklMN12", "_");
        assert_eq!(result, "Abc123-456-Def-G789-Hi-Jkl-Mn12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = train_case_with_sep("123abc456def", "-");
        assert_eq!(result, "123-Abc456-Def");

        let result = train_case_with_keep("123ABC456DEF", "_");
        assert_eq!(result, "123-Abc456-Def");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = train_case_with_sep(":.abc~!@def#$ghi%&jk(lm)no/?", ":@$&()/");
        assert_eq!(result, ".-Abc~!-Def#-Ghi%-Jk-Lm-No-?");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = train_case_with_sep("", "-_");
        assert_eq!(result, "");
    }
}

#[cfg(test)]
mod tests_of_train_case_with_keep {
    use super::*;

    #[test]
    fn it_should_convert_camel_case() {
        let result = train_case_with_keep("abcDefGHIjk", "-_");
        assert_eq!(result, "Abc-Def-Gh-Ijk");
    }

    #[test]
    fn it_should_convert_pascal_case() {
        let result = train_case_with_keep("AbcDefGHIjk", "-_");
        assert_eq!(result, "Abc-Def-Gh-Ijk");
    }

    #[test]
    fn it_should_convert_snake_case() {
        let result = train_case_with_keep("abc_def_ghi", "-");
        assert_eq!(result, "Abc-Def-Ghi");

        let result = train_case_with_keep("abc_def_ghi", "_");
        assert_eq!(result, "Abc_-Def_-Ghi");
    }

    #[test]
    fn it_should_convert_kebab_case() {
        let result = train_case_with_keep("abc-def-ghi", "_");
        assert_eq!(result, "Abc-Def-Ghi");

        let result = train_case_with_keep("abc-def-ghi", "-");
        assert_eq!(result, "Abc--Def--Ghi");
    }

    #[test]
    fn it_should_convert_train_case() {
        let result = train_case_with_keep("Abc-Def-Ghi", "_");
        assert_eq!(result, "Abc-Def-Ghi");

        let result = train_case_with_keep("Abc-Def-Ghi", "-");
        assert_eq!(result, "Abc--Def--Ghi");
    }

    #[test]
    fn it_should_convert_macro_case() {
        let result = train_case_with_keep("ABC_DEF_GHI", "-");
        assert_eq!(result, "Abc-Def-Ghi");

        let result = train_case_with_keep("ABC_DEF_GHI", "_");
        assert_eq!(result, "Abc_-Def_-Ghi");
    }

    #[test]
    fn it_should_convert_cobol_case() {
        let result = train_case_with_keep("ABC-DEF-GHI", "_");
        assert_eq!(result, "Abc-Def-Ghi");

        let result = train_case_with_keep("ABC-DEF-GHI", "-");
        assert_eq!(result, "Abc--Def--Ghi");
    }

    #[test]
    fn it_should_keep_digits() {
        let result = train_case_with_keep("abc123-456defG789HIJklMN12", "_");
        assert_eq!(result, "Abc123-456-Def-G789-Hi-Jkl-Mn12");

        let result = train_case_with_keep("abc123-456defG789HIJklMN12", "-");
        assert_eq!(result, "Abc123-456-Def-G789-Hi-Jkl-Mn12");
    }

    #[test]
    fn it_should_convert_when_starting_with_digit() {
        let result = train_case_with_keep("123abc456def", "-");
        assert_eq!(result, "123-Abc456-Def");

        let result = train_case_with_keep("123ABC456DEF", "_");
        assert_eq!(result, "123-Abc456-Def");
    }

    #[test]
    fn it_should_treat_marks_as_separators() {
        let result = train_case_with_keep(":.abc~!@def#$ghi%&jk(lm)no/?", ".~!#%?");
        assert_eq!(result, ".-Abc~!-Def#-Ghi%-Jk-Lm-No-?");
    }

    #[test]
    fn it_should_convert_empty() {
        let result = train_case_with_keep("", "-_");
        assert_eq!(result, "");
    }
}
