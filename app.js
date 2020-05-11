const express = require('express');
const bodyparser = require('body-parser');
const config = require('./config/config')();
const morgan = require('morgan');
const cors = require('cors');
var DateDiff = require('date-diff');
var Distance = require('geo-distance');



const app = express();
// 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

// process.env.SENDGRID_API_KEY = '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';

//process.env.SENDGRID_API_KEY = 'AAAAfx17d1c:APA91bFEBCUNzczQ7vIpo119AsbM9eXUXU424F7n56R7YGVVwZkw9ji2k5yoe3KqeDelUFwBpuli-WvlVDVxBQ9ABNEXuS27Hvh9OgEnsFBjNUAKUMDTHGHpArE5vDpTZRI_J3s98taE';
process.env.SENDGRID_API_KEY = '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';

// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// app.use(function(req, res, next) {
//     // res.header("Access-Control-Allow-Origin", "*");      
//     res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT")
//     res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//     next();
// });


app.use(morgan('dev'));
app.use(cors());

app.use('/uploads', express.static('uploads'));

app.use(bodyparser.urlencoded({ extended: false }));
app.use(bodyparser.json());



app.use('/api/v1', require('./routes/route'));


// var date1 = new Date("01/12/2020");
// var today = new Date();
// var getDate = `"${(today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear()}"`;
// console.log('getDate ==>', getDate);

// var date2 = new Date(getDate);
// var diffDays = parseInt((date2 - date1) / (1000 * 60 * 60 * 24)); //gives day difference 
// console.log("diffDays===>", diffDays)


// var date = new Date("04/15/2020");

var job = { lat: 28.6077212, long: 77.375732 };

var user = ''

user = { lat: 28.6255853, lon: 77.3498401 };


app.listen(config.port, () => {
    console.log(`server is running at port : ${config.port}`);
})