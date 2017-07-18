var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var WebClient = require('@slack/client').WebClient;
var mongoose = require('mongoose');
var axios = require('axios');
var token = process.env.SLACK_SECRET || '';
var web = new WebClient(token);
var rtm = new RtmClient(token);
rtm.start();

var mongoose = require('mongoose');

var connect = process.env.MONGODB_URI;

mongoose.connect(connect);


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
          "text": "Cancel",
          "type": "button",
          "value": "cancel"
        },
      ]
    }
  ]
}

var state = {
  subject: "",
  date: ""
};


var handlerFunction = function(data, message){
  console.log("here");
  if(data.result.parameters.date && data.result.parameters.subject){
    state.date = data.result.parameters.date; state.subject = data.result.parameters.subject;
    obj.attachments[0].text = `Subject:${state.subject} ---- Time:${data.result.parameters.date}`;
    web.chat.postMessage(message.channel, "Confirm this request", obj,function(err, res) {
      if (err) {
        console.log('Error:', err);
      } else {
        console.log('Message sent: ', res);
      }
    });
  }else if(data.result.parameters.date){
    state.date = data.result.parameters.date;
    rtm.sendMessage(data.result.fulfillment.speech, message.channel);
  }else if(data.result.parameters.subject){
    state.subject = data.result.parameters.subject;
    rtm.sendMessage(data.result.fulfillment.speech, message.channel);
  }
}

var responseFunction = function(){
  obj.attachments[0].text = `Subject:${state.subject} ---- Time:${data.result.parameters.date}`;
  web.chat.postMessage(message.channel, "Confirm this request", obj, function(err, res){
    if (err) {
      console.log('Error:', err);
    } else {
      console.log('Message sent: ', res);
    }
  })
}

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {

  var dm = rtm.dataStore.getDMByUserId(message.user);

  if (!dm || dm.id !== message.channel || message.type !== 'message') {
    return;
  }

  console.log('Message:', message);

  if(state.date && !state.subject){
    state.subject = message.text;
    responseFunction();
  }else if(state.subject && !state.date){
    state.date = message.text;
    responseFunction();
  }else if(state.date && state.subject){
    rtm.sendMessage("Reply to previous task status", message.channel);
  }

  var temp = encodeURIComponent(message.text);

  axios.get(`https://api.api.ai/api/query?v=20150910&query=${temp}&lang=en&sessionId=${message.user}`,{
    "headers": {
      "Authorization":"Bearer 678861ee7c0d455287f791fd46d1b344"
    },
  })
  .then(function({ data }){
    console.log(data);
    handlerFunction(data, message);
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


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', function(req,res){
  res.send("reached home");
})

app.post('/bot-test', function(req,res){
  console.log(req.body);
})

app.listen(3000);
