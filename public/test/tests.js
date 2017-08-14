describe('Evaluate', function() {

  it('should basically work', () => {

    expect(cojs.evaluate('a = 1', {}, ['a'], []))
      .to.eql({a: 1})

  })

})
