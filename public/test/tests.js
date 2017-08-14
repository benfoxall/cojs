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

  xdescribe('bugs/weirdness', () => {

    it('protects loops', () => {
      expect(cojs.evaluate(
        'for(a = 0; a < 10; i--) {}; b = 43',
        {},
        ['a', 'b'],
        []))
        .to.eql({b: 43})
    })

    it('a = 42', () => {
      expect(cojs.evaluate(
        'a = 42',
        {},
        ['a', 'b'],
        []))
        .to.eql({a: 42, b: undefined})
    })
  })

})
