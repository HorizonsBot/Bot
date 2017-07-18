var express = require('express');
var app = express();
var bodyParser = require('body-parser');
require('./bot');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', function(req,res){
  res.send("reached home");
})

app.post('/bot-test', function(req,res){
  console.log("reached here successfully");
  console.log(req.body);
})

app.listen(3000);
