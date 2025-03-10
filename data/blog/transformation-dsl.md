---
title: "Minimal Python DSL for Data Transformation"
publishDate: 2025-03-10T00:00:00-05:00
description: "Rolling my own domain-specific language in Python for data transformation"
---

In the data-processing pipeline I'm working on, transformations are typically remapping data from one schema to another, with a little additional logic thrown in. Typically, I'd use [glom](https://glom.readthedocs.io/en/latest/) for this, a great library for transforming data structures in Python.

Glom is used by defining a specification that describes how to access then transform the data. Tuples define the transformation, with the first elment being the dot-notation path to the value, and subsquent elements being the transformation functions to apply.

```python
from glom import glom

data = {
    'name': {
        'first': 'John',
        'last': 'Doe'
    }
}

spec = {
    'first_name': ('name.first', str.upper),
    'last_name': 'name.last',
}

glom(data, spec)
# {'first_name': 'JOHN', 'last_name': 'Doe'}
```

However, with more complex transformations, glom's syntax becomes a bit cumbersome, sacrificing niceties such as dot-notation. For example, if I were to combine the first and last name using glom, I would to write a specification like this:

```python
'name': T['name']['first'] + ' ' + T['name']['last'],
```

Glom's coup de grâce was while I was trying to collect a list of values from within a target dictionary. Using the name example: I had hoped a spec like the following would be possible:

```python
'names': ['name.first', 'name.last']
```

However, glom doesn't support this out of the box, and the closest I could get was to use a lambda function and access the values, almost as if glom didn't exist:

```python
'names': lambda data: [data['name']['first'], data['name']['last']]
```

Alternatively, I could use glom within the lambda function like so:

```python
'names': lambda data: [glom(data, 'name.first'), glom(data, 'name.last')]
```

A bit redundant, and ugly, but it works. At this point I had spent enough time pain-stakingly navigating the documentation looking for functionality that I was sure was there, but wasn't, trying to make glom work elegantly for my use case, that I decided to roll my own!

## Rolling a Glom-like

I love the simple syntax demonstrated by the first example, and wanted to keep that for my implementation. I also wanted to enhance it with the ability to use a list of values, like my hypothetical example above.

I began by defining precisely what a specification could look like. I wanted to allow for the following:
- A string, which would be the dot-notation path to the value
- A callable, which would be a function to apply to target dictionary
- A tuple whose first element is a specification, and the rest, if any are functions to apply to the value
- A list of specifications, which are evaluated to a list
- A dictionary, where the keys are keys in the resulting dictionary, and he values are specifications
> By using a recursive type definition, a specification both captures the accessing and transformation of data, while also allowing for the specification to be nested, enabling the common use case of resolving to a dictionary.

In the form of a python type hint, this looks like:

```python
Spec = str \
    | Callable[[dict], any] \
    | tuple['Spec', ...] \
    | list['Spec'] \
    | dict[any, 'Spec'] \
```
> Note that it is not possible to specify more than one types of variable length tuples in a type hint, so some further documentation is necessary to clarify that all the elements of the tuple after the first are functions to apply to the value.

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
    
    # Handle tuple of form (Spec, ...funcs)
    elif isinstance(spec, tuple):
        result = apply_mapping(record, spec[0])
        for func in spec[1:]:
            result = func(result)
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
    'full_name': (['name.first', 'name.last'], lambda xs: f'{xs[0]} {xs[1]}', str.upper)
}

apply_mapping(data, spec)
# {'names': ['John', 'Doe'], 'full_name': 'JOHN DOE'}
```

To me, this is a much more elegant solution, as well as enables me to write more pythonic code. I find this much easier to read and understand than the glom equivalent, especially as complexity increases. In the future, I look to add more redundancy functionality, such as error handling and default values, but for now, this suits my needs.

In the future, I'll finish writing more comprehensive tests, and publish this to GitHub, and possibly as a PyPI package.