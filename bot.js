require('./app');

// CONNECTING TO MONGOOSE DB
var mongoose = require('mongoose');
var models = require('./models');


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

  axios.get(`https://api.api.ai/api/query?v=20150910&query=${temp}&lang=en&sessionId=${message.user}`,{
    "headers": {
      "Authorization":"Bearer 678861ee7c0d455287f791fd46d1b344"
    },
  })
  .then(function({ data }){

    //CHECK IF THEY ARE IN MONGO AS HAVING REGISTERED GOOGLE
    mongoose.connection.on('connected', function() {

      //CHECK FOR USER OR CREATE ONE
      models.User.findOne({slack_ID: message.user}, function(err, user){
        if(err){
          console.log('ERR', err);
        }

        if(!user){
          //add something to the database
          var user = new models.User({
            googleAccount: {
              access_token: null,
              refresh_token: null,
              profile_ID: null
            },
            slack_ID: message.user,
            slack_Username: null,
            slack_Email: null,
            slack_DM_ID: null
          })

          user.save(function(err){
            if(err){
              console.log(err)
            }else{
              console.log('NO USER EXISTED. CREATED ONE IN DATABASE');
              models.User.findOne({slack_ID: message.user}, function(err, user){
                if(err){
                  console.log('ERR', err);
                }

                if(user){
                  web.chat.postMessage(message.channel, 'Use this link to give access to your google cal account http://localhost:3000/connect?auth_id=' + user._id);
                }

              })
            }
          });

        }

        //close connection
        mongoose.connection.close();
      })


      console.log(data);
      if(!data.result.actionIncomplete && data.result.parameters.date && data.result.parameters.subject){
        obj.attachments[0].text = data.result.fulfillment.speech;
        web.chat.postMessage(message.channel, "Confirm this request", obj,function(err, res) {
          if (err) {
            console.log('Error:', err);
          } else {
            console.log('Message sent: ', res);
          }
        });
      }

    });

    mongoose.connection.on('error', function() {
      console.log('Error connecting to MongoDb.');
    });

    mongoose.connect(process.env.MONGODB_URI);



  })
  .catch(function(error){
      console.log(error);
    })

});

rtm.on(RTM_EVENTS.REACTION_ADDED, function handleRtmReactionAdded(reaction) {
  console.log('Reaction added:', reaction);
});

rtm.on(RTM_EVENTS.REACTION_REMOVED, function handleRtmReactionRemoved(reaction) {
  console.log('Reaction removed:', reaction);
});
