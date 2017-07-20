var express = require('express');
var bodyParser = require('body-parser');
var google = require('googleapis');
var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var WebClient = require('@slack/client').WebClient;
var mongoose = require('mongoose');
var models = require('./models');
var axios = require('axios');
var moment = require('moment');
moment().format();


var token = process.env.SLACK_SECRET || '';
var web = new WebClient(token);
var rtm = new RtmClient(token);
var app = express();
var plus = google.plus('v1')
rtm.start();

var OAuth2 = google.auth.OAuth2;
mongoose.connect(process.env.MONGODB_URI);

// REQUIRED SOURCE CHECKIES
var REQUIRED_ENV = "SLACK_SECRET MONGODB_URI GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET DOMAIN".split(" ");

REQUIRED_ENV.forEach(function(el) {
  if (!process.env[el]){
    console.error("Missing required env var " + el);
    process.exit(1);
  }
});

// INTERACTIVE BUTTON OBJECT
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


// TASK FUNCTIONS

var taskHandler = function({result}, message, state){
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

var taskFunction = function(data, message, state){
  if(!state.date || !state.subject){
    taskHandler(data, message, state);
  } else if(state.date && state.subject){
    rtm.sendMessage("Reply to previous task status", message.channel);
  } else {
    taskHandler(data, message, state);
  }
}

// MEETING FUNCTIONS

var meetingHandler = function({result}, message, state){

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

var meetingFunction = function(data, message, state){
  if(!state.date || !state.invitees[0] || !state.time){
    meetingHandler(data, message, state);
  } else if(state.date && state.time && state.invitees[0]){
    rtm.sendMessage("Reply to previous task status", message.channel);
  } else {
    meetingHandler(data, message, state);
  }
}

var setInvitees = function(myString, state){

  var myArray = myString.split(' ');

  myArray.forEach(function(item,index){
    if(item[0]==='<'){
      item = item.substring(2,item.length-1);
      state.inviteesBySlackid.push(item);
      //console.log("reached here", item, rtm.dataStore.getUserById(item));
      myArray[index] = rtm.dataStore.getUserById(item).real_name;
    }
  });
  //console.log("this is new function", myArray);
  return myArray.join(' ');
}



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

          //console.log('the first time it gets here');

          if(message.text.indexOf('schedule')!==-1){
            //console.log("calling new function");
            message.text = setInvitees(message.text , user.pendingState);
            user.save();
            //message.text is a string of real life names
            //console.log("after function call", message.text);
          }

          if(message.text.indexOf('schedule')!==-1){
            console.log("calling new function");
            message.text = setInvitees(message.text , user.pendingState);
            user.save();
            //message.text is a string of real life names
            console.log("after function call", message.text);
          }

          var temp = encodeURIComponent(message.text);

          axios.get(`https://api.api.ai/api/query?v=20150910&query=${temp}&lang=en&sessionId=${message.user}`, {
            "headers": {
              "Authorization":"Bearer 678861ee7c0d455287f791fd46d1b344"
            },
          })
          .then(function({ data }){

            if(message.text.indexOf("schedule")!==-1){
              meetingFunction(data, message, user.pendingState);
              user.save();
            }else{
              taskFunction(data, message, user.pendingState);
              user.save();
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


// ROUTES
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function googleAuth() {
  return new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.DOMAIN + '/connect/callback'
  );
}

// routes

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

app.post('/bot-test', function(req,res){

  var data = JSON.parse(req.body.payload);
  console.log("*************reached here******************", data);

    if(data.actions[0].value==="cancel"){
      models.User.findOne({slack_ID: JSON.parse(req.body.payload).user.id})
      .then(function(user){
        user.pendingState = {
          subject: "",
          date: "",
          time: "",
          invitees: [],
          inviteesBySlackid: [],
        };
        user.save(function(err){
          if(err)console.log(err);
        });
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
          googleAuthV.refreshAccessToken(function(err, tokens) {
            console.log("enters this function first...", tokens);
            user.googleAccount = tokens;
            user.save(function(err) {
              if(err){
                console.log("blah blah err", err);
              } else {
                console.log("no error");
              }
              return user;
            })
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
                user.pendingState = {
                  subject: "",
                  date: "",
                  time: "",
                  invitees: [],
                  inviteesBySlackid: [],
                };
                user.save(function(err){
                  if(err)console.log(err);
                });
                res.send("Task has been added to your calendar " + ':pray: :100: :fire:');
              }else{
                res.send("Failed to post task to calendar")
              }
            });
          }else{
            //POST MEETING
            meetingPath(user, state).then((flag) => {
              console.log("FLAG", flag);
              if(flag){
                user.pendingState = {
                  subject: "",
                  date: "",
                  time: "",
                  invitees: [],
                  inviteesBySlackid: [],
                };
                user.save(function(err){
                  if(err)console.log(err);
                });
                res.send("Meeting has been added to your calendar " + ':pray: :100: :fire:');
              }else{
                res.send("Failed to post meeting to calendar")
              }
            });
          }

      })
      .catch(function(error){
        console.log("********error********", error);
      })
    }
})


// FUNCTIONS

function taskPath(user, state){

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
      return axios.post(`https://www.googleapis.com/calendar/v3/calendars/primary/events?access_token=${user.googleAccount.access_token}`, new_event)
      .then(function(response){

        console.log('RESPONSE', response.status);
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
            console.log('saved reminder in mongo');
          }
        });

        console.log(typeof response.status);

        if(response.status === 200){
          console.log('fuck you');
          return true;
        }else{
          console.log('yay');
          return false;
        }


      })
      .then(function(flag){
        console.log("reached here bitch");
        return flag;
      })
      .catch(function(err){
        console.log(err);
      })
    }

}

