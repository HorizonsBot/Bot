var express = require('express');
var bodyParser = require('body-parser');
var google = require('googleapis');
var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var WebClient = require('@slack/client').WebClient;
var mongoose = require('mongoose');
var models = require('./models');
var axios = require('axios');


var token = process.env.SLACK_SECRET || '';
var web = new WebClient(token);
var rtm = new RtmClient(token);
var app = express();
var plus = google.plus('v1')
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

var obj = {
  "attachments": [
    {
      "text": "Is this ok?",
      "fallback": "",
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
          "text": "Cancel",
          "type": "button",
          "value": "cancel"
        },
      ]
    }
  ]
}

var state = {
  subject: '',
  date: '',
  invitees: [],
  time: '',
}

//task functions

var taskHandler = function({result}, message){
  if(result.parameters.date && result.parameters.subject){
    state.date = result.parameters.date; state.subject = result.parameters.subject;
    obj.attachments[0].text = `Create task to ${state.subject} on ${state.date}`;
    web.chat.postMessage(message.channel, "Scheduler Bot", obj,function(err, res) {
      if (err) {
        console.log('Error:', err);
      } else {
        console.log('Message sent: ', res);
      }
    });
  } else if(result.parameters.subject){
    state.subject = result.parameters.subject;
    rtm.sendMessage(result.fulfillment.speech, message.channel);
  } else if(result.parameters.date){
    state.date = result.parameters.date;
    rtm.sendMessage(result.fulfillment.speech, message.channel)
  }
}

var taskFunction = function(data, message){
  if(!state.date || !state.subject){
    taskHandler(data, message);
  } else if(state.date && state.subject){
    rtm.sendMessage("Reply to previous task status", message.channel);
  } else {
    taskHandler(data, message);
  }
}

//meeting functions

var meetingHandler = function({result}, message){

  // if all present execute if condition else go to else

  if(result.parameters.date && result.parameters.time && result.parameters.invitees[0]){
    //set state
    state.date = result.parameters.date;
    state.time = result.parameters.time;
    state.invitees = result.parameters.invitees;
    //create invite string
    var inviteString = "";
    state.invitees.forEach(function(item){
      inviteString = inviteString + " and " + item;
    })
    //create im
    obj.attachments[0].text = `Schedule meeting with ${inviteString} on ${state.date} ${state.time} about ${state.subject}`;
    web.chat.postMessage(message.channel, "Scheduler Bot", obj,function(err, res) {
      if (err) {
        console.log('Error:', err);
      } else {
        console.log('Message sent: ', res);
      }
    });
  }
  else {
    //check for all parameters
    if(result.parameters.subject){
      state.subject = result.parameters.subject;
    }
    if(result.parameters.date){
      state.date = result.parameters.date;
    }
    if(result.parameters.time){
      state.time = result.parameters.time;
    }
    if(result.parameters.invitees[0]){
    }
    rtm.sendMessage(result.fulfillment.speech, message.channel);
  }
}

var meetingFunction = function(data, message){
  if(!state.date || !state.invitees[0] || !state.time){
    meetingHandler(data, message);
  } else if(state.date && state.time && state.invitees[0]){
    rtm.sendMessage("Reply to previous task status", message.channel);
  } else {
    meetingHandler(data, message);
  }
}

// slack functions for recieving messages

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {

  var dm = rtm.dataStore.getDMByUserId(message.user);

  if (!dm || dm.id !== message.channel || message.type !== 'message') {
    return;
  }

  ////////////////////////////////////////////////ANDREWS FLOW HERE//////////////////////////////

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
    } else{
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
    else {

        console.log('the first time it gets here');

        var temp = encodeURIComponent(message.text);

        axios.get(`https://api.api.ai/api/query?v=20150910&query=${temp}&lang=en&sessionId=${message.user}`, {
          "headers": {
            "Authorization":"Bearer 678861ee7c0d455287f791fd46d1b344"
          },
        })
        .then(function({ data }){

          if(message.text.indexOf("schedule")!==-1){
            meetingFunction(data, message);
          }else{
            taskFunction(data, message);
          }

        })
        .catch(function(error){
          console.log(error);
        })

    }

  })
  .catch(function(error){
    console.log(error);
  })

})

