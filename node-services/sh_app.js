var fs = require('fs');
var jsonFile = require('jsonfile');
var express = require('express');
var jade = require('jade');
var couchbase = require('couchbase');
var _ = require('underscore');
var ViewQuery = couchbase.ViewQuery;

//var ENTRIES_PER_PAGE = 30;

exports.start = function (config) {
    // Connect with couchbase server.  All subsequent API calls
    // to `couchbase` library is made via this Connection
    var cb = new couchbase.Cluster("couchbase://localhost:8091");
    //var cb = new couchbase.Cluster(config.connstr, 'Administrator', 'i-94b21c6b');
    cb.operationTimeout = 120 * 10000;
    var db = cb.openBucket(config.bucket);
    db.on('connect', function (err) {
        if (err) {
            console.error("Failed to connect to cluster: " + err);
            process.exit(1);
        }

        console.log('Couchbase Connected');
    });

    var app = express();
    app.use(express.bodyParser());
    app.use(express.static('static'));
    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.locals.pretty = true;

    // Index page redirect
    app.get('/', function (req, res) {
        res.redirect('/welcome');
    });

    // Welcome page.
    function welcome(req, res) {
        res.render('welcome');
    }

    app.get('/welcome', welcome);


    // List of associates.
    function list_associates(req, res) {

        var country = req.body.country;

        var q = ViewQuery.from('associate', 'by_country')
            //.limit(ENTRIES_PER_PAGE)
            //.stale(ViewQuery.Update.BEFORE)
            .key(country);
        console.log('before db.query');


        db.query(q, function (err, values) {

            console.log('after db.query');
            console.log('err: ' + err);
            console.log('values strg: ' + JSON.stringify(values));
            console.log('values: ' + values);
            // 'by_name' view's map function emits beer-name as key and value as
            // null. So values will be a list of
            //      [ {id: <beer-id>, key: <beer-name>, value: <null>}, ... ]

            // we will fetch all the beer documents based on its id.
            var keys = _.pluck(values, 'id');
            console.log('keys: ' + keys);

            db.getMulti(keys, function (err, results) {
                console.log('getMulti results:' + JSON.stringify(results));

                // Add the id to the document before sending to template
                var beers = _.map(results, function (v, k) {
                    console.log('var beers = ' + beers);
                    console.log(" v = " + JSON.stringify(v));
                    console.log(" k = " + k);
                    v.value.id = k;
                    console.log(" k stringfy = " + JSON.stringify(k));
                    return v.value;
                });

                console.log('var beers = ' + JSON.stringify(beers));

                //res.render('beer/index', {'beers':beers});

                res.send(beers);

            })
        });
    }

    //app.get('/associates', list_associates);
    app.post('/associates', list_associates);

    function update_associate(req, res) {

        console.log("req.body = " + JSON.stringify(req.body));

        var associateToUpdate = req.body;

        var docName = associateToUpdate.country + "_" + associateToUpdate.barcode;

        //var obj = {
        //  building: "YOCM",
        //  country: "CANADA",
        //  wing: "Y1000",
        //  gender: "male",
        //  roomNum: 103,
        //  firstName: "Johan",
        //  lastName: "Baer",
        //  roomType: "Double",
        //  barcode: "0413201022",
        //  commentsNotes: "Brian is tha man!",
        //  checkInDate: "06/01/15"
        //};

        console.log(docName);


        db.upsert(docName, req.body, function (err, response) {
            if (err) {
                console.log(" err = " + err);
                res.send(err);
            } else {
                console.log(" res = " + response);
                res.send("Updated document - " + docName + " - successfully!");
            }

        })

    };

    app.post('/updateAssociate', update_associate);

    //add associates
    function add_associates(req, res) {

        var docs = {};
        var docsArray = [];
        var listOfFiles;
        var fileName;

        fs.readdir('./beersample-node/json/uk/docs', function (err, data) {
            if (err) {
                throw err;
            }

            listOfFiles = data;

            fileName = _.map(listOfFiles, function (v, k) {
                if (v.indexOf("UK_") >= 0) {
                    //data.splice(k, 1);

                    var fileToRead = './beersample-node/json/uk/docs/' + v.toString();

                    var fileContent = JSON.parse(fs.readFileSync(fileToRead, 'utf8'));

                    var jsonExt = ".json";

                    var newDocName = v.replace(jsonExt, "");

                    docs[newDocName] = fileContent;

                    db.upsert(newDocName, fileContent, function (err, res) {
                        if (err) {
                            console.log('operation failed', err);
                            /*
                             operation failed { [Error: The key does not exist on the server] code: 13 }
                             */
                            return;
                        }

                        console.log('success!', res);
                    });

                }
            });
        });

        console.log("docs: " + docs);

    };


    app.post('/add', add_associates);

    // List of beers.
    function list_beers(req, res) {
        var q = ViewQuery.from('beer', 'by_name')
            //.limit(ENTRIES_PER_PAGE)
            .stale(ViewQuery.Update.BEFORE);
        db.query(q, function (err, values) {
            // 'by_name' view's map function emits beer-name as key and value as
            // null. So values will be a list of
            //      [ {id: <beer-id>, key: <beer-name>, value: <null>}, ... ]

            // we will fetch all the beer documents based on its id.
            var keys = _.pluck(values, 'id');

            db.getMulti(keys, function (err, results) {

                // Add the id to the document before sending to template
                var beers = _.map(results, function (v, k) {
                    v.value.id = k;
                    return v.value;
                });

                res.render('beer/index', {'beers': beers});
            })
        });
    }

    app.get('/beers', list_beers);

    // List of brewery. Logic is same as above except that we will be gathering
    // brewery documents and rendering them.
    function list_breweries(req, res) {
        var q = ViewQuery.from('brewery', 'by_name')
            .limit(ENTRIES_PER_PAGE);
        db.query(q, function (err, results) {
            var breweries = _.map(results, function (v, k) {
                return {
                    'id': v.id,
                    'name': v.key
                };
            });

            res.render('brewery/index', {'breweries': breweries});
        });
    }

    app.get('/breweries', list_breweries);

    // Delete a beer document or brewery document. Document `id` is supplied as
    // part of the URL.
    function delete_object(req, res) {
        db.remove(req.params.object_id, function (err, meta) {
            if (err) {
                console.log('Unable to delete document `' + req.params.object_id + '`');
            }

            res.redirect('/welcome');
        });
    }

    app.get('/beers/delete/:object_id', delete_object);
    app.get('/breweries/delete/:object_id', delete_object);


    // Show individual beer document, with all its details. Document `id` is
    // supplied as part of the URL.
    function show_beer(req, res) {
        db.get(req.params.beer_id, function (err, result) {
            var doc = result.value;
            if (doc === undefined) {
                res.send(404);
            } else {
                doc.id = req.params.beer_id;

                var view = {
                    'beer': doc,
                    'beerfields': _.map(doc, function (v, k) {
                        return {'key': k, 'value': v};
                    })
                };
                res.render('beer/show', view);
            }
        });
    }

    app.get('/beers/show/:beer_id', show_beer);

    // Show individual brewery document, with all its details. Document `id` is
    // supplied as part of the URL.
    function show_brewery(req, res) {
        db.get(req.params.brewery_id, function (err, result) {
            var doc = result.value;

            if (doc === undefined) {
                res.send(404);
            } else {
                doc.id = req.params.brewery_id;

                var view = {
                    'brewery': doc,
                    'breweryfields': _.map(doc, function (v, k) {
                        return {'key': k, 'value': v};
                    })
                };
                res.render('brewery/show', view);
            }
        });
    }

    app.get('/breweries/show/:brewery_id', show_brewery);

    // Edit beer document. This action handles both GET and POST method. In case
    // of GET method, it renders a form. And in case of POST it updates the
    // document in couchbase and redirects the client.
    function begin_edit_beer(req, res) {
        db.get(req.params.beer_id, function (err, result) {
            var doc = result.value;
            if (doc === undefined) { // Trying to edit non-existing doc ?
                res.send(404);
            } else { // render form.
                doc.id = req.params.beer_id;
                var view = {is_create: false, beer: doc};
                res.render('beer/edit', view);
            }
        });
    }

    function done_edit_beer(req, res) {
        var doc = normalize_beer_fields(req.body);

        db.get(rc.doc.brewery_id, function (err, result) {
            if (result.value === undefined) { // Trying to edit non-existing doc ?
                res.send(404);
            } else {    // Set and redirect.
                db.upsert(req.params.beer_id, doc, function (err, doc, meta) {
                    res.redirect('/beers/show/' + req.params.beer_id);
                })
            }
        });
    }

    app.get('/beers/edit/:beer_id', begin_edit_beer);
    app.post('/beers/edit/:beer_id', done_edit_beer);


    // Create a new beer document. Same as edit, only that we use add() API
    // instead of set() API.
    function begin_create_beer(req, res) {
        var view = {
            is_create: true, beer: {
                type: '',
                name: '',
                description: '',
                style: '',
                category: '',
                abv: '',
                ibu: '',
                srm: '',
                upc: '',
                brewery_id: ''
            }
        };
        res.render('beer/edit', view);
    }

    function done_create_beer(req, res) {
        var doc = normalize_beer_fields(req.body);
        var beer_id = doc.brewery_id.toLowerCase() + '-' +
            doc.name.replace(' ', '-').toLowerCase();
        db.insert(beer_id, doc, function (err, result) {
            if (err) throw err;
            res.redirect('/beers/show/' + beer_id);
        });
    }

    app.get('/beers/create', begin_create_beer);
    app.post('/beers/create', done_create_beer);


    function search_beer(req, res) {
        var value = req.query.value;
        var q = ViewQuery.from('beer', 'by_name')
            .range(value, value + JSON.parse('"\u0FFF"'))
            .stale(ViewQuery.Update.BEFORE)
            .limit(ENTRIES_PER_PAGE);
        db.query(q, function (err, values) {
            var keys = _.pluck(values, 'id');
            if (keys.length <= 0) {
                return res.send([]);
            }
            db.getMulti(keys, function (err, results) {
                var beers = [];
                for (var k in results) {
                    beers.push({
                        'id': k,
                        'name': results[k].value.name,
                        'brewery_id': results[k].value.brewery_id
                    });
                }

                res.send(beers);
            });
        });
    };
    app.get('/beers/search', search_beer);

    function search_brewery(req, res) {
        var value = req.query.value;
        var q = ViewQuery.from('beer', 'by_name')
            .range(value, value + JSON.parse('"\u0FFF"'))
            .limit(ENTRIES_PER_PAGE);
        db.query(q, function (err, results) {
            var breweries = [];
            for (var k in results) {
                breweries.push({
                    'id': results[k].id,
                    'name': results[k].key
                });
            }

            res.send(breweries);
        });
    };
    app.get('/breweries/search', search_brewery);

    // Start Express
    app.listen(1337);
    console.log('Server running at http://127.0.0.1:1337/');
}

// utility function to validate form submissions - creating / editing beer
// documents.
function normalize_beer_fields(data) {
    var doc = {};
    _.each(data, function (value, key) {
        if (key.substr(0, 4) == 'beer') {
            doc[key.substr(5)] = value;
        }
    });

    if (!doc['name']) {
        throw new Error('Must have name');
    }
    if (!doc['brewery_id']) {
        throw new Error('Must have brewery ID');
    }

    return doc;
}
