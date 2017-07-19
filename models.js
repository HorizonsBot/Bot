var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
  googleAccount: {
    access_token: String,
    refresh_token: String,
    profile_ID: String,
<<<<<<< HEAD
    expiry_date: Number,
    profile_name: String
=======
    expiry_date: Number
>>>>>>> master
  },
  slack_ID: String,
  slack_Username: String,
  slack_Email: String,
  slack_DM_ID: String
});

var reminderSchema = mongoose.Schema({
<<<<<<< HEAD
=======
  // slack_DM_ID: String,
>>>>>>> master
  subject: {
    required: true,
    type: String
  },
  day: {
    required: true,
<<<<<<< HEAD
    type: Date
=======
    type: String
>>>>>>> master
  },
  googCalID: String,
  reqID: String
})


<<<<<<< HEAD
=======

>>>>>>> master
var User = mongoose.model('User', userSchema);
var Reminder = mongoose.model('Reminder', reminderSchema);


module.exports = {
    User: User,
    Reminder: Reminder
};
