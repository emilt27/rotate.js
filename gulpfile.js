var gulp = require('gulp');
var minify = require('gulp-minify');

var DIST_DIR = './dist';

gulp.task('default', function() {
  gulp.src('src/*.js')
    .pipe(minify({
      ext: {
        src: '.js',
        min: '.min.js'
      },
    }))
    .pipe(gulp.dest(DIST_DIR));
});