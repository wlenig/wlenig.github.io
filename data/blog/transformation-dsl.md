---
title: "Glom-like data transformation DSL"
publishDate: 2025-03-10T00:00:00-05:00
description: "Rolling my own domain-specific language in Python for data transformation"
---

In the data-processing pipeline I'm working on, transformations are typically remapping data from one schema to another, with a little additional logic thrown in. Typically, I'd use [glom](https://glom.readthedocs.io/en/latest/) for this, a great library for transforming data structures in Python.

Glom is used by defining a specification that describes how to access then optionally transform the data, then applying the spec to the target dictionary using the `glom` function. As it's somewhat of a data transformation swiss army knife, it is difficult to succintly and completely describe its functionality, but the following examples demonstrate its principal use:

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

Glom can also be used to transform multiple values at once, using the key-value pairs as key-specification pairs:

```python
>>> spec = {
>>>     'first_name': ('name.first', str.lower),
>>>     'last_name': 'name.last',
>>>     'dummy': lambda _: 'foo'
>>> }
>>> glom(data, spec)
{'first_name': 'john', 'last_name': 'Doe', 'dummy': 'foo'}
```

Take a slightly more complex example, where we want to combine the first first and last names into a single string. To do so, we must use `T`, a special object that allows us to access the target dictionary declaratively. Notice that we sacrifice the one of glom's greatest niceties, dot-notation, to access values:

```python
T['name']['first'] + ' ' + T['name']['last'],
```

In my own use, Glom's coup de grâce came while I was trying to collect a list of values from within a target dictionary. Using the name example: I had hoped a spec like the following would be possible:

```python
['name.first', 'name.last']
```

However, glom doesn't support this out of the box, and the closest I could get was to use a lambda function and access the values, almost as if glom didn't exist:

```python
lambda data: [data['name']['first'], data['name']['last']]
```

Alternatively, I could use glom within the lambda function like so:

```python
lambda data: [glom(data, 'name.first'), glom(data, 'name.last')]
```
> Note that that you could also make the lambda parameter-less and instead pass `T` into `glom`, although I find that less illustrative.


A bit redundant, and ugly, but it works. At this point I had spent enough time pain-stakingly navigating the documentation looking for functionality that I was sure was there, but wasn't, trying to make glom work elegantly for my use case, that I decided to roll my own!

## Rolling a Glom-like

I love the simple syntax demonstrated by the first example, and wanted to keep that for my implementation. I also wanted to enhance it with the ability to use a list of values, like my hypothetical example above.

I began by strictly defining what a specification is:
- A string, the dot-notation path to the value
- A callable, applied to the target dictionary
- A tuple of specifications
- A list of specifications, evaluated to a list
- A dictionary, where the keys are keys in the resulting dictionary, and the values are specifications
> By using a recursive type definition, a specification both captures the accessing and transformation of data, while also allowing for the specification to be nested, enabling the common use case of resolving to a dictionary.

In the form of a python type hint, this looks like:

```python
Spec = str \
    | Callable[[dict], any] \
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

With that out of the way, the actual interpreter was a simple recursive function that would take the record and the specification, and return the transformed value. I am pleased with its overall simplicity:

```python
def apply_mapping(record: dict, spec: Spec) -> dict:
    # Handle dot-notation for nested fields
    if isinstance(spec, str):
        return get_value_at(record, spec)
    
    # Handle callable
    elif callable(spec):
        return spec(record)
    
    # Handle tuple of form (Spec...)
    elif isinstance(spec, tuple):
        result = record
        for s in spec:
            result = apply_mapping(result, s)
        return result
    
    # Handle list of specs
    elif isinstance(spec, list):
        return [apply_mapping(record, s) for s in spec]
    
    # Handle dict of form {key: Spec}
    elif isinstance(spec, dict):
        return {
            key: apply_mapping(record, value)
            for key, value in spec.items()
        }
    
    # error out
    raise ValueError(f'Invalid spec: {spec}')
```

And with that, I had a simple DSL for transforming data! I can now use it like so:

```python
spec = {
    'names': ['name.first', 'name.last'],
    'full_name': (['name.first', 'name.last'], lambda xs: ' '.join(xs), str.upper)
}

apply_mapping(data, spec)
# {'names': ['John', 'Doe'], 'full_name': 'JOHN DOE'}
```

To me, this is a much more elegant solution: I find it much easier to read and understand than the glom equivalent, and appreciate how strictly declarative it is.

In the future, I'll finish writing more comprehensive tests, and publish this to GitHub, and possibly as a PyPI package.