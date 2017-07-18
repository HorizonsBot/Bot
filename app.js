var express = require('express');
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var { User } = require('./models');

// REQUIRED SOURCE CHECKS
var REQUIRED_ENV = "SLACK_SECRET MONGODB_URI GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET DOMAIN".split(" ");

REQUIRED_ENV.forEach(function(el) {
  if (!process.env[el]){
    console.error("Missing required env var " + el);
    process.exit(1);
  }
});

// RUNNING SERVER
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

/* BOT CODE */
var { rtm } = require('./bot');
/* ******** */

function getGoogleAuth() {
  return new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.DOMAIN + '/connect/callback'    //redirect url
  );
}

app.get('/connect', function(req, res){
  var userId = req.query.auth_id;
  if (!userId) {
    res.status(400).send("Missing user id");
  } else {
    User.findById(userId)
    .then(function(user){
      if (!user) {
        res.status(404).send("Cannot find user");
      } else {
        var googleAuth = getGoogleAuth();
        var url = googleAuth.generateAuthUrl({
          access_type: 'offline',     //'online' (default) or 'offline' (gets refresh_token)
          prompt: 'consent',
          scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/calendar'
          ],    // generate a url that asks permissions for Google+ and Google Calendar scopes
          // state: encodeURIComponent(JSON.stringify({
          //   auth_id: req.query.auth_id
          // }))     // Optional property that passes state parameters to redirect URI
          state: userId
        });
        res.redirect(url);
      }
    })
  }
})

app.get('/connect/callback', function(req, res){
  var googleAuth = getGoogleAuth();
  googleAuth.getToken(req.query.code, function (err, tokens) {
    console.log(tokens);
    // Now tokens contains an access_token and an optional refresh_token. Save them.
    if (err) {
      res.status(500).json({error: err});
    } else {
      googleAuth.setCredentials(tokens);
      var plus = google.plus('v1');
      plus.people.get({auth: googleAuth, userId: 'me'}, function(err, googleUser) {
        if (err) {
          res.status(500).json({error: err});
        } else {
          User.findById(req.query.state)
          .then(function(mongoUser){
            mongoUser.googleAccount = tokens;
            mongoUser.googleAccount.expiry_date = tokens.expiry_date;
            mongoUser.googleAccount.profile_ID = googleUser.id;
            mongoUser.googleAccount.profile_name = googleUser.displayName;
            return mongoUser.save();
          })
          .then(function(mongoUser){
            res.send('You are connected to Google Calendar');
            rtm.sendMessage('You are connected to Google Calendar', mongoUser.slack_DM_ID)
          })
        }
      })
    }
  });
})

app.post('/slack/interactive', function(req, res){
  var payload = JSON.parse(req.body.payload);
  console.log("PAYLOAD", payload);
  var timeNow = Date.now();
  if(payload.actions[0].value === 'yes') {
    res.send('Created reminder :white_check_mark:');

    // CONNECT TO API.AI NOW THAT YOU HAVE SET UP GOOGLE SHIT
    var curTime = Date.now();
    console.log("CURRENT TIME " + curTime);
    //FIND MONGODB ENTRY TO GET TOKENS AND EXPIRY DATE (maybe this goes in a route too)
    User.findOne({slack_DM_ID: payload.channel.id})
    .then(function(user){
      if(curTime > user.googleAccount.expiry_date){
        /* CODE HERE TO REFRESH ACCESS TOKEN */
        return;
      }else{
        console.log('token still good homie');
        return user;
      }
    })
    .then(function(user){
      //POST MESSAGE TO GOOGLE CALENDAR
      if(user){
        //create calendar event here
        var new_event = {
           "end": {
            "date": "2017-07-19"
           },
           "start": {
            "date": "2017-07-19"
           },
           "description": "you are a gawd",
           "summary": "EVENT1"
        }

        axios.post(`https://www.googleapis.com/calendar/v3/calendars/primary/events?access_token=${user.googleAccount.access_token}`, new_event)
        .then(function(response){
            console.log('SUCCESSFULLY POSTED TO CALENDAR');
        })
        .catch(function(err){
            console.log(err);
        })
      }
    })


  } else {
    res.send('Cancelled :x:');
  }
})


var port = process.env.PORT || 3000;
app.listen(port);
console.log('Express started. Listening on port %s', port);


module.exports = app;
