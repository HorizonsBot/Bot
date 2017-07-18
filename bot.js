//GIT FROM ATOM
require('./app');

// CONNECTING TO MONGOOSE DB
var mongoose = require('mongoose');
var models = require('./models');
mongoose.connect(process.env.MONGODB_URI);


var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var WebClient = require('@slack/client').WebClient;


// INTERACTIVE MESSAGE PRACTICE
var axios = require('axios');

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



var token = process.env.SLACK_SECRET || '';
var web = new WebClient(token);
var rtm = new RtmClient(token);
rtm.start();

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  var dm = rtm.dataStore.getDMByUserId(message.user);
  //console.log(dm, message);
  if (!dm || dm.id !== message.channel || message.type !== 'message') {
    return;
  }
  console.log('Message:', message);
  var temp = encodeURIComponent(message.text);

  //CHECK IF THEY ARE IN MONGO AS HAVING REGISTERED GOOGLE
  var u = rtm.dataStore.getUserById(message.user);

  //CHECK FOR USER OR CREATE ONE
  models.User.findOne({slack_ID: message.user})
  .then(function(user){
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
    if(!user.googleAccount.access_token){
      //submit the link to grant access
      web.chat.postMessage(message.channel,
        'Use this link to give access to your google cal account http://localhost:3000/connect?auth_id='
        + user._id);

      return;
    }

    // CONNECT TO API.AI NOW THAT YOU HAVE SET UP GOOGLE SHIT
    console.log('AT THE API.AI REQUEST PART');

    var curTime = Date.now();
    //console.log("CURRENT TIME " + curTime + ' ' + typeof(curTime));

    //FIND MONGODB ENTRY TO GET TOKENS AND EXPIRY DATE
    models.User.findOne({slack_ID: message.user})
    .then(function(user){
      if(curTime > user.googleAccount.expiry_date){
        /* CODE HERE TO REFRESH ACCESS TOKEN */
      }else{
        console.log('token still good homie');

        //create calendar event here

      }
    })


    // *** PUT THIS IN A ROUTE AND CALL THE ROUTE HERE
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
