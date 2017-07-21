var axios = require('axios');
var mongoose = require('mongoose');
var models = require('./models');
var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var WebClient = require('@slack/client').WebClient;

// RTM with Slack
var token = process.env.SLACK_SECRET || '';
var web = new WebClient(token);
var rtm = new RtmClient(token);

/* TASK */
var {taskPath, taskHandler, taskFunction} = require('./functions/task')(rtm, web);

/* MEETING */
var {meetingHandler, meetingFunction, setInvitees, meetingPath, findAttendees} = require('./functions/meeting')(rtm, web);


// EVENT LISTENER on EVERY SLACK MEESAGE
rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {

  var dm = rtm.dataStore.getDMByUserId(message.user);

  if (!dm || dm.id !== message.channel || message.type !== 'message') {
    return;
  }

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
          'Use this link to give access to your google cal account ' + process.env.DOMAIN + '/connect?auth_id='
          + user._id);
          return;
      }
      else {

          if(message.text.indexOf('schedule')!==-1){
            message.text = setInvitees(message.text , user.pendingState);
            user.save();
          }

          var temp = encodeURIComponent(message.text);

          axios.get(`https://api.api.ai/api/query?v=20150910&query=${temp}&lang=en&sessionId=${message.user}`, {
            "headers": {
              "Authorization":"Bearer 678861ee7c0d455287f791fd46d1b344"
            },
          })
          .then(function({ data }){

            if(message.text.indexOf("schedule")!==-1){
              meetingFunction(data, message, user); //cccccc

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


module.exports = {
  rtm,
  web,
  taskPath
}
