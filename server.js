var express = require('express');
var request = require('request');
var app = express();
var port = process.env.PORT || 8080; //for Heroku

var mClient = require('mongodb').MongoClient;

//make DB access link safe
var dbUrl = process.env.MONGOLAB_URI;
var api_key = process.env.KEY;
var app_id = process.env.ID;

//answer to homepage requests
app.use('/', express.static(__dirname + '/public'));

app.get('/api/(*)', function(req, res){
  //cut /api/ from request url for further use
  var reqUrl = req.url.substr(5);
  
  var query = '';
  //check if offset is present
  var pgNum = '';
  var x = reqUrl.search(/offset=/i);
  
  //if there is offset requested
  if (x !== -1) {
    query += reqUrl.substr(0, (x - 1));
    pgNum += '&start=' + reqUrl.substr(x + 7);
  }
  //if there is no offset requested
  else
    query = reqUrl;
  
  //create api link and add pagination (&start) if required
  var link = 'https://www.googleapis.com/customsearch/v1?searchType=image&key=';
  link += api_key + '&cx=' + app_id + '&q=' + query + pgNum;

  //enter search query/timestamp into the db
  mClient.connect(dbUrl, function(err, db){
    if (err) throw err;
    
    db.collection('search')
    .insert({ query : query, time : Date(), timestamp : Date.now()});
    
    db.close();
  });

  //get data from search engine api
  request(link, function(error, response, body){
    if (error) throw error;
    //because response body is a string
    var srchRslt = JSON.parse(body);
    //notify user if daily usage limit has been exceeded
    if(srchRslt.hasOwnProperty('error')) {
      res.send(srchRslt.error);
      return;
    }
    
    var reply = [];
    //pick relevant data from search results and store in array
    for (var i = 0; i < srchRslt.items.length; i++) {
     //build object with image data
     var prop = {
       'url' : srchRslt.items[i].link,
       'snippet' : srchRslt.items[i].snippet,
       'thumbnail' : srchRslt.items[i].image.thumbnailLink, 
       'context' : srchRslt.items[i].image.contextLink
     };
     //add object to response
      reply.push(prop);
    }
    //send prepared array back to client
    res.send(reply);
  });
});

app.get('/latest/', function(req, res){
  
  mClient.connect(dbUrl, function(err, db){
    if (err) throw err;
    
    var col = db.collection('search');
    
    col.find({}, { _id : 0}).sort({timestamp: -1}).limit(5).toArray()
    .then(function(data){
      res.send(data);  
      db.close();
    });
  });
});

//start server
app.listen(port, function () {
  console.log('Image search app listening on port ' + port);
});
