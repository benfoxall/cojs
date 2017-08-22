const gulp = require('gulp')
const awspublish = require('gulp-awspublish')
const cloudfront = require('gulp-cloudfront-invalidate-aws-publish')
const rollup = require('rollup-stream')
const source = require('vinyl-source-stream')
const rev = require('gulp-rev')
const revReplace = require('gulp-rev-replace')
const uglify = require('gulp-uglify')
const cleanCSS = require('gulp-clean-css')
const clean = require('gulp-clean')
const filter = require('gulp-filter')

gulp.task('rollup', () => {
  return rollup({
      entry: './public.src/main.js'
    })
    .pipe(source('main.js'))
    .pipe(gulp.dest('./public'))
})

gulp.task('publish', ['revreplace'], () => {

  const publisher = awspublish.create({
    region: 'eu-west-2',
    params: {
      Bucket: 'cojs.co'
    }
  })

  const html = filter(['**/*.html'], {restore: true});
  const others = filter(['**/*', '!**/*.html'], {restore: true});

  return gulp.src('./public.cdn/*')
    .pipe(html)
    .pipe(publisher.publish())
    .pipe(html.restore)
    .pipe(others)
    .pipe(publisher.publish({'Cache-Control': 'max-age=315360000, no-transform, public'}))
    .pipe(others.restore)
    .pipe(cloudfront({distribution: 'E3V21SQYOBFO6D', indexRootPath: true}))
    .pipe(awspublish.reporter())
})

gulp.task('publish-and-clean', ['publish'], () => {
  return gulp.src('public.cdn', {read: false})
    .pipe(clean())
})


gulp.task('codemirror', () => {

  return gulp.src([
    'node_modules/codemirror/lib/codemirror.js',
    'node_modules/codemirror/lib/codemirror.css',
    'node_modules/codemirror/mode/javascript/javascript.js'
  ])
  .pipe(gulp.dest('./public/'))
})


gulp.task('cdn:clean', () => {
  return gulp.src('public.cdn', {read: false})
    .pipe(clean())
})


gulp.task('rev:js', ['cdn:clean'], () => {
	return gulp.src('public/*.js')
    .pipe(uglify())
		.pipe(rev())
		.pipe(gulp.dest('public.cdn'))
    .pipe(rev.manifest('revs.js.json'))
    .pipe(gulp.dest('public.cdn'))
})

gulp.task('rev:css', ['cdn:clean'], () => {
	return gulp.src('public/*.css')
    .pipe(cleanCSS())
		.pipe(rev())
		.pipe(gulp.dest('public.cdn'))
    .pipe(rev.manifest('revs.css.json'))
    .pipe(gulp.dest('public.cdn'))
})

gulp.task("revreplace", ["rev:js", "rev:css"], function(){
  var manifestJS = gulp.src("public.cdn/revs.js.json");
  var manifestCSS = gulp.src("public.cdn/revs.css.json");

  return gulp.src("public/index.html")
    .pipe(revReplace({manifest: manifestJS}))
    .pipe(revReplace({manifest: manifestCSS}))
    .pipe(gulp.dest('public.cdn'))
});
