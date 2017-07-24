// PACKAGES
var { web, rtm, taskPath } = require('./bot.js');
var express = require('express');
var bodyParser = require('body-parser');
var google = require('googleapis');
var moment = require('moment');
moment().format();
var mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);

/* GENERAL FUNCTIONS */
var {clearState, googleAuth, calculateStartTimeString, calculateEndTimeString} = require('./functions/general.js');

/* CONFLICT FUNCTIONS */
var {getWeekArray, cutWeekArray, limitWeekArray, checkConflict, getAlternativeTimes} = require('./functions/conflict.js');

// REQUIRED SOURCE CHECKIES
var REQUIRED_ENV = "SLACK_SECRET MONGODB_URI GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET DOMAIN".split(" ");

REQUIRED_ENV.forEach(function(el) {
  if (!process.env[el]){
    console.error("Missing required env var " + el);
    process.exit(1);
  }
});

// STARTING EXPRESS SERVER
var app = express();

// GOOGLE STUFF
var plus = google.plus('v1')
var OAuth2 = google.auth.OAuth2;
var models = require('./models');

// ROUTES
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.get('/connect', function(req, res){
  var oauth2Client = googleAuth();
  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar',
      'email'
    ],
    state: encodeURIComponent(JSON.stringify({
      auth_id: req.query.auth_id
    }))
  });

  res.redirect(url);
})
app.get('/connect/callback', function(req, res){
  var oauth2Client = googleAuth();
  oauth2Client.getToken(req.query.code, function (err, tokens) {
    // Now tokens contains an access_token and an optional refresh_token. Save them.
    oauth2Client.setCredentials(tokens);

    plus.people.get({auth: oauth2Client, userId: 'me'}, function(err, googleUser) {

      //UPDATE GOOGLE CREDENTIALS FOR USER
      var state = JSON.parse(decodeURIComponent(req.query.state))

      models.User.findByIdAndUpdate(state.auth_id, {
        googleAccount: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          profile_ID: googleUser.id,
          expiry_date: tokens.expiry_date,
          profile_name: googleUser.displayName,
          email: googleUser.emails[0].value
        }
      })
      .then(function(user){
        // user.save();
        res.send('SUCCESSFULLY CONNECTED');
      })
      .catch(function(err){
        console.log('ERROR ' + err);
      })
    })

  });

})
app.post('/bot-test', function(req,res) {

  var data = JSON.parse(req.body.payload);
  console.log("*************reached here******************", data);

  if(data.actions[0].value==="cancel"){
      models.User.findOne({slack_ID: JSON.parse(req.body.payload).user.id})
      .then(function(user){
        clearState(user)
      })
      res.send("Your request has been cancelled. " + ':pray: :100: :fire:');
  }

  else{
      var curTime = Date.now();
      //console.log("*****STATE****", user.pendingState);
      models.User.findOne({slack_ID: JSON.parse(req.body.payload).user.id})
      .then(function(user){
        console.log("*****STATE****", user.pendingState);
        if(curTime > user.googleAccount.expiry_date){
          console.log("access_token has expired", user);
          var googleAuthV = googleAuth();
          googleAuthV.setCredentials(user.googleAccount);
          return new Promise(function(resolve, reject) {
            googleAuthV.refreshAccessToken(function(err, tokens) {
              console.log("enters this function first...", tokens);
              user.googleAccount = tokens;
              user.save(function(err) {
                if(err){
                  console.log("blah blah err", err);
                  reject(err);
                } else {
                  console.log("no error");
                  resolve(err);
                }
              });
            });
          })
          .then(function(user){
            console.log("this is second console before final console", user);
            return user;
          })
        }
        else{
          console.log('token still good homie');
          return user;
        }
      })
      .then(function(user) {
          var state = user.pendingState;
          //POST TASK OR MEETING TO GOOGLE CAL
          if(state.invitees.length === 0){
            //POST TASK
            taskPath(user, state).then((flag) => {
              if(flag){
                clearState(user);
                res.send("Task has been added to your calendar " + ':pray: :100: :fire:');
              }else{
                clearState(user);
                res.send("Failed to post task to calendar")
              }
            });
          }  //for task
          else{ // for meeting
            //POST MEETING
            if(data.actions[0].name==='alt_dates'){
              console.log("i want this", data.actions[0].selected_options );
              var mo = data.actions[0].selected_options[0];
              var mo1 = mo.value.split(' ');
              user.pendingState.date = mo1[0];
              user.pendingState.time = mo1[1] + ":00";
              user.save(function(err,user){
                meetingPath(user, user.pendingState).then((flag) => {
                  console.log("FLAG", flag);
                  if(flag){
                    clearState(user);
                    res.send("Meeting has been added to your calendar " + ':pray: :100: :fire:');
                  }else{
                    clearState(user);
                    res.send("Failed to post meeting to calendar")
                  }
                });
              });
            } // for meeting with conflicts
            else{
              meetingPath(user, state).then((flag) => {
                console.log("FLAG", flag);
                if(flag){
                  clearState(user);
                  res.send("Meeting has been added to your calendar " + ':pray: :100: :fire:');
                }else{
                  clearState(user);
                  res.send("Failed to post meeting to calendar")
                }
              });
            } //for meeting without conflicts
          }
      })
      .catch(function(error){
        console.log("********error********", error);
      })
    }
})

app.listen(3000);
