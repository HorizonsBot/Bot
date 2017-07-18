var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
  googleAccount: {
    access_token: String,
    refresh_token: String,
    profile_ID: String
  },
  slack_ID: String,
  slack_Username: String,
  slack_Email: String,
  slack_DM_ID: String
});



User = mongoose.model('User', userSchema);

module.exports = {
    User: User
};
