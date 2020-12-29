const config = require('../config/config')();
const randomize = require('randomatic');
const sgMail = require('@sendgrid/mail')
var FCM = require('fcm-node');
var admin = require("firebase-admin");
// var serviceAccount = require("../readystaffing-firebase-adminsdk-9ex9v-0ef25da506.json");
var serviceAccount = require("../readystaffing-907fb-firebase-adminsdk-8dvs1-f3bf10498f.json")

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://readystaffing.firebaseio.com"
});

// var serverKey = 'AAAAAdQ_VSI:APA91bGaxmg1lhklXkFCccT8Rjhuv-j6Nv95rR2ggesTf6VHTfFSJRAgWdWzr1BgXcCSmm2ir052-6HKAeY-GjDYMP8VjtBimVVcTI8qSTZXAfP7yQ9l8xyB5mjnm5jemidnJY_y40Wg';

var serverKey = 'AAAAm5qMce0:APA91bFSZyB6p-zVSFwzSakCC8a24D6FmmsukIuzZEOPzH7fhGj5dn4fD4MRFSKUNYhVTC-ZfNmag1JzRCdw2GyqozTpeUEpza4xT9DFNVG8G0PvtdceR4owKDSqsiNLY0Wj7cTT7S9O';



var sendgridKey = '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';

var fcm = new FCM(serverKey);



const all_function = {

    // create random 6 digit number
    'getOtp': () => {

        var value = randomize('0', 6);
        return value;
    },

    // create random 1 digit code
    'getCode': () => {
        var value = randomize('Aa0', 16);
        return value;
    },


    // get 10 digits random number

    'random_number': () => {
        var value = randomize('0', 10);
        return value;

    },

    // send email via sendGrid

    'sendEmail': (to, subject, text, html) => {
        sgMail.setApiKey(sendgridKey);

        const msg = {
            to: to,
            from: 'no-reply@rockstaffing.com',
            subject: subject,
            text: text,
            html: html,
        };

        console.log("messageObject ===>", msg);
        sgMail.send(msg).then((sent) => {
            console.log('message sent ===>')
        }).catch((err) => {
            console.log('message not sent', err)
        })
    },


    // send email with attachement via sendGrid

    'sendEmailWithAttachment': (to, subject, text, attachment) => {
        sgMail.setApiKey(sendgridKey);

        const msg = {
            to: to,
            from: 'no-reply@rockstaffing.com',
            subject: subject,
            text: text,
            attachments: attachment
        };

        // console.log("messageObject ===>", msg);
        sgMail.send(msg).then((sent) => {
            console.log('attachement sent ===>')
        }).catch((err) => {
            console.log('attachment not sent', err)
        })
    },

    'send_push_notification': (fcm_token, title, body, data) => {

        // var message = {
        //     //this may vary according to the message type (single recipient, multicast, topic, et cetera)
        //     to: fcm_token,
        //     collapse_key: 'green',

        //     notification: {
        //         title: title,
        //         body: body
        //     },
        //     data: data
        // }

        // fcm.send(message, (err, response) => {

        //     if (err) {
        //         console.log("Something has gone wrong!", err)
        //     } else {
        //         console.log("Successfully sent with response: ", response)
        //     }
        // })


        var message = {
            "token": fcm_token,
            "notification": {
                title: title,
                body: body
            },
            "data": data,
            "android": {
                "priority": "high",
                "notification": {
                    "click_action": "FLUTTER_NOTIFICATION_CLICK"
                },
            },
            "apns": {
                "headers": {
                    "apns-priority": "5",
                },
                "payload": {
                    "aps": {
                        "category": "NEW_MESSAGE_CATEGORY"
                    }
                }
            },
            "webpush": {
                "headers": {
                    "Urgency": "high"
                }
            }
        };

        // end a message to the device corresponding to the provided
        // registration token.
        admin.messaging().send(message)
            .then((response) => {
                // Response is a message ID string.
                console.log('Successfully sent message:', response);
            })
            .catch((error) => {
                console.log('Error sending message:', error);
            });

    },

    // get 10 digits random number

    'random_number': () => {
        var value = randomize('A!a0', 9)

        console.log("random number==>>", value);
        return value;

    },
}

module.exports = all_function;
