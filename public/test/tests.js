

describe('iframe evaluator', function() {
  this.slow(400)

  const iframe = document.createElement('iframe')
  // iframe.sandbox = ''
  iframe.style.display = 'none'
  document.body.appendChild(iframe)

  const evaluator = new cojs.iframeEvaluator(iframe)

  describe('properties', () => {
    it('has a sandbox applied', () => {
      expect(iframe.sandbox)
        .to.eql({
          '0': 'allow-scripts', '1': 'allow-same-origin'
        })
    })
  })

  describe('basic functions', () => {

    it('works', function () {
      return evaluator.evaluate(`
          const x = 500
          const y = x + 500`,
          ['x', 'y']
      )
      .then(result => {
        expect(result)
          .to.eql({
            x: 500,
            y: 1000
          })
      })
    })

    it('handles loops', () => {

      return evaluator.evaluate(`let a = 1;
        for(i = 0; i < 10; i++) {
          a *= 2
        }
        `,
        ['a']
      )
      .then(result => {
        expect(result)
          .to.eql({
            a: 1024
          })
      })

    })

  })

  describe('safety', () => {
    it('quietly handles infinite loops', () => {
      // thanks Remy

      return evaluator.evaluate(`let a = 42;
        while(true) {}
        const b = 50
        `,
        ['a', 'b']
      )
      .then(result => {
        expect(result)
          .to.eql({
            a: 42,
            b: 50
          })
      })
    })
  })

  describe('state', () => {

    it('handles state', () => {
      return evaluator.evaluate(`let a = b * 2;`,
        ['a'], {b: 42}
      )
      .then(result => {
        expect(result)
          .to.eql({
            a: 84
          })
      })
    })

    it('overwrites state', () => {
      return evaluator.evaluate(`let a = 5;`,
        ['a'], {b: 42, a: 122222}
      )
      .then(result => {
        expect(result)
          .to.eql({
            a: 5
          })
      })

    })

  })

  describe('errors', () => {
    it('handles bad code', () => {
      return evaluator.evaluate(`lext a = b * 2;`,
        ['a'], {b: 42}
      )
      .then(e => {
        expect("no").to.be("yes")
      })
      .catch(e => {
        expect(e)
          .to.eql('Uncaught SyntaxError: Unexpected identifier')
      })

    })
  })


})



describe('Evaluate', () => {

  describe('basic assignments', () => {

    it('a = 1', () => {
      expect(cojs.evaluate('a = 1', {}, ['a'], []))
        .to.eql({a: 1})
    })

    it('a = 1; b = 2', () => {
      expect(cojs.evaluate('a = 1; b = 2', {}, ['a', 'b'], []))
        .to.eql({a: 1, b: 2})
    })

    it('handles let & const', () => {
      expect(cojs.evaluate('let a = 31', {}, ['a'], []))
        .to.eql({a: 31})

      expect(cojs.evaluate('const a = 41', {}, ['a'], []))
        .to.eql({a: 41})
    })

    it('handles loops', () => {
      expect(cojs.evaluate(`let a = 1;
        for(i = 0; i < 10; i++) {
          a *= 2
        }
        `, {}, ['a', 'i'], []))
        .to.eql({a: 1024, i: 10})

      expect(cojs.evaluate('const a = 41', {}, ['a'], []))
        .to.eql({a: 41})
    })

  })

  describe('state', () => {

    it('a = a * 2  (a=10)', () => {
      expect(cojs.evaluate('a = a * 2', {a: 5}, ['a'], ['a']))
        .to.eql({a: 10})
    })

    it('a = a * 2; b = a * 2  (a=10)', () => {
      expect(cojs.evaluate(
        'a = a * 2; b = a * 2',
        {a: 5},
        ['a', 'b'],
        ['a']))
        .to.eql({a: 10, b: 20})
    })

  })

  describe('problems', () => {

    it('throws syntax errors', () => {
      expect(
        () => cojs.evaluate('then what yeah', {}, [], []))
        .to.throwException((e) => {
          expect(e).to.be.a(SyntaxError)
        });

    })
  })

  describe('bugs/weirdness', () => {

    it('protects loops', function() {

      this.slow(300) // it'll run for at least 100ms before giving up

      expect(cojs.evaluate(
        'for(a = 0; a < 10; a--) {}; b = 43',
        {},
        ['a', 'b'],
        []).b)
        .to.eql(43)
    })

    xit('a = 42', () => {
      expect(cojs.evaluate(
        'a = 42',
        {},
        ['a', 'b'],
        []))
        .to.eql({a: 42, b: undefined})
    })
  })

})


