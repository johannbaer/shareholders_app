//var beer_designs = require('./beer_designs');
var beer_app = require('./sh_app');

// connection configuration to pass on to couchbase.connect(). Note that
// while connecting with the server we are also opening the beer-sample
// bucket.
var config = {
    //connstr : "http://52.7.228.98:8091",
    //connstr : "http://macbookjbaer.local:8091",
    connstr : "couchbase://ec2-52-7-228-98.compute-1.amazonaws.com:8091",
    bucket : 'associates'
}

beer_app.start( config );

//if( require.main == module ) {
//    argv = process.argv.splice(2);
//    if( argv[0] === '--setup' ) { // Create the design documents for beer-samples
//        beer_designs.setup( config );
//    } else if( argv[0] === '--reset' ) {  // Reset what was done by -d option
//        beer_designs.reset( config );
//    } else {
//        beer_app.start( config );
//    }
//}
