var Reminder = require('./models/models').Reminder

Reminder.find()
  .exec(function(reminders, err) {
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


      reminders.forEach(function(reminder) {
        if(curDate === reminder.day || tomDate === reminder.day) {
          console.log('need to send RTM message here');
        } else {

        }
      })
    }
  })
