# Tome
An extensible, dependency-free rich text editor.

In progress..

#### Todos

- ~~~Ensure active markups are always accurate on set selection~~~
- ~~~Add line-break functionality~~~
- Add whitespace trimming/collapsing via configuration
- ~~~remove collapsed inline markup cruft when changing selection (see toggle inline todo)~~~
- ~~~Increase plain text block break to two newline chars~~~
- ~~~Add push/replace state functionality to ensure history is logical~~~
- ~~~Basic clipboard sanitization~~~
- ~~~Create facade and public API~~~
- ~~~Move all history related actions out of `Tome` and into to a new state manager class~~~
- lists?
- additional IME mutation detection work
- bug when changing a block type to its own type

BUGS
 - when changing a block type to its own type
 - when inserting characters after a line break in a list item that's been reselected

---
*&copy; 2017 Patrick Kunka / KunkaLabs Ltd*