function findAttendees(state){

  return models.User.find({})
  .then(function(users){
    var attendees = [];

    users.forEach(function(item){
      var id = item.slack_ID;
      console.log(item);
      if(state.inviteesBySlackid.indexOf(id) !== -1){
          attendees.push({"email": item.googleAccount.email})
      }
    })
    console.log('INSIDE FIND ATTENDEES METHOD');
    console.log(attendees);
    return attendees;
  })

}


function calculateEndTimeString(state){
    //set up for default 30 minute meetings until api.ai is trained better
    var meetingLength = 60;

    var end =  state.date + 'T' + state.time;
    var endMoment = moment(end);
    endMoment.add(meetingLength, 'minute');
    return endMoment;
}

function calculateStartTimeString(state){
    var start =  state.date + 'T' + state.time;
    var startMoment = moment(start);
    return startMoment;
}

function meetingPath(user, state){

    var start = calculateStartTimeString(state);
    var end = calculateEndTimeString(state);
    var subject = state.subject || 'DEFAULT MEETING SUBJECT';

    if(user){
    return findAttendees(state)
    .then((attendees) => {
      console.log('ATTENDEES ARRAY: ', attendees);
      var new_event = {
        "end": {
          "dateTime": end,
          "timeZone": "America/Los_Angeles"
        },
        "start": {
          "dateTime": start,
          "timeZone": "America/Los_Angeles"
        },
        "summary": subject,
        "attendees": attendees
      //  "description": "ramma lamma ding dong. as always"
      }
      return axios.post(`https://www.googleapis.com/calendar/v3/calendars/primary/events?access_token=${user.googleAccount.access_token}`, new_event)
      .then(function(response){

        console.log('RESPONSE', response.status);
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
            console.log('saved reminder in mongo');
          }
        });

        if(response.status === 200){
          return true;
        }else{
          return false;
        }


      })
      .then(function(flag){
        return flag;
      })
      .catch(function(err){
        console.log(err);
      })
    })
    .then(flag=>{
      return flag;
    })
  }

}


app.listen(3000);

module.exports = {
  rtm
}
