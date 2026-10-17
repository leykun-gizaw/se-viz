import { describe, expect, it } from 'vitest';
import type { Token } from './highlightC.ts';
import { tokenizePython, tokenizePythonLine } from './highlightPython.ts';

/** Tokens without whitespace, as `type:text` pairs (easy to read in a failure). */
const pairs = (tokens: Token[]) =>
  tokens.filter((t) => t.text.trim() !== '').map((t) => `${t.type}:${t.text}`);
const line = (src: string) => pairs(tokenizePythonLine(src).tokens);

describe('tokenizePython — a representative snippet', () => {
  const SNIPPET = [
    '@dataclass',
    'class Tractor(Base):',
    '    def drive(self, hours=2):  # burn fuel',
    '        self.fuel -= 10 * hours',
    '        print(f"{self.name!r} has {self.fuel:>4} left", len(LOG), True)',
    '        return None',
  ].join('\n');

  it('produces the same token classes as the C highlighter', () => {
    expect(tokenizePython(SNIPPET).map(pairs)).toEqual([
      ['preproc:@dataclass'],
      ['keyword:class', 'type:Tractor', 'punct:(', 'plain:Base', 'punct:)', 'punct::'],
      [
        'keyword:def',
        'fn:drive',
        'punct:(',
        'plain:self',
        'punct:,',
        'plain:hours',
        'punct:=',
        'number:2',
        'punct:)',
        'punct::',
        'comment:# burn fuel',
      ],
      [
        'plain:self',
        'punct:.',
        'plain:fuel',
        'punct:-',
        'punct:=',
        'number:10',
        'punct:*',
        'plain:hours',
      ],
      [
        'fn:print',
        'punct:(',
        'string:f"',
        'punct:{',
        'plain:self',
        'punct:.',
        'plain:name',
        'string:!r',
        'punct:}',
        'string: has ',
        'punct:{',
        'plain:self',
        'punct:.',
        'plain:fuel',
        'string::>4',
        'punct:}',
        'string: left',
        'string:"',
        'punct:,',
        'fn:len',
        'punct:(',
        'plain:LOG',
        'punct:)',
        'punct:,',
        'number:True',
        'punct:)',
      ],
      ['keyword:return', 'number:None'],
    ]);
  });

  it('covers every character of every line', () => {
    const lines = SNIPPET.split('\n');
    tokenizePython(SNIPPET).forEach((tokens, i) => {
      expect(tokens.map((t) => t.text).join('')).toBe(lines[i]);
    });
  });
});

describe('tokenizePython — details', () => {
  it('keywords, builtins, builtin types and calls', () => {
    expect(line('for crop in sorted(harvest): x = int(y) if not z else isinstance')).toEqual([
      'keyword:for',
      'plain:crop',
      'keyword:in',
      'fn:sorted',
      'punct:(',
      'plain:harvest',
      'punct:)',
      'punct::',
      'plain:x',
      'punct:=',
      'type:int',
      'punct:(',
      'plain:y',
      'punct:)',
      'keyword:if',
      'keyword:not',
      'plain:z',
      'keyword:else',
      'fn:isinstance',
    ]);
  });

  it('strings with every prefix and quote style', () => {
    expect(line(`a = 'x' + "y" + r'\\d' + b"raw" + 'it\\'s'`)).toEqual([
      'plain:a',
      'punct:=',
      "string:'x'",
      'punct:+',
      'string:"y"',
      'punct:+',
      "string:r'\\d'",
      'punct:+',
      'string:b"raw"',
      'punct:+',
      "string:'it\\'s'",
    ]);
  });

  it('f-string braces: doubled braces are text, fields are code, nested quotes stay inside', () => {
    expect(line(`f'{{x}} {d["k"]}'`)).toEqual([
      "string:f'",
      'string:{{x}} ',
      'punct:{',
      'plain:d',
      'punct:[',
      'string:"k"',
      'punct:]',
      'punct:}',
      "string:'",
    ]);
  });

  it('numbers: ints, floats, exponents, hex, binary, underscores, complex', () => {
    expect(line('n = 1_000 + 2.5 + .5 + 1e-3 + 0xFF + 0b101 + 3j')).toEqual([
      'plain:n',
      'punct:=',
      'number:1_000',
      'punct:+',
      'number:2.5',
      'punct:+',
      'number:.5',
      'punct:+',
      'number:1e-3',
      'punct:+',
      'number:0xFF',
      'punct:+',
      'number:0b101',
      'punct:+',
      'number:3j',
    ]);
  });

  it('a # inside a string is not a comment', () => {
    expect(line('s = "#1"  # first')).toEqual([
      'plain:s',
      'punct:=',
      'string:"#1"',
      'comment:# first',
    ]);
  });

  it('decorators with dotted names and arguments', () => {
    expect(line('  @app.route("/")')).toEqual([
      'preproc:@app.route',
      'punct:(',
      'string:"/"',
      'punct:)',
    ]);
  });

  it('triple-quoted strings carry across lines', () => {
    const lines = tokenizePython('x = """one\ntwo\nthree""" + y\nz');
    expect(lines.map(pairs)).toEqual([
      ['plain:x', 'punct:=', 'string:"""one'],
      ['string:two'],
      ['string:three"""', 'punct:+', 'plain:y'],
      ['plain:z'],
    ]);
  });

  it('a one-line triple-quoted docstring closes on its own line', () => {
    expect(tokenizePythonLine('"""Doc."""').state).toBeNull();
    expect(tokenizePythonLine("'''open").state).toEqual({ quote: "'''" });
  });
});
