---
title: "Pretty Lambdas in Python"
publishDate: 2025-02-19T00:00:00-05:00
---

Of the many paradigms formally introduced to me during my time at university, I have found none as consequential as functional programming. Since being dropped headfirst in to [Racket](https://racket-lang.org/) all those years ago, my understanding of programming has forever changed, and so have my tastes.

As I spend more and more time writing Python, I find myself increasingly annoyed with the `lambda` keyword. In already long lines of code, `lambda` both consumes tons of precious horizontal space, as well as increases cognitive load -- I find myself longing for a particular piece of syntactic sugar: the unicode lambda. In Racket, λ is a synonym for the `lambda` keyword, and is used to define anonymous functions. Under the hood, the unicode character and lambda keyword are equivalent, both parsing to the same thing. Could there be any way to achieve the same in Python?

My first, naive thought is to just alias the it and call it a day. As it turns out, just like `if` and `else`, `lambda` is a keyword in Python, so it cannot be aliased using assignment.

```python
# Valid type aliasing, as the right side is an expression
Vector = list[float] 

# These fail, as the right side is a keyword
otherwise = else
λ = lambda
```

The only way then to get the unicode lambda recognized as a keyword, it would seem, is to either add a preprocessor or fork the interpreter. These are both non-starters, as I have no interest in an additional build step, nor maintaining a fork of Python, nor distributing either alongside my code.

What's the next best thing? A VSCode extension! Visually subsituting `lambda` with λ achieves aesthetics without compromising on code portability. I had never written a VSCode extension before, so I took this as an opportunity to learn.

## The Extension

First, I located the API needed in order to visually replace text in the editor: It quickly became clear that using the decorator API would be the way to go. Thankfully, Microsoft has a readily available [reference implementation](https://github.com/microsoft/vscode-extension-samples/tree/main/decorator-sample), which clearly demonstrates how to apply CSS styles to specific words in the editor. My thinking, then, was to use the CSS `content` property to replace `lambda` with λ.

Following the [official guide](https://code.visualstudio.com/api/get-started/your-first-extension) to get started, I used the Yeoman generator to scaffold a new TypeScript project, a language I am familiar with and rather fond of (compared to vanilla JS, at least). The meat of the extension, then, is in finding the `lambda` keyword in the editor and applying the CSS.

> Much like Microsoft's example, I use regex to search the text. Without some language server magic, there is no way to differentiate syntax from comments, but for now this is good enough. In the future, I will update the extension and this blog post to remove this limitation.

The primary functionality resides in the `activate` function, which is called when the extension is loaded. Firstly, a new `TextEditorDecorationType` is created, which specifies the CSS to apply to the `lambda` keyword.

```typescript
const lambdaDecorationType = vscode.window.createTextEditorDecorationType({
    before: {
        contentText: 'λ',
    },
    textDecoration: 'none; display: none;',
});
```

To actually apply the styles, I have a helper function `updateDecorations`, which is hooked up to callbacks for when the editor is opened and when the text is changed. Its functionality can be distilled into the following:

```typescript
async function updateDecorations(editor: vscode.TextEditor) {
    const text = editor.document.getText();
    const lambdaRegex = /\blambda\b/g;
    const lambdaMatches: vscode.DecorationOptions[] = [];

    let match;

    // Find matches of lambda keyword
    while ((match = lambdaRegex.exec(text))) {
        const startPos = editor.document.positionAt(match.index);
        const endPos = editor.document.positionAt(match.index + match[0].length);
        const decoration = { range: new vscode.Range(startPos, endPos) };
        lambdaMatches.push(decoration);
    }

    editor.setDecorations(lambdaDecorationType, filteredMatches);
}
```

This works well enough, however the text cursor become invisible when moving through where the `lambda` keyword used to appear, making editing unclear.

<video autoplay loop muted playsinline>
    <source src="/prettylambdas/hidden_cursor.mp4" type="video/mp4">
</video>

To fix this, I decided it made sense to just drop the styles when the cursor is on top of a `lambda` keyword. This was relatively simple enough, just by filtering matches based on the ranges within `editor.selections` before calling `setDecorations`:

```typescript
const selections = editor.selections;
const filteredMatches = lambdaMatches.filter((match) =>
    !selections.some((selection) => match.range.contains(selection))
);
```

And, voila! Now, `lambda` is automagically replaced with λ in the editor, without compromising on editibility or portability.

<video autoplay loop muted playsinline>
    <source src="/prettylambdas/fixed_hidden_cursor.mp4" type="video/mp4">
</video>

I thought it might be nice to write some sort of unit tests, but after doing some digging, it seems technically impossible to test the effects of `setDecorators`! Rather, because Microsoft internally tests its effects, they have not publicly exposed the API to test it, [advocating that you should instead write a mock](https://github.com/microsoft/vscode/issues/136164#issuecomment-956027228) and test that instead. Seeing as the extension is relatively simple, I decided to forgo this journey, although when I enhance the extension down the line, I will revisit this.

The code is available [here](https://github.com/wlenig/pretty-lambdas), and maybe in the future I will publish it to the marketplace.