var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI);

var userSchema = mongoose.Schema({
  // googleAccount: {
  //   access_token: String,
  //   refresh_token: String,
  //   profile_ID: String,
  //   profile_name: String
  // },
  googleAccount: {},
  slack_ID: {
    type: String,
    required: true
  },
  slack_DM_ID: {
    type: String,
    required: true
  },
  slack_Username: String,
  slack_Email: String
});

var reminderSchema = mongoose.Schema({
  // slack_DM_ID: String,
  subject: {
    required: true,
    type: String
  },
  day: {
    required: true,
    type: String
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
