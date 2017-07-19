var express = require('express');
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var { User } = require('./models');
var axios = require('axios');

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
// CONNECTING TO MONGO_DB
var mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);
var { RtmClient, WebClient, CLIENT_EVENTS, RTM_EVENTS } = require('@slack/client');

function imReply(data) {
  return ({"attachments": [
    {
      "text": `Creating a reminder for '${data.result.parameters.subject}' on ${data.result.parameters.date}`,
      "fallback": "You are unable to create reminder",
      "callback_id": "reminder",
      "color": "#3AA3E3",
      "attachment_type": "default",
      "actions": [
        {
          "name": "confrim",
          "text": "Yes",
          "type": "button",
          "value": "yes"
        },
        {
          "name": "confirm",
          "text": "No",
          "type": "button",
          "value": "no"
        },
      ]
    }
  ]})
}

var token = process.env.SLACK_SECRET || '';
var web = new WebClient(token);
var rtm = new RtmClient(token);
rtm.start();

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  console.log(`logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);
})

var pendingState = {
  subject: "",
  date: ""
};

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  var dm = rtm.dataStore.getDMByUserId(message.user);
  console.log("DM--------", dm, "MESSAGE-------", message);
  if (!dm || dm.id !== message.channel || message.type !== 'message') {
    console.log('Message not send to DM, ignoring');
    return;
  }
  //CHECK IF THEY ARE IN MONGO AS HAVING REGISTERED GOOGLE
  var u = rtm.dataStore.getUserById(message.user);
  //CHECK FOR USER OR CREATE ONE
  User.findOne({slack_ID: message.user})
  .then(function(user){
    //SET UP INITIAL SLACK INFO IN MONGO
    if(!user){
      return new User({
        default_meeting_len: 30,
        slack_ID: message.user,
        slack_DM_ID: message.channel,
        slack_Username: u.profile.real_name,
        slack_Email: u.profile.email,
      }).save();
    }
    return user;
  })
  .then(function(user){
    console.log("USER IS", user);
    if(!user.googleAccount){
      //submit the link to grant Google access
      rtm.sendMessage("Hello This is Scheduler bot. In order to schedule reminders for you, I need access to you Google calendar", message.channel);
      web.chat.postMessage(message.channel,
        'Use this link to give access to your google cal account http://localhost:3000/connect?auth_id='
        + user._id);
        return;
      }

      axios.get('https://api.api.ai/api/query', {
        params: {
          v: 20150910,
          lang: 'en',
          // timezone: '2017-07-17T16:58:21-0700',
          query: message.text,
          sessionId: message.user
        },
        headers: {
          Authorization: `Bearer ${process.env.API_AI_TOKEN}`
        }
      })
      .then(function( { data } ) {
        console.log("DATA", data, "DATA-messages", data.result.fulfillment.messages);
        if(!data.result.actionIncomplete && data.result.parameters.date && data.result.parameters.subject ) {
          // rtm.sendMessage(data.result.fulfillment.speech, message.channel);
          pendingState = data.result.parameters;
          web.chat.postMessage(message.channel, 'Chill homie', imReply(data), function(err, res) {
            if (err) {
              console.log('Error:', err);
            } else {
              console.log('Message sent: ', res);
            }
          });
        } else if(data.result.parameters.date && !data.result.parameters.subject){
          console.log('NO SUBJECT');
          pendingState.date = data.result.parameters.date;
          rtm.sendMessage(data.result.fulfillment.speech, message.channel);
        } else if(data.result.parameters.subject && !data.result.parameters.date){
          console.log('NO DATE');
          pendingState.subject = data.result.parameters.subject;
          rtm.sendMessage(data.result.fulfillment.speech, message.channel);
        } else {
          rtm.sendMessage(data.result.fulfillment.speech, message.channel);
        }
        console.log("HOW IS PENDING STATE LOOKING RIGHT NOW? HMM?", pendingState);
        return pendingState;
      })
      .catch(function(err) {
        console.log("ERROR", err);
      })

    });
  });

  rtm.on(RTM_EVENTS.REACTION_ADDED, function handleRtmReactionAdded(reaction) {
    console.log('Reaction added:', reaction);
  });

  rtm.on(RTM_EVENTS.REACTION_REMOVED, function handleRtmReactionRemoved(reaction) {
    console.log('Reaction removed:', reaction);
  });


function getGoogleAuth() {
  return new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.DOMAIN + '/connect/callback'    //redirect url
  );
}
var googleAuth = getGoogleAuth();

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
  googleAuth.getToken(req.query.code, function (err, tokens) {
    console.log("HERE ARE THE TOKENS", tokens);    // Now tokens contains an access_token and an optional refresh_token. Save them.
    if (err) {
      res.status(500).json({error: err});
    } else {
      googleAuth.setCredentials(tokens);
      var plus = google.plus('v1');
      plus.people.get({auth: googleAuth, userId: 'me'}, function(err, googleUser) {
        console.log("GOOGLEUSER! ME!", googleUser);
        if (err) {
          res.status(500).json({error: err});
        } else {
          User.findById(req.query.state)
          .then(function(mongoUser){
            mongoUser.googleAccount = tokens;
            mongoUser.googleAccount.profile_ID = googleUser.id;
            mongoUser.googleAccount.profile_name = googleUser.displayName;
            return mongoUser.save();
          })
          .then(function(mongoUser){
            res.send('You are connected to Google Calendar');    //To /connect/callback webpage
            rtm.sendMessage('You are connected to Google Calendar. Now set your first reminder by talking to me!', mongoUser.slack_DM_ID)    //To slack channel
          })
        }
      })
    }
  });
})

app.post('/slack/interactive', function(req, res){
  var payload = JSON.parse(req.body.payload);
  console.log("PAYLOAD", payload);
  if(payload.actions[0].value === 'yes') {
    // Manually delete user from MongoDB
    // User.remove({slack_DM_ID: payload.channel.id}, function(err) {
    //   if(err){
    //     console.log("error removing user", err);
    //   }
    // })

    res.send('Created reminder :white_check_mark:');

    // CONNECT TO API.AI NOW THAT YOU HAVE SET UP GOOGLE SHIT
    var curTime = Date.now();
    console.log("CURRENT TIME " + curTime);
    //FIND MONGODB ENTRY TO GET TOKENS AND EXPIRY DATE (maybe this goes in a route too)
    User.findOne({slack_DM_ID: payload.channel.id})
    .then(function(user){
      console.log("HERE HERE HERE HERE USER IS HERE", user);
      if(curTime > user.googleAccount.expiry_date){
        console.log('fuck did i make it here');
        console.log("BEFORE REFRESHING", user.googleAccount.access_token);
        googleAuth.refreshAccessToken(function(err, tokens) {
          console.log("REFRESHED token", tokens);
          user.googleAccount.access_token = tokens.access_token;
        });
        console.log("AFTER REFRESHING", user.googleAccount.access_token);
        return;
      }else{
        console.log('token still good homie');
        return user;
      }
    })
    .then(function(user){
      //POST MESSAGE TO GOOGLE CALENDAR
      if(user){
        console.log("CHECK PENDING STATE", pendingState);
        //create calendar event here
        var new_event = {
           "end": {
            "date": pendingState.date
           },
           "start": {
            "date": pendingState.date
           },
           "description": "you are a gawd",
           "summary": pendingState.subject
        }

        axios.post(`https://www.googleapis.com/calendar/v3/calendars/primary/events?access_token=${user.googleAccount.access_token}`, new_event)
        .then(function(response){
          console.log('SUCCESSFULLY POSTED TO CALENDAR');
          console.log('THIS IS THE INFORMATION THE USER HAS', user);
          console.log('this is the state', pendingState);
          var reminder = new Reminder({
            subject: pendingState.subject,
            day: pendingState.date,
            googCalID: user.googleAccount.profile_ID,
            reqID: user._id
          })
          console.log('this is the REMINDER', reminder);
          reminder.save(function(err) {
            if(err) {
              console.log("Error saving reminder, I cry", err);
            }
          });
          //reset pendingState
          pendingState = {
            date: '',
            subject: ''
          }
        })
        .catch(function(err){
            console.log(err);
        })
      }
    })
  } else {
    res.send('Cancelled :x: :pray: :100: :fire:');
  }
})


var port = process.env.PORT || 3000;
app.listen(port);
console.log('Express started. Listening on port %s', port);


module.exports = app;
