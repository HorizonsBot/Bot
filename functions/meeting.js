var axios = require('axios');
var {dropdown_obj} = require('../objects');
var mongoose = require('mongoose');
var models = require('../models');


module.exports = function(rtm, web) {
  var meetingHandler = function({result}, message, user){ //ccccc

    // if all present execute if condition else go to else

    state = user.pendingState;

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

      user.save(function(err, user){
        console.log("enter here after setting pendingState");
        checkConflict(user).then(conflictFlag=>{
          console.log(conflictFlag);
          if(conflictFlag==='noConflict'){
            obj.attachments[0].text = `Schedule meeting with ${inviteString} on ${state.date} ${state.time} about ${state.subject}`;
            web.chat.postMessage(message.channel, "Scheduler Bot", obj,function(err, res) {
              if (err) {
                console.log('Error:', err);
              } else {
                console.log('Message sent: ', res);
              }
            });
          }else{
            console.log("entered conflict");
            var targetObj = getAlternativeTimes(conflictFlag);

            web.chat.postMessage(message.channel, "Scheduler Bot", targetObj,function(err, res) {
              if (err) {
                console.log('Error:', err);
              } else {
                console.log('Message sent: ', res);
              }
            });
          }
        });

      })
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
        state.invitees = result.parameters.invitees;
      }
      user.save();
      rtm.sendMessage(result.fulfillment.speech, message.channel);
    }
  }

  var meetingFunction = function(data, message, user){ //ccccc
    state = user.pendingState;
    if(!state.date || !state.invitees[0] || !state.time){
      meetingHandler(data, message, user); //cccccc
    } else if(state.date && state.time && state.invitees[0]){
      rtm.sendMessage("Reply to previous task status", message.channel);
    } else {
      meetingHandler(data, message, user); ///cccccc
    }
  }

  var setInvitees = function(myString, state){
    var myArray = myString.split(' ');
    myArray.forEach(function(item,index){
      if(item[0]==='<'){
        item = item.substring(2,item.length-1);
        state.inviteesBySlackid.push(item);
        myArray[index] = rtm.dataStore.getUserById(item).real_name;
      }
    });
    return myArray.join(' ');
  }

  var meetingPath = function(user, state){
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

  function findAttendees(state){

    return models.User.find({})
    .then(function(users){
      var attendees = [];

      users.forEach(function(item){
        var id = item.slack_ID;
        console.log(item);
        if(state.inviteesBySlackid.indexOf(id) !== -1){
            attendees.push({"email": item.googleAccount.email, "access_token": item.googleAccount.access_token})
        }
      })
      console.log('INSIDE FIND ATTENDEES METHOD');
      console.log(attendees);
      return attendees;
    })

  }

  return {
    meetingHandler: meetingHandler,
    meetingFunction: meetingFunction,
    setInvitees: setInvitees,
    meetingPath: meetingPath,
    findAttendees: findAttendees
  }
}
