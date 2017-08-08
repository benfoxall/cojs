const gulp = require('gulp')
const awspublish = require('gulp-awspublish')

gulp.task('publish', () => {

  const publisher = awspublish.create({
    region: 'eu-west-2',
    params: {
      Bucket: 'cojs.co'
    }
  })

  return gulp.src('./static/*')
    .pipe(publisher.publish({}))
    .pipe(awspublish.reporter())
})
