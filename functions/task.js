var axios = require('axios');
var objects = require('../objects/index.js');
var mongoose = require('mongoose');
var models = require('../models');

var obj = objects.obj;


module.exports = function(rtm, web) {

  var taskPath = function(user, state){

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
          console.log("reached here buddy");
          return flag;
        })
        .catch(function(err){
          console.log(err);
        })
      }

  }

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

  return {
    taskPath: taskPath,
    taskHandler: taskHandler,
    taskFunction: taskFunction
  }
}
