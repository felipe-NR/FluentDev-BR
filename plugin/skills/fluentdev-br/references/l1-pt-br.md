# L1 profile: Brazilian Portuguese (pt-BR)

Mistake categories for a Brazilian Portuguese speaker writing English to a coding agent. Each category has a stable ID used in the statistics; the ID must not change once mistakes are recorded against it. Examples are in a development context.

## Categories

### `false-friend`

A word that looks like a Portuguese cognate but means something else. Add a short pt-BR note.

- "actually the API returns 404" (meaning atualmente) → "currently the API returns 404" ("actually" is na verdade)
- "I pretend to refactor this" → "I intend to refactor this" ("pretend" is fingir)
- "push the file to the library" (meaning livraria/repository) → "push the file to the repository" ("library" is biblioteca)
- "I need to realize this test" → "I need to run this test" ("realize" is perceber)

### `doubt-question`

"Doubt" used for a question, calqued on "dúvida". Add a short pt-BR note.

- "I have a doubt" → "I have a question" (for "dúvida", use "question"; "doubt" is descrença)
- "a doubt about the endpoint" → "a question about the endpoint"

### `preposition`

A preposition calqued from Portuguese.

- "it depends of the env" → "it depends on the env"
- "listen the event" → "listen to the event"
- "married with the schema" → "consistent with the schema"
- "in the weekend I deploy" → "on the weekend I deploy"

### `missing-subject`

The dummy subject "it" or "there" omitted, as Portuguese drops it.

- "Is necessary to restart" → "It is necessary to restart"
- "Seems the cache is stale" → "It seems the cache is stale"

### `there-be`

"Have" used for existence, calqued on "tem".

- "Have a bug in this file" → "There is a bug in this file"
- "Have two tests failing" → "There are two tests failing"

### `uncountable-plural`

A plural on an uncountable noun.

- "more informations" → "more information"
- "two softwares" → "two programs"
- "the feedbacks" → "the feedback"

### `article`

An article added before a generic noun, or dropped before a profession or a singular count noun.

- "The Python is slow" → "Python is slow"
- "I am developer" → "I am a developer"
- "I opened pull request" → "I opened a pull request"

### `adjective-order`

An adjective placed after the noun, as in Portuguese.

- "the files importants" → "the important files"
- "a solution simple" → "a simple solution"

### `verb-pattern`

Verb complementation calqued from Portuguese.

- "explain me the error" → "explain the error to me"
- "I want that you fix this" → "I want you to fix this"
- "make me understand" → "help me understand"

### `tense-aspect`

The simple present used for a duration, where English needs the present perfect.

- "I work here since 2020" → "I have worked here since 2020"
- "I use this library since last year" → "I have used this library since last year"

### `question-form`

A question without the auxiliary or with the wrong word order.

- "You can check?" → "Can you check?"
- "What means this flag?" → "What does this flag mean?"
- "Why the build failed?" → "Why did the build fail?"

### `double-negative`

A double negative carried over from Portuguese.

- "it doesn't return nothing" → "it doesn't return anything"
- "I didn't change nothing" → "I didn't change anything"

### `pronoun-gender`

Grammatical gender applied to objects.

- "the function and his params" → "the function and its params"
- "the class and her methods" → "the class and its methods"

### `capitalization`

Missing capital on languages, days of the week, months, and "I".

- "english" → "English"
- "monday" → "Monday"
- "i think" → "I think"

### `spelling`

Spelling influenced by Portuguese.

- "sucess" → "success"
- "enviroment" → "environment"
- "responsability" → "responsibility"

### `code-switching`

A Portuguese word left inside an English sentence.

- "check the arquivo" → "check the file"
- "run the teste" → "run the test"

## Adding another profile

A different L1 profile (for example a `l1-ko.md` for the Korean patterns in the reference post) is a new file, with no code change. The category IDs are per profile.
