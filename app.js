var express = require('express');
var google = require('googleapis');
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
var oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.DOMAIN + '/connect/callback'    //redirect url
);

app.get('/connect', function(req, res){
  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline',     //'online' (default) or 'offline' (gets refresh_token)
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar'
    ],    // generate a url that asks permissions for Google+ and Google Calendar scopes
    state: encodeURIComponent(JSON.stringify({
      auth_id: req.query.auth_id
    }))     // Optional property that passes state parameters to redirect URI
  });
  res.redirect('/connect/callback')
})

app.get('/connect/callback', function(req, res){
  oauth2Client.getToken(code, function (err, tokens) {
  // Now tokens contains an access_token and an optional refresh_token. Save them.
  if (!err) {
    oauth2Client.setCredentials(tokens);
  }
});
  res.send(200)
})


app.post('/slack/interactive', function(req, res){
  var payload = JSON.parse(req.body.payload);
  console.log("PAYLOAD", payload);
  if(payload.actions[0].value === 'yes') {
    res.send('Created reminder :white_check_mark:');
  }
  res.send('Cancelled :x:');
})


var port = process.env.PORT || 3000;
app.listen(port);
console.log('Express started. Listening on port %s', port);


module.exports = app;