rtm.on(RTM_EVENTS.REACTION_ADDED, function handleRtmReactionAdded(reaction) {
    console.log('Reaction added:', reaction);
});

rtm.on(RTM_EVENTS.REACTION_REMOVED, function handleRtmReactionRemoved(reaction) {
    console.log('Reaction removed:', reaction);
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var oauth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.DOMAIN + '/connect/callback'
);

// routes

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
            profile_name: googleUser.displayName
          }
        })
        .then(function(user){
          user.save();
        })
        .catch(function(err){
          console.log('ERROR ' + err);
        })
      })

    });

    res.send(`<script>
      window.close();
    </script>`);

})

app.get('/', function(req,res){
    res.send("reached home");
})

app.post('/bot-test', function(req,res){

    var data = JSON.parse(req.body.payload);
    console.log("*************reached here******************", data);


    if(data.actions[0].value==="cancel"){
      state.date = "";
      state.time = "";
      res.send("Your request has been cancelled. " + ':pray: :100: :fire:');
    }
    else{

      var curTime = Date.now();

      console.log(state);
      //FIND MONGODB ENTRY TO GET TOKENS AND EXPIRY DATE (maybe this goes in a route too)
      models.User.findOne({slack_ID: JSON.parse(req.body.payload).user.id})
      .then(function(user){
        if(curTime > user.googleAccount.expiry_date){
          console.log('fuck did i make it here');
          return;
        }else{
          console.log('token still good homie');
          return user;

    console.log(state);
    //FIND MONGODB ENTRY TO GET TOKENS AND EXPIRY DATE (maybe this goes in a route too)
    models.User.findOne({slack_ID: JSON.parse(req.body.payload).user.id})
    .then(function(user){
      if(curTime > user.googleAccount.expiry_date){
        console.log('fuck did i make it here');
        console.log("TOKENS BEFORE REFRESHING", tokens);
        oauth2Client.refreshAccessToken(function(err, tokens) {
          // your access_token is now refreshed and stored in oauth2Client
          // store these new tokens in a safe place (e.g. database)
          console.log("REFRESHED TOKENS", tokens);
          user.googleAccount.access_token = tokens.access_token;
        });
        return;
      }else{
        console.log('token still good homie');
        return user;
      }
    })
    //this part needs to be moved into the post request
    .then(function(user) {
      //POST MESSAGE TO GOOGLE CALENDAR
      if(user){
        //create calendar event here
        var new_event = {
          "end": {
            "date": state.date
          },
          "start": {
            "date": state.date
          },
          "description": "Chief Keef is a fucking legend",
          "summary": state.subject

        }
      })
      //this part needs to be moved into the post request
      .then(function(user) {
        //POST MESSAGE TO GOOGLE CALENDAR
        if(user){
          //create calendar event here
          var new_event = {
              "end": {
                "date": state.date
              },
              "start": {
                "date": state.date
              },
              "description": "Chief Keef is a fucking legend",
              "summary": state.subject
            }

          axios.post(`https://www.googleapis.com/calendar/v3/calendars/primary/events?access_token=${user.googleAccount.access_token}`, new_event)
          .then(function(response){
            console.log('SUCCESSFULLY POSTED TO CALENDAR');

            console.log('THIS IS THE INFORMATION THE USER HAS', user);
            console.log('this is the state', state);

            var reminder = new models.Reminder({
              subject: state.subject,
              day: state.date,
              googCalID: user.googleAccount.profile_ID,
              reqID: user.slack_ID
            })

            console.log('this is the REMINDER', reminder);

            reminder.save(function(err) {
              if(err) {
                console.log('there is an error', err);
              } else {
                console.log('YOUNG BUT IM MAKING MILLION TO WORK THE NIGHT SHIFT');
              }
            });

            state.date = "";
            state.time = "";
            res.send("Your calendar has been updated. " + ':pray: :100: :fire:');

          })
          .catch(function(err){
            console.log(err);
          })

        }

      })
    }

})

app.listen(3000);

module.exports = {
    rtm
}
