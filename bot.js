require('./app');

// CONNECTING TO MONGOOSE DB
var mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);
var models = require('./models');

var { RtmClient, WebClient, CLIENT_EVENTS, RTM_EVENTS } = require('@slack/client');
var axios = require('axios');

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

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  var dm = rtm.dataStore.getDMByUserId(message.user);
  console.log("DM--------", dm, "MESSAGE", message);
  if (!dm || dm.id !== message.channel || message.type !== 'message') {
    console.log('Message not send to DM, ignoring');
    return;
  }

  var temp = encodeURIComponent(message.text);
  //CHECK IF THEY ARE IN MONGO AS HAVING REGISTERED GOOGLE
  var u = rtm.dataStore.getUserById(message.user);

  //CHECK FOR USER OR CREATE ONE
  models.User.findOne({slack_ID: message.user})
  .then(function(user){
    if(!user){
      var user = new models.User({
        slack_ID: message.user,
        slack_Username: u.profile.real_name,
        slack_Email: u.profile.email,
        slack_DM_ID: message.channel
      })
      return user.save();
    }
    return user;
  })
  .then(function(user){
    if(!user.googleAccount.access_token){
      //submit the link to grant access
      web.chat.postMessage(message.channel,
        'Use this link to give access to your google cal account http://localhost:3000/connect?auth_id='
        + user._id);
        return;
      }
      // rtm.sendMessage("hello i am seeing and replying to your meesage", message.channel);
      axios.get('https://api.api.ai/api/query', {
        params: {
          v: 20150910,
          lang: 'en',
          timezone: '2017-07-17T16:58:21-0700',
          query: message.text,
          sessionId: message.user
        },
        headers: {
          Authorization: `Bearer ${process.env.API_AI_TOKEN}`
        }
      })
      .then(function( {data} ) {
        console.log("DATA", data);
        if(!data.result.actionIncomplete && data.result.parameters.date && data.result.parameters.subject ) {
          // rtm.sendMessage(data.result.fulfillment.speech, message.channel);
          web.chat.postMessage(message.channel, 'Ok', imReply(data), function(err, res) {
            if (err) {
              console.log('Error:', err);
            } else {
              console.log('Message sent: ', res);
            }
          });
        } else {
          console.log("ACTION IS COMPLETE");
        }
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
