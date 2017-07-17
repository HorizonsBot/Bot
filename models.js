var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
  slackId: String,
  slackName: String,
  googleProfileAccess: Boolean,
});



User = mongoose.model('User', userSchema);

module.exports = {
    User: User
};
