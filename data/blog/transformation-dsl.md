---
title: "Implementing a Glom-like Data Transformation DSL"
publishDate: 2025-03-10T00:00:00-05:00
description: "Rolling my own domain-specific language in Python for data transformation"
---

In the data-processing pipeline I'm working on, transformations are typically remapping data from one schema to another, with a little additional logic thrown in. Typically, I'd use [`glom`](https://glom.readthedocs.io/en/latest/) for this, a great library for transforming data structures in Python.

`glom` is used by defining a specification that describes how to access then optionally transform the data, then applying the spec to the target dictionary using the `glom` function. As it's somewhat of a data transformation swiss army knife, it is difficult to succintly and completely describe its functionality, but the following examples demonstrate its principal use:

```python
>>> from glom import glom, T
>>> 
>>> data = {
>>>     'name': {
>>>         'first': 'John',
>>>         'last': 'Doe'
>>>     }
>>> }
>>> 
>>> spec = ('name.first', str.upper)
>>> glom(data, spec)
'JOHN'
```

`glom` can also be used to transform multiple values at once, using the key-value pairs as key-specification pairs:

```python
>>> spec = {
>>>     'first_name': ('name.first', str.lower),
>>>     'last_name': 'name.last',
>>>     'dummy': lambda _: 'foo'
>>> }
>>> glom(data, spec)
{'first_name': 'john', 'last_name': 'Doe', 'dummy': 'foo'}
```

Take a slightly more complex example, where we want to combine the first first and last names into a single string. To do so, we must use `T`, a special object that allows us to access the target dictionary declaratively. Notice that we sacrifice the one of `glom`'s greatest niceties, dot-notation, to access values:

```python
T['name']['first'] + ' ' + T['name']['last'],
```

In my own use, `glom`'s coup de grâce came while I was trying to collect a list of values from within a target dictionary. Using the name example: I had hoped a spec like the following would be possible:

```python
['name.first', 'name.last']
```

However, `glom` doesn't support this out of the box, and the closest I could get was to use a lambda function and access the values, almost as if `glom` didn't exist:

```python
lambda data: [data['name']['first'], data['name']['last']]
```

Alternatively, I could use `glom` within the lambda function like so:

```python
lambda data: [glom(data, 'name.first'), glom(data, 'name.last')]
```
> Note that that you could also make the lambda parameter-less and instead pass `T` into `glom`, although I find that less illustrative.


A bit redundant, and ugly, but it works. At this point I had spent enough time pain-stakingly navigating the documentation looking for functionality that I was sure was there, but wasn't, that I decided to roll my own. Plus, `glom` was too heavy of a dependency for my use, and I would make no use of what is essentially a [query language](https://glom.readthedocs.io/en/latest/tutorial.html#going-beyond-access) on top of its data transformation capabilities.

## Rolling a Glom-like

I love the simple syntax demonstrated by the first example, and wanted to keep that for my implementation. I also wanted to enhance it with the ability to use a list of values, like the last hypothetical example above.

I began by strictly defining what a specification is:
- A string, the dot-notation path to the value
- A callable, applied to the target
- A tuple of specifications, applied in order to the result of the previous step
- A list of specifications, evaluated to a list of evaluation results
- A dictionary, where the keys are keys in the resulting dictionary, and the values are specifications
> By using a recursive type definition, a specification both captures the accessing and transformation of data, while also allowing for the specification to be nested, enabling the common use case of resolving to a dictionary.

In the form of a python type hint, this looks like:

```python
Spec = str \
    | Callable[..., any] \
    | tuple['Spec', ...] \
    | list['Spec'] \
    | dict[any, 'Spec'] \
```
> Python 3.10+ union types with the `|` operator are so nice, they look like a grammar definition!

Then, I began implementing the whole thing. Getting values from a dictionary using dot-notation was a simple enough exercise:

```python
def get_value_at(record: dict, address: str) -> any:
    # Gets the value at the specified dot-notation address
    steps = address.split('.')
    result = record
    for step in steps:
        if step not in result:
            raise ValueError(f'Field not in record: ({step}) {address}')
        result = result.get(step)
    return result
```

With that out of the way, I wrote a definitional interpreter. It is a simple recursive function that takes the record and the specification, and returns the transformed value. I am pleased with its overall simplicity:

```python
def interpret_mapping(record: dict, spec: Spec) -> dict:
    # Handle dot-notation for nested fields
    if isinstance(spec, str):
            raise TypeError(f'Record must be a dict')
        return get_value_at(record, spec)
    
    # Handle callable
    elif callable(spec):
        return spec(record)
    
    # Handle tuple of form (Spec...) by applying each in order
    elif isinstance(spec, tuple):
        result = record
        for s in spec:
            result = interpret_mapping(result, s)
        return result
    
    # Map a list of specs to their results
    elif isinstance(spec, list):
        return [interpret_mapping(record, s) for s in spec]
    
    # Handle dict of form {key: Spec}
    elif isinstance(spec, dict):
        return {
            key: interpret_mapping(record, value)
            for key, value in spec.items()
        }
    
    # error out
    raise ValueError(f'Invalid spec: {spec}')

# alias it for now
apply_mapping = interpret_mapping
```

Note that inside the string specification case we check that record is a dictionary, since specifications can be chained using tuples, and we cannot guarantee anything about the result of the previous step.

And with that, I had a simple DSL for transforming data! I can now use it like so:

```python
>>> spec = {
>>>     'names': ['name.first', ('name', 'last')],
>>>     'full_name': (
>>>         ['name.first', 'name.last'], 
>>>         lambda xs: ' '.join(xs), 
>>>         str.upper
>>>     ),
>>>     'dummy': lambda _: 123
>>> }
>>> 
>>> apply_mapping(data, spec)
{'names': ['John', 'Doe'], 'full_name': 'JOHN DOE', 'dummy': 123}
```

To me, this is a much more elegant solution: I find it much easier to read and understand than the glom equivalent, and appreciate how strictly declarative it is.

## Compiling Down to Lambdas

Because these specifications simply define a series of transformations, like an S-expression, they can be trivially compiled down to a composite function. By doing so, we can avoid the overhead of re-interpreting the specification each time we can apply it, which ought to be a significant performance improvement.

The implementation is quite standard, except for chaining tuples together, which required careful consideration of variable capture. The implementation is as follows:

```python
def compile_mapping(spec: Spec) -> Callable[[dict], any]::
    if isinstance(spec, str):
        return lambda record: get_value_at(record, spec)
    
    elif callable(spec):
        return spec
    
    elif isinstance(spec, tuple):
        funcs = [compile_mapping(s) for s in spec]
        
        result = lambda x: x
        for f in funcs:
            result = lambda x, f=f, prev=result: f(prev(x))
        return result
        
    elif isinstance(spec, list):
        funcs = [compile_mapping(s) for s in spec]
        return lambda record: [f(record) for f in funcs]
    
    elif isinstance(spec, dict):
        funcs = {
            key: compile_mapping(value) 
            for key, value in spec.items()
        }
        return lambda record: {
            key: f(record) 
            for key, f in funcs.items()
        }
    
    else:
        raise ValueError(f'Invalid spec: {spec}')

# use the compiled version now
def apply_mapping(record: dict, spec: Spec) -> dict:
    return compile_mapping(spec)(record)
```

After writing some equivalency tests, I went on to benchmark the interpreted version against the compiled version, both naively compiling again for every row (using the new `apply_mapping`), as well as compiling once.

I re-ran my pipeline's integration tests on a real dataset of ~500k rows, and timed the execution of the transformation step, taking the average of 10 trials. The results are as follows:

| Type | Time (s) | Speedup
|:-------|:----------|:--------|
| Definitional interpreter | 12.11 | 1.0x |
| Compiled n-times | 15.59 | 0.78x |
| Compiled once | 9.51 | 1.27x |

As I suspected, compiling every time is slower than interpreting, but compiling once is a significant speedup. Does it justify the extra complexity? At this scale, probably not, but it was a fun exercise nonetheless.

> More exhaustive (and open!) performance tests are on my to-do list.

I have some work to do, cleaning up the code and writing a more complete test suite, but I am pleased with the result, and already am using it heavily! Once everything is in place, I'll publish it on GitHub and maybe even PyPI.