const gulp = require('gulp')
const awspublish = require('gulp-awspublish')
const cloudfront = require('gulp-cloudfront-invalidate-aws-publish')
const rollup = require('rollup-stream')
const source = require('vinyl-source-stream')

gulp.task('rollup', () => {
  return rollup({
      entry: './public.src/main.js'
    })
    .pipe(source('main.js'))
    .pipe(gulp.dest('./public'))
})

gulp.task('publish', () => {

  const publisher = awspublish.create({
    region: 'eu-west-2',
    params: {
      Bucket: 'cojs.co'
    }
  })

  return gulp.src('./public/*')
    .pipe(publisher.publish({}))
    .pipe(cloudfront({distribution: 'E3V21SQYOBFO6D', indexRootPath: true}))
    .pipe(awspublish.reporter())
})
