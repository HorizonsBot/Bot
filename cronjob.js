var mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);

var { User, Reminder } = require('./models');
var { rtm } = require('./app');

Reminder.find({}, function(err, reminders) {
  console.log("REMINDERS", reminders);
  if(err) {
    console.log('There was an error with finding the reminders');
  } else {
    // reminders is an array of reminder JSONs
    const curDate = new Date().toLocaleDateString();
    //sets up the next day
    const tomDay = parseInt(curDate.split('/')[1]) + 1;
    let tomDate = curDate.split('/')
    tomDate[1] = parseInt(tomDate[1]) + 1;
    tomDate = tomDate.join('/')
    console.log("TODAY DATE", curDate, "TOMORROW DATE", tomDate);

    reminders.forEach(function(reminder) {
      if( curDate === reminder.day ) {    //On due day of reminder, send Slack msg & delete the reminder doc
        console.log("Reminder now", reminder);
        console.log('need to send RTM message here');
        User.findById(reminder.reqID, function(err, user) {
          console.log("TODAY, USER iS", user);
          rtm.sendMessage(`Reminder! You gotta remember to ${reminder.subject} today bro!`, user.slack_DM_ID)
          if(!err) {
            Reminder.remove({reqID: reminder.reqID}, function(err) {
              if(err) {
                console.log("Error removing reminder for today!");
              }
            })
          }
        })
      } else if ( tomDate === reminder.day ) {    //On day before due day of reminder, send Slack msg to app user
        User.findById(reminder.reqID, function(err, user) {
          rtm.sendMessage(`Reminder! You gotta remember to ${reminder.subject} tomorrow bro!`, user.slack_DM_ID)
        })
      }
    })
  }
})
