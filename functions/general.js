var google = require('googleapis');

var plus = google.plus('v1')
var OAuth2 = google.auth.OAuth2;

var clearState = function(user){
  user.pendingState = {
    subject: "",
    date: "",
    time: "",
    invitees: [],
    inviteesBySlackid: [],
  };
  user.save(function(err){
    if(err)console.log(err);
  });
}

var googleAuth = function(){
  return new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.DOMAIN + '/connect/callback'
  );
}

var calculateEndTimeString = function(state){
    //set up for default 30 minute meetings until api.ai is trained better
    var meetingLength = 60;

    var end =  state.date + 'T' + state.time;
    var endMoment = moment(end);
    endMoment.add(meetingLength, 'minute');
    return endMoment;
}

var calculateStartTimeString = function(state){
    var start =  state.date + 'T' + state.time;
    var startMoment = moment(start);
    return startMoment;
}


module.exports = {
  clearState: clearState,
  googleAuth: googleAuth,
  calculateStartTimeString: calculateStartTimeString,
  calculateEndTimeString: calculateEndTimeString
}
