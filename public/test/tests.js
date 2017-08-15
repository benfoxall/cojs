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

    it('protects loops', () => {
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

  describe('basic gives', () => {

    it('var a = 0', () => {
      expect(cojs.parse('var a = 0'))
        .to.eql({gives: ['a'], takes: []})

    })

    it('var a = 0; const b = 12', () => {
      expect(cojs.parse('var a = 0; const b = 12'))
        .to.eql({gives: ['a', 'b'], takes: []})

    })

  })

  describe('basic takes', () => {

    it('var a = b * 2', () => {
      expect(cojs.parse('var a = b * 2'))
        .to.eql({gives: ['a'], takes: ['b']})

    })


    it('var a = b * c * d * e * f', () => {
      expect(cojs.parse('var a = b * c * d * e * f'))
        .to.eql({gives: ['a'], takes: ['b', 'c', 'd', 'e', 'f']})

    })

  })

})
