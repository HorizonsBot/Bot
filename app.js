var express = require('express');
var axios = require('axios');
var bodyParser = require('body-parser');
var google = require('googleapis');
var mongoose = require('mongoose');
var models = require('./models');
var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var WebClient = require('@slack/client').WebClient;

var token = process.env.SLACK_SECRET || '';
var web = new WebClient(token);
var rtm = new RtmClient(token);
var app = express();
rtm.start();

var OAuth2 = google.auth.OAuth2;
mongoose.connect(process.env.MONGODB_URI);


// REQUIRED SOURCE CHECKS
var REQUIRED_ENV = "SLACK_SECRET MONGODB_URI GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET DOMAIN".split(" ");

REQUIRED_ENV.forEach(function(el) {
  if (!process.env[el]){
    console.error("Missing required env var " + el);
    process.exit(1);
  }
});


// INTERACTIVE MESSAGE
var obj = {
    "attachments": [
        {
            "text": "Is this ok?",
            "fallback": "You are unable to choose a game",
            "callback_id": "wopr_game",
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
    ]
}


rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {

  var dm = rtm.dataStore.getDMByUserId(message.user);

  if (!dm || dm.id !== message.channel || message.type !== 'message') {
    return;
  }

  //console.log('Message:', message);
  var temp = encodeURIComponent(message.text);

  //CHECK IF THEY ARE IN MONGO AS HAVING REGISTERED GOOGLE
  var u = rtm.dataStore.getUserById(message.user);

  //CHECK FOR USER OR CREATE ONE
  models.User.findOne({slack_ID: message.user})
  .then(function(user){
    //SET UP INITIAL SLACK INFO IN MONGO
    if(!user){
      var user = new models.User({
        default_meeting_len: 30,
        slack_ID: message.user,
        slack_Username: u.profile.real_name,
        slack_Email: u.profile.email,
        slack_DM_ID: message.channel
      })
      return user.save();
    }else{
      return user;
    }
  })
  .then(function(user){
    //AUTHORIZE GOOGLE ACCOUNT LINK
    if(!user.googleAccount.access_token){
      web.chat.postMessage(message.channel,
        'Use this link to give access to your google cal account http://localhost:3000/connect?auth_id='
        + user._id);
      return;
    }

    // CONNECT TO API.AI NOW THAT YOU HAVE SET UP GOOGLE SHIT
    var curTime = Date.now();
    console.log("CURRENT TIME " + curTime);

    //FIND MONGODB ENTRY TO GET TOKENS AND EXPIRY DATE (maybe this goes in a route too)
    models.User.findOne({slack_ID: message.user})
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


    // *** PUT THIS IN A ROUTE AND CALL THE ROUTE above with the calendar shit
    // for now we are just working on making an event

    // axios.get(`https://api.api.ai/api/query?v=20150910&query=${temp}&lang=en&sessionId=${message.user}`,{
    //   "headers": {
    //     "Authorization":"Bearer 678861ee7c0d455287f791fd46d1b344"
    //   },
    // })
    // .then(function({ data }){
    //     console.log(data);
    //     if(!data.result.actionIncomplete && data.result.parameters.date && data.result.parameters.subject){
    //       obj.attachments[0].text = data.result.fulfillment.speech;
    //       web.chat.postMessage(message.channel, "Confirm this request", obj,function(err, res) {
    //         if (err) {
    //           console.log('Error:', err);
    //         } else {
    //           console.log('Message sent: ', res);
    //         }
    //       });
    //     }
    //
    //   });
      // =================

  }).catch(function(error){
      console.log(error);
  })
});


rtm.on(RTM_EVENTS.REACTION_ADDED, function handleRtmReactionAdded(reaction) {
  console.log('Reaction added:', reaction);
});

rtm.on(RTM_EVENTS.REACTION_REMOVED, function handleRtmReactionRemoved(reaction) {
  console.log('Reaction removed:', reaction);
});
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

  res.send(200);

})


var port = process.env.PORT || 3000;
app.listen(port);
console.log('Express started. Listening on port %s', port);