describe('Parsing', () => {


  const testParse = (source, output) => {
    const result = cojs.parse(source)

    if(output.gives) {
      expect(result.gives).to.eql(output.gives)
    }

    if(output.takes) {
      expect(result.takes).to.eql(output.takes)
    }
  }



  describe('basic gives', () => {

    it('var a = 0', () => {
      testParse(
        `var a = 0`,
        {gives: ['a'], takes: []}
      )
    })

    it('var a = 0; const b = 12', () => {
      testParse(
        'var a = 0; const b = 12',
        {gives: ['a', 'b'], takes: []}
      )
    })

    it('a = 0; b = 2; c = 3', () => {
      testParse(
        'a = 0; b = 2; c = 3',
        {gives: [], takes: []}
      )
    })

  })


  describe('edges', () => {

    it('const a = b', () => {
      testParse('const a = b',
        {gives: ['a'], takes: ['b']}
      )
    })

    it('const a = () => {b + c * 23}', () => {
      testParse('const a = () => {b + c * 23}',
        {gives: ['a'], takes: ['c', 'b']}
      )
    })

    it('ignores reuse', () => {
      testParse(`
          const x = 123
          const y = x * 1234
        `,
          {gives: ['x','y'], takes: []}
        )
    })

    it('handles objects', () => {
      testParse('const a = Math.random()',
        {gives: ['a'], takes: ['Math']}
      )
    })
  })

  describe('takes', () => {

    it('var a = b * 2', () => {
      testParse('var a = b * 2',
        {gives: ['a'], takes: ['b']}
      )

    })

    it('var a = b * c * d * e * f', () => {
      testParse('var a = b * c * d * e * f',
        {gives: ['a'], takes: ['b', 'c', 'd', 'e', 'f']}
      )
    })

    it('const el = {}; el.x = a', () => {
      testParse('const el = {}; el.x = a',
        {gives: ['el'], takes: ['a']}
      )
    })



  })

  describe('last expression', () => {

    it('gives an insert point', () => {

      const code = `const foo = bar; bar * 200`

      const result = cojs.parse(code)

      expect(code.slice(result._))
        .to.be('bar * 200')

    })

    it('ignores for loops', () => {
      const code = `x = 1; 200; for(;;){}`

      const result = cojs.parse(code)

      expect(code.slice(result._))
        .to.be('200; for(;;){}')

    })

  })

  describe('repl insersion', () => {
    const it_repls = (input, output) => {
      it(`${input} ⇒ ${output}`, () => {

        const result = cojs.parse(input)
        const range = result.repl
        const t = input.slice(range[0], range[1])
        expect(t)
          .to.be(output)

      })
    }

    const xit_repls = (input, output) => xit(`${input} ⇒ ${output}`)


    it_repls('"Hello world"', '"Hello world"')
    it_repls('12', '12')

    xit_repls('var i = 0', '0')
    xit_repls(`const j; var i = 0`, '0')


  })

})



describe('Recast Parsing', () => {

  it('wraps numbers', () => {

    const modified = cojs.parseRecast(`12`)

    expect(modified.code)
      .to.be(`__R(12)`)

  })

  it('wraps declarations', () => {

    const modified = cojs.parseRecast(`const a = 12`)

    expect(modified.code)
      .to.be(`const a = __R(12)`)

  })


  const testcase = (code, expected) => {
    const modified = cojs.parseRecast(code)

    const fn = new Function('__VALUE', `
      const __R = v => __VALUE = v;
      (() => {
        ${modified.code}
      })()
      return __VALUE
    `)

    expect(fn())
      .to.be(expected)
  }

  it('returns the last thing', () => {
    testcase(`
      const a = 12
      const b = 40
      a + b`, 52)
  })

  it('handles complex stuff', () => {
    testcase(`
      const a = {
        b: {
          c: function() {
            return 5 * 10
          }
        }
      }
      const b = 40

      a.b.c()`, 50)
  })

  describe('original parser functions', () => {

      const testParse = (source, output) => {
        const result = cojs.parseRecast(source)

        if(output.gives) {
          expect(result.gives.sort()).to.eql(output.gives.sort())
        }

        if(output.takes) {
          expect(result.takes.sort()).to.eql(output.takes.sort())
        }
      }



      describe('basic gives', () => {

        it('var a = 0', () => {
          testParse(
            `var a = 0`,
            {gives: ['a'], takes: []}
          )
        })

        it('var a = 0; const b = 12', () => {
          testParse(
            'var a = 0; const b = 12',
            {gives: ['a', 'b'], takes: []}
          )
        })

        it('a = 0; b = 2; c = 3', () => {
          testParse(
            'a = 0; b = 2; c = 3',
            {gives: [], takes: []}
          )
        })

      })


      describe('edges', () => {

        it('const a = b', () => {
          testParse('const a = b',
            {gives: ['a'], takes: ['b']}
          )
        })

        it('const a = () => {b + c * 23}', () => {
          testParse('const a = () => {b + c * 23}',
            {gives: ['a'], takes: ['c', 'b']}
          )
        })

        it('ignores reuse', () => {
          testParse(`
              const x = 123
              const y = x * 1234
            `,
              {gives: ['x','y'], takes: []}
            )
        })

        it('handles objects', () => {
          testParse('const a = Math.random()',
            {gives: ['a'], takes: ['Math']}
          )
        })
      })

      describe('takes', () => {

        it('var a = b * 2', () => {
          testParse('var a = b * 2',
            {gives: ['a'], takes: ['b']}
          )

        })

        it('var a = b * c * d * e * f', () => {
          testParse('var a = b * c * d * e * f',
            {gives: ['a'], takes: ['b', 'c', 'd', 'e', 'f']}
          )
        })

        it('const el = {}; el.x = a', () => {
          testParse('const el = {}; el.x = a',
            {gives: ['el'], takes: ['a']}
          )
        })



      })


  })
})
