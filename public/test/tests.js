describe('Evaluate', function() {

  it('should basically work', () => {

    expect(cojs.evaluate('a = 1', {}, ['a'], []))
      .to.eql({a: 1})

  })


  it('should handle multiple', () => {

    expect(cojs.evaluate('a = 1; b = 2', {}, ['a', 'b'], []))
      .to.eql({a: 1, b: 2})

  })

})
