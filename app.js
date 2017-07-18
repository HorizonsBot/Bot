var express = require('express');
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;

var models = require('./models');

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
  process.env.DOMAIN + '/connect/callback'
);

app.get('/connect', function(req, res){

  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar'
    ],
    state: encodeURIComponent(JSON.stringify({
      auth_id: req.query.auth_id
    }))
  });

  res.redirect(url);

})



app.get('/connect/callback', function(req, res){

  oauth2Client.getToken(req.query.code, function (err, tokens) {
    // Now tokens contains an access_token and an optional refresh_token. Save them.
    if (!err) {
      //console.log("TOKENS " + tokens);
      oauth2Client.setCredentials(tokens);      //why do we need this <<--??

      //UPDATE GOOGLE CREDENTIALS FOR USER
      var state = JSON.parse(decodeURIComponent(req.query.state))
      //console.log("STATE " + JSON.stringify(state));

      models.User.findByIdAndUpdate(state.auth_id, {
        googleAccount: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          profile_ID: tokens.id_token,
          expiry_date: tokens.expiry_date
        }
      })
      .then(function(user){
        user.save();
      })
      .catch(function(err){
        console.log('ERROR ' + err);
      })

    }

});


  res.send(200)

})


var port = process.env.PORT || 3000;
app.listen(port);
console.log('Express started. Listening on port %s', port);
