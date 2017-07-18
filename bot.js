var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var WebClient = require('@slack/client').WebClient;
<<<<<<< HEAD

// INTERACTIVE MESSAGE PRACTICE
=======
var axios = require('axios');
>>>>>>> master
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
