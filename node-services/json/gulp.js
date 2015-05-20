var fs = require('fs');
var gulp = require('gulp');

gulp.task('default', function(done) {
    var data = require('./uk/uk.json');

    console.log('about to write files...')
    data.forEach(function(item) {
        var fileName = item.country + "_" + item.barcode + '.json';
        var fileContents = JSON.stringify(item);
        fs.writeFileSync('uk/docs/' + fileName, fileContents);
        console.log('saved file: ', fileName);
    });

    // let gulp know the task is complete
    done();
});
