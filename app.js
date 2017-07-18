var express = require('express');
var OAuth2 = require('client-oauth2')

// REQUIRED SOURCE CHECKS
var REQUIRED_ENV = "SLACK_SECRET MONGODB_URI".split(" ");

REQUIRED_ENV.forEach(function(el) {
  if (!process.env[el]){
    console.error("Missing required env var " + el);
    process.exit(1);
  }
});

// RUNNING SERVER
var app = express();
var bodyParser = require('body-parser');

/* BOT CODE */
require('./bot');
/* ******** */


app.get('/connect', function(req, res){

//IMPLEMENT THIS CORRECTLY
  // var oauth2Client = new OAuth2(
  //   process.env.GOOGLE_CLIENT_ID,
  //   process.env.GOOGLE_CLIENT_SECRET,
  //   process.env.DOMAIN + '/connect/callback'
  // );
  //
  // var url = oauth2Client.generateAuthUrl({
  //   access_type: 'offline',
  //   prompt: 'consent',
  //   scope: [
  //     'https://www.googleapis.com/auth/userinfo.profile',
  //     'https://www.googleapis.com/auth/calendar'
  //   ],
  //   state: encodeURIComponent(JSON.stringify({
  //     auth_id: req.query.auth_id
  //   }))
  // });
  //
  // res.redirect(url);

  res.redirect('/connect/callback')
})



app.get('/connect/callback', function(req, res){

  res.send(200)

})


var port = process.env.PORT || 3000;
app.listen(port);
console.log('Express started. Listening on port %s', port);
