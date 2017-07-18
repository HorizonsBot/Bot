var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
  slackId: String,
  slackName: String,
  googleProfileAccess: Boolean,
});

var reminderSchema = mongoose.Schema({
  subject: {
    required: true,
    type: String
  },
  day: {
    required: true,
    type: Date
  },
  googCalID: String,
  reqID: String
})



var User = mongoose.model('User', userSchema);
var Reminder = mongoose.model('Reminder', reminderSchema);


module.exports = {
    User: User,
    Reminder: Reminder
};
