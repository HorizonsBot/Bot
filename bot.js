var axios = require('axios');
var mongoose = require('mongoose');
var models = require('./models');
var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var WebClient = require('@slack/client').WebClient;

var token = process.env.SLACK_SECRET || '';
var web = new WebClient(token);
var rtm = new RtmClient(token);
rtm.start();

var {taskPath, taskHandler, taskFunction} = require('./functions/task')(rtm, web);
var {meetingHandler, meetingFunction, setInvitees, meetingPath, findAttendees} = require('./functions/meeting')(rtm, web);

// event listener on every slack message
rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {

  // get the message. if there is no message, end the action
  var dm = rtm.dataStore.getDMByUserId(message.user);
  if (!dm || dm.id !== message.channel || message.type !== 'message') {
    return;
  }

  var u = rtm.dataStore.getUserById(message.user);

  // check for existing user with this slack info
  models.User.findOne({slack_ID: message.user})
  .then(function(user){
      if(!user){    // if user not found, create new entry with given slack information
        var user = new models.User({
          default_meeting_len: 30,
          slack_ID: message.user,
          slack_Username: u.profile.real_name,
          slack_Email: u.profile.email,
          slack_DM_ID: message.channel
        })
        return user.save();
      } else {    // if user is found, return that user
        return user;
      }
  })
  .then(function(user){
      if(!user.googleAccount.access_token){   // if user has not authorized google, send them a link to do that
          web.chat.postMessage(message.channel,
              'Use this link to give access to your google cal account ' + process.env.DOMAIN + '/connect?auth_id='
              + user._id);
          return;
      } else {    // if they have authorized google, #TODO explain this branch further

          if(message.text.indexOf('schedule')!==-1){    //#TODO this is not good. only sets invitees if the message included schedule
            // message.text becomes a string of real names for slack users separated by ' '
            // state (aka pendingstate) is updated with invitees slackids
            message.text = setInvitees(message.text, user.pendingState);
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
              meetingFunction(data, message, user);
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
