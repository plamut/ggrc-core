# CSS and HTML Guidelines

Based and borrowed from [CSS Guidelines](http://cssguidelin.es/)


### Syntax and formatting

- two space indents, no tabs
- 80 character wide columns
- multi-line CSS
- meaningful use of whitespace

## CSS

### Anathomy of a selector

Selectors should be writen across multiple lines

```
[selector] {
    [property]: [value];
    [<--declaration--->]
}
```
- related selectors on the same line
- unrelated selectors on new lines
- a space before our opening brace `{`
- properties and values on the same line
- a space after our property–value delimiting colon `:`
- each declaration on its own new line
- the opening brace `{` on the same line as our last selector
- our first declaration on a new line after our opening brace `{`
- our closing brace `}` on its own new line
- each declaration indented by two spaces
- a trailing semi-colon `;` on our last declaration

Exception, single line selector would be in case e.g.

```
.icon {
    display: inline-block;
    width:  16px;
    height: 16px;
    background-image: url(/img/sprite.svg);
}

.icon--home     { background-position:   0     0  ; }
.icon--person   { background-position: -16px   0  ; }
.icon--files    { background-position:   0   -16px; }
.icon--settings { background-position: -16px -16px; }
```

### Indentations

Nesting in SASS should be avoided wherever possible. This is [WHY](http://cssguidelin.es/#specificity)


### Naming

For naming we are using [BEM](https://en.bem.info/method/) medotology. BEM stands for:

- Block: The sole root of the component.
- Element: A component part of the Block.
- Modifier: A variant or extension of the Block

You can learn more about it [here](https://en.bem.info/method/definitions/) 

A good naming convention will tell you and your team:

- what type of thing a class does
- where a class can be used
- what (else) a class might be related to


### `data-*` Attributes

A common practice is to use data-* attributes as JS hooks, but this is incorrect. data-* attributes, as per the spec, are used to store custom data private to the page or application (emphasis mine). data-* attributes are designed to store data, not be bound to.


## File structure

### Partials
Every component should have it's own partial

## HTML
