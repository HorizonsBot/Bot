var axios = require('axios');

var getWeekArray = function(date, time){

  console.log("entered getWeekArray");
  var startString = date + time;
  var a = moment(date);
  var b = a.add(7, 'day'); //make this shit a moment god dammit
  var c = b.format().substring(0,19);
  var endString = c.split('T').join(' ');
  var start = moment(startString, 'YYYY-MM-DD hh:mm a');
  var end = moment(endString, 'YYYY-MM-DD hh:mm a');
  var result = [];
  var current = moment(start);
  while (current <= end) {
        result.push(current.format('YYYY-MM-DD HH:mm'));
        current.add(30, 'minutes');
  }

  console.log("original weekArray", result);

  result = result.filter(function(item){
    var item = item.split(' ');
    var time = parseInt(item[1].substring(0,2));
    return (time>=9 && time<=18);
  })

  return result;

}  //returns week array

var cutWeekArray = function(busyArray, state){

  console.log("entered function cutWeekArray");

  var weekArray = getWeekArray(state.date, state.time);

  console.log("weekArray", weekArray);

  for(var i=0;i<busyArray.length;i+=2){
    var x = weekArray.indexOf(busyArray[i]);
    var y = weekArray.indexOf(busyArray[i+1]);
    if(x!==-1)weekArray.splice(x,y-x);
  }
  console.log("after cutting weekArray", weekArray);
  return weekArray;
} // returns week array with available time slots

var limitWeekArray = function(weekArray){

  console.log("entered limitWeekArray");

  var finalArray = [];

  for(var i = 1; i < 8 ; i++){
    finalArray.push([]);
  }

  console.log("finalArray", finalArray);

  var j = 0 ;

  for(var i=0;i<weekArray.length; i++){
    if(finalArray[j].length===3){
      j++;
      var date = parseInt(weekArray[i].substring(8,10));
      var target = date===30 || date===31 ? 1 : date+1;
      for(var z=0;z<weekArray.length;z++){
        var look = parseInt(weekArray[z].substring(8,10));
        if(target === look){
          i=z;
          break;
        }
      }
      if(j===7)break;
    }
    finalArray[j].push(weekArray[i]);
  }

  console.log("finalArray", finalArray);
  var mainArray = [];
  var k=0;
  while(mainArray.length!==10){
    if(finalArray[k].length===0)k++;
    mainArray.push(finalArray[k].shift());
  }
  console.log("mainArray", mainArray);
  return mainArray;
} // cuts down weekArray to 10 slots;

var checkConflict = function(user){
  console.log("entered the funtion checkConflict");
  return findAttendees(user.pendingState)
  .then(attendees => {
      console.log("started forming attendees");
      var calendarPromises = [];
      var attendeeCalendars;
      var busyArray = [];

      attendees.forEach(function(attendee) {
          var email = encodeURIComponent(attendee.email);
          var calendarStart = new Date().toISOString();
          var timeMin = encodeURIComponent(calendarStart);
          var accessToken = encodeURIComponent(attendee.access_token);
          calendarPromises.push(axios.get(`https://www.googleapis.com/calendar/v3/calendars/${email}/events?timeMin=${timeMin}&access_token=${accessToken}`))
      })
      var calendarStart = new Date().toISOString();

      var timeMin = encodeURIComponent(calendarStart);
      calendarPromises.push(axios.get(`https://www.googleapis.com/calendar/v3/calendars/${user.googleAccount.email}/events?timeMin=${timeMin}&access_token=${user.googleAccount.access_token}`))


      return Promise.all(calendarPromises)
      .then(function(calendars) {

          attendeeCalendars = calendars.map(function(calendar) {
              return calendar.data.items;
          })

          attendeeCalendars.forEach(function(calendar, index){
            attendeeCalendars[index] = calendar.filter(function(item){
              return item.start.dateTime;
            })
          })

          attendeeCalendars.forEach(function(calendar, index){
           attendeeCalendars[index] = calendar.forEach(function(item){
              var start = item.start.dateTime.split('T');
              var end = item.end.dateTime.split('T');
              var startArr = [start[0], start[1].slice(0,5)];
              var endArr = [end[0], end[1].slice(0,5)];
              busyArray.push(startArr.join(' '));
              busyArray.push(endArr.join(' '));
            })
          })

          console.log("busyArray", busyArray);

          var meetingString = user.pendingState.date + ' ' + user.pendingState.time.substring(0,5);

          console.log("checkString", meetingString);

          if(busyArray.indexOf(meetingString)===-1){
            console.log("this is where i want to be");
            return "noConflict"; //  no conflict;
          }

          var flag1 = cutWeekArray(busyArray, user.pendingState);

          console.log("after cutting flag1", flag1);

          flag1 = limitWeekArray(flag1);

          console.log("after limiting weeek array", flag1);

          return flag1;
      })
      .catch(function(err){
        console.log(err)
      });
  })
  .then(function(flag1){
    console.log(flag1);
    return flag1;
  })
  .catch(function(error){
    console.log(error);
  })
} // creates a busy array using everyones data

var getAlternativeTimes = function(array){
  var tempObj = dropdown_obj;
  for(var i = 0 ;i < array.length; i++ ){
    tempObj.attachments[0].actions[0].options.push({"text":array[i], "value":array[i]})
  }

  console.log('TEMPOBJ HERE ==>>> ', tempObj);
  return tempObj;
}


module.exports = {
  getWeekArray: getWeekArray,
  cutWeekArray: cutWeekArray,
  limitWeekArray: limitWeekArray,
  checkConflict: checkConflict,
  getAlternativeTimes: getAlternativeTimes
}
