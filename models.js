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

User = mongoose.model('User', userSchema);

module.exports = {
    User: User
};
