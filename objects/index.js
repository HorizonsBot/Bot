// INTERACTIVE BUTTON OBJECTS

var obj = {   // yes or no confirmation button
  "attachments": [
    {
      "text": "Is this ok?",
      "fallback": "",
      "callback_id": "wopr_game",
      "color": "#3AA3E3",
      "attachment_type": "default",
      "actions": [
        {
          "name": "confrim",
          "text": "Yes",
          "type": "button",
          "value": "yes"
        },
        {
          "name": "confirm",
          "text": "Cancel",
          "type": "button",
          "value": "cancel"
        },
      ]
    }
  ]
}

var dropdown_obj = {    // time conflict drop down menu
  "attachments": [
       {
           "text": "Scheduled time was not available. Here are some alternatives!",
           "fallback": "WHAT IS A FALLBACK BRO?",
           "color": "#3AA3E3",
           "attachment_type": "default",
           "callback_id": "alt_date_selection",
           "actions": [
               {
                   "name": "alt_dates",
                   "text": "Pick an alternate date and time...",
                   "type": "select",
                   "options": []
               },
               {
                 "name": "confirm",
                 "text": "Cancel",
                 "type": "button",
                 "value": "cancel"
               }
           ]
       }
   ]
}

module.exports = {
  dropwdown_obj: dropdown_obj,
  obj: obj
};
