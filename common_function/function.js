const config = require('../config/config')();
const randomize = require('randomatic');
const sgMail = require('@sendgrid/mail')
var FCM = require('fcm-node');

// var serverKey = 'AAAAP0Zh1yk:APA91bH6A1r0K62VPpxX8vPFEwMDJwZFZ8LDolwxlp7HnwPnFuFq2nG0cE8-mRQNHaBqWnm0oYUp-wllyjRLQ3qPZfgsNND59HjP9E146r2Ulqry3KaJ5ySyxDuUetEYfSsIOfwkcKPV';
var serverKey = 'AAAAAdQ_VSI:APA91bGaxmg1lhklXkFCccT8Rjhuv-j6Nv95rR2ggesTf6VHTfFSJRAgWdWzr1BgXcCSmm2ir052-6HKAeY-GjDYMP8VjtBimVVcTI8qSTZXAfP7yQ9l8xyB5mjnm5jemidnJY_y40Wg';
// var serverKey = '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';

// var serverKey = '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'
//var sendgridKey = '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';// client
var sendgridKey = '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'; //me

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
        sgMail.send(msg).then((sent) => {
            console.log('message sent')
        }).catch((err) => {
            console.log('message not sent', err)
        })
    },


    'send_push_notification': (fcm_token, title, body, data) => {

        var message = {
            //this may vary according to the message type (single recipient, multicast, topic, et cetera)
            to: fcm_token,
            collapse_key: 'green',

            notification: {
                title: title,
                body: body
            },
            data: data
        }

        fcm.send(message, (err, response) => {

            if (err) {
                console.log("Something has gone wrong!")
            } else {
                console.log("Successfully sent with response: ", response)
            }
        })

    },

    // get 10 digits random number

    'random_number': () => {
        var value = randomize('A!a0', 9)

        console.log("random number==>>", value);
        return value;

    },
}

module.exports = all_function;