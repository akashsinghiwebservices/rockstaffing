const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config')();
const mysql = require('../database/db');
const common_function = require('../common_function/function');
const multer = require('multer');
const path = require('path');
var cron = require('node-cron');
var base64Img = require('base64-img');
// var Distance = require('geo-distance');
const geolib = require('geolib');
const url = 'http://178.62.83.145:2000/api/v1';
// var stripe = require('stripe')('sk_test_F0Gpjjq16yBiRRXrIOftW8BM');
var stripe = require('stripe')('sk_test_51DQ5a0LbjZoHbkST8z6PWw1cQkjnRmONOQF1aTbObSGOrwPZ86B2WDoyRUKkSN5oUNH3T8LVOWyg6vY3FhB1I6Y8001sQ0M64a')
var async = require("async");

var admin = require("firebase-admin");
var serviceAccount = require("../readystaffing-firebase-adminsdk-9ex9v-0ef25da506.json");
// const PDFDocument = require('pdfkit');
const fs = require('fs');
// const e = require('express');
// const { resolve } = require('path');
const pdf = require("pdf-creator-node");
const cryptoRandomString = require('crypto-random-string');

// const moment = require('moment');


// const { resolve } = require('path');
// const { use } = require('./route');
// const { NULL } = require('node-sass');


// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//     databaseURL: "https://readystaffing.firebaseio.com"
// });
var ejs = require('../utils/ejs');
// var pdf = require('../utils/pdf');
var moment = require('moment');
const { response } = require('express');




//------------------------------------------------- function for upload files --------------------------------------------------------------

var storage = multer.diskStorage({

    destination: (req, file, cb) => {
        var ext = path.extname(file.originalname);
        cb(null, './uploads')
    },
    filename: (req, file, cb) => {
        cb(null, +Date.now() + '-' + file.originalname)
    }
})

var upload = multer({ storage: storage })


//----------------------------------------------- API for signup Job provider / seeker ------------------------------------------------------

const signup = async(req, res) => {

    const { first_name, last_name, email, company_name, password, confirm_password, category_id, category_name, skill_id, skills, ssn, dob, role_id, profile_pic, distance, language, biography, previous_job } = req.body;

    await userRegistration();

    /* Function for register 
       job seeker or provider
    */
    console.log("skill_id ===>", skill_id)

    var arr;
    const host = req.hostname;
    var url = req.protocol + "://" + host + ":2000" + "/";
    const destpath = 'uploads/image';
    const filename = Date.now();
    var path = '';

    function userRegistration() {

        var base64 = '';

        if (!profile_pic) {
            base64 = ''
        } else {
            base64 = profile_pic
        }

        if (password != confirm_password) {
            res.json({ status: 409, msg: "Password and Confirm password does'nt match." })
        } else {

            var role = '';
            var isCompleteProfile = '';

            if (role_id == 1) { // 1=> job provider and 2 => job seeker and 3 => admin
                role = 1;
                isCompleteProfile = 1;
                arr = '';
            } else if (role_id == 2) {
                role = 2;
                isCompleteProfile = 0;
                arr = skill_id.split(',');
            } else {
                role = 3;
                isCompleteProfile = 1;
            }

            mysql.connection.query('select * from tab_users where email =?', [email], (err, user) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (user.length > 0) {
                    res.json({ status: 404, msg: "Email already exist." })
                } else {
                    const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
                    var code = common_function.getCode();

                    base64Img.img(profile_pic, destpath, filename, function(err, path) {
                        if (err) {
                            res.json({ status: 500, msg: "Error found at image upload." })
                        } else {
                            console.log("path ====>", url + path)

                            // mysql.connection.query('insert into tab_users SET first_name =?,last_name =?,email =?,company_name=?, password =?, skill_id = ?,skills=?,category_id=?,category_name=?, ssn =?, dob=?,role_id =?,isCompleteProfile=?,profile_pic =?,verification_code=?',
                            mysql.connection.query('insert into tab_users SET first_name =?,last_name =?,email =?,company_name=?, password =?, skill_id = ?,skills=?,category_id=?,category_name=?, ssn =?, dob=?,role_id =?,isCompleteProfile=?,profile_pic =?,verification_code=?,distance=?,language=?,biography=?,previous_job=?', [first_name, last_name, email, company_name, hash, skill_id, skills, category_id, category_name, ssn, dob, role, isCompleteProfile, url + path, code, distance, language, biography, previous_job], (err, save_data) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error.", err: err })
                                } else {
                                    var link = `http://178.62.83.145:2000/api/v1/verifyLink/${save_data.insertId}/${code}`;
                                    let msg = '<div>Dear ' + first_name + ' ' + last_name + ',';
                                    msg += '<p>Thank you for downloading the ReadyStaff job app. We hope you have a great experience and recommend us to your friends and family.</p><br></div>';
                                    msg += '<div><p>Please verify your Email by given below link.</p></div>';
                                    msg += `${link}`;
                                    msg += '<div><p>Sincerely,</p><br><p>Rock Staffing Team</p></div>'
                                    common_function.sendEmail(email, 'Rock staffing : Verify Email', 'Rock staffing', msg); //send message on registerd email address

                                    // console.log("array ===>", arr)

                                    for (var i = 0; i < arr.length; i++) {
                                        mysql.connection.query('Insert into tab_user_skills set user_id=?, skill_id=?', [save_data.insertId, arr[i]], (err, result) => {
                                            if (err) {
                                                console.log("Error found")
                                            } else {
                                                console.log('Successfully inserted.')
                                            }
                                        })
                                    }
                                    res.json({ status: 200, msg: "Successfully register." })
                                }
                            })
                        }
                    });
                }
            })
        }
    }
}



//----------------------------------------------- API for login Job provider / seeker ------------------------------------------------------

const login = async(req, res) => {

    const { email, password, role_id, lat, long, current_address, device_type, device_token } = req.body;

    await userLogin();

    /*   Function for login 
         job seeker or provider
    */
    function userLogin() {

        if (!email || !password) {
            res.json({ status: 422, msg: "Email or password is required." })
        } else if (!role_id) {
            res.json({ status: 422, msg: "RoleId is required." })
        } else {

            var role = '';

            if (role_id == 1) {
                role = 1; //login as job provider
            } else if (role_id == 2) {
                role = 2; //login as job seeker
            } else {
                role = 3;
            }

            mysql.connection.query('select * from tab_users where email =? and role_id =?', [email, role], (err, user) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (user.length == 0) {
                    res.json({ status: 409, msg: "Incorrect Email or Password." })
                } else {
                    var match = bcrypt.compareSync(password, user[0].password);
                    if (match == true) {
                        var token = jwt.sign({
                                user_id: user[0].user_id,
                                email: user[0].email
                            }, config.secret_key, { expiresIn: 864000 }) // token valid for 10 days

                        mysql.connection.query('Update tab_users set token =?,lat=?,lng=?,device_type=?,device_token=?,current_address=? where user_id =?', [token, lat, long, device_type, device_token, current_address, user[0].user_id], (err, update_token) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error.", error: err })
                            } else {
                                var obj = {
                                    "user_id": user[0].user_id,
                                    "first_name": user[0].first_name,
                                    "last_name": user[0].last_name,
                                    "email": user[0].email,
                                    "profile_pic": user[0].profile_pic,
                                    "type": user[0].type,
                                    "company_name": user[0].company_name,
                                    "ssn": user[0].ssn,
                                    "dob": user[0].dob,
                                    "distance": user[0].distance,
                                    "background_check": user[0].background_check,
                                    "drug_test": user[0].drug_test,
                                    "role_id": user[0].role_id,
                                    "isCompleteProfile": user[0].isCompleteProfile,
                                    "device_type": device_type,
                                    "device_token": device_token,
                                    "quiz_score": user[0].quiz_score,
                                    "created_at": user[0].created_at,
                                    "lat": user[0].lat,
                                    "long": user[0].lng,
                                    "work_lat": user[0].work_lat,
                                    "work_long": user[0].work_lng,
                                    "token": token,
                                    "step": user[0].step,
                                    "job_id": user[0].job_id,
                                    "job_type": user[0].job_type,
                                    "payment_job_id": user[0].payment_job_id,
                                    "payment_status": user[0].payment_status,
                                    "payment": user[0].payment,
                                    "invoice_permit": user[0].invoice_permit
                                }
                                res.json({ status: 200, msg: "Successfully login.", data: obj })
                            }
                        })
                    } else {
                        res.json({ status: 400, msg: "Incorrect Email or Password." })
                    }
                }
            })
        }
    }
}

//------------------------------------------------------- forget password ----------------------------------------------------

const forget_password = async(req, res) => {

    const { email, role_id } = req.body;

    await forgetPassword();

    function forgetPassword() {

        if (!email || !role_id) {
            res.json({ status: 422, msg: "Email or RoleId is required." })
        } else {
            mysql.connection.query('select * from tab_users where email =? and role_id =?', [email, role_id], (err, user) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (user.length == 0) {
                    res.json({ status: 404, msg: "User not found." })
                } else {

                    var new_password = common_function.random_number();

                    let msg = '<div>Dear ' + user[0].first_name + ',';
                    msg += `<p>As per your request, your password has been changed.</p></div><br>`;
                    msg += `<p>Your new password is : ${new_password}</p></div><br>`;
                    msg += '<div><p>Sincerely,</p><br><p>Rock Staffing Team</p></div>'
                    common_function.sendEmail(email, 'Rock Staffing:Reset Password', 'Rock Staffing', msg); //send message on registerd email address 

                    var hash = bcrypt.hashSync(new_password, bcrypt.genSaltSync(10));

                    mysql.connection.query('Update tab_users set password =? where user_id =?', [hash, user[0].user_id], (err, update_password) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else {
                            res.json({ status: 200, msg: "Successfully changed your password as per your request,please check you mail." });
                        }
                    })
                }
            })
        }
    }
}

//------------------------------------------- Get user profile --- -------------------------------------------------

const get_profile = async(req, res) => {

    var user_id = req.decoded.user_id;

    await getProfile();

    function getProfile() {
        if (!user_id) {
            res.json({ status: 422, msg: "UserId is required." })
        } else {
            mysql.connection.query('select * from tab_users where user_id =?', [user_id], (err, user) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (user.length == 0) {
                    res.json({ status: 404, msg: "User is incorrect." })
                } else {
                    // get skill lists
                    mysql.connection.query('SELECT A.id,A.skill,A.parent_id,B.user_id,B.created_at FROM `tab_skills` A LEFT JOIN tab_user_skills B ON B.skill_id = A.id LEFT JOIN tab_skills C ON C.id=A.parent_id WHERE B.user_id=?', [user_id], (err, list) => {
                        if (err) {
                            res.json({ status: 200, msg: "User found successfully.", data: user[0] })
                        } else {
                            res.json({ status: 200, msg: "User found successfully.", data: user[0], skill: list })
                        }
                    })
                }
            })
        }
    }
}

//-------------------------------------------------------- API for add long term job-------------------------------------------------------

const long_term_job = async(req, res) => {

    const { category, location, lat, long, address, no_of_opening, title, posted_date, hourly_rate } = req.body;

    var user_id = req.decoded.user_id;

    await longTermJob();

    function longTermJob() {
        mysql.connection.query('Insert into tab_jobs set user_id =?, category =?, location =?,lat =?,lng=?, job_title =?,job_type =?, posted_date =?,hourly_rate=?,address =?,no_of_opening =?', [user_id, category, location, lat, long, title, 0, posted_date, hourly_rate, address, no_of_opening], (err, save_job) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else {
                // var sql ='select * from tab_users where role_id=2 and isCompleteProfile=1 and skill_id=?'
                var sql = 'SELECT B.user_id,B.first_name,B.last_name,B.email,B.profile_pic,B.company_name,A.skill_id,B.category_id,B.category_name,B.ssn,B.dob,B.distance,B.background_check,B.drug_test,B.role_id,B.isCompleteProfile,B.token,B.device_type,B.device_token,B.quiz_score,B.lat,B.lng,B.work_lat,B.work_lng,B.created_at FROM `tab_user_skills` A LEFT JOIN tab_users B ON A.user_id = B.user_id WHERE (A.skill_id=? || A.skill_id=46)  AND B.role_id=2 and B.isCompleteProfile=1'
                mysql.connection.query(sql, [category], (err, user_list) => {
                    if (err) {
                        console.log("Notification is not sent")
                    } else {
                        // mysql.connection.query('SELECT A.*,B.skill FROM tab_users A LEFT JOIN tab_skills B ON B.id=? WHERE A.user_id=?', [category, user_id], (err, provider) => {

                        mysql.connection.query('SELECT A.*,B.skill FROM tab_users A LEFT JOIN tab_skills B ON B.id=? WHERE A.user_id=?', [category, user_id], (err, provider) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error." })
                            } else {
                                for (var i = 0; i < user_list.length; i++) {
                                    // You have been invited to work on a job of Interior Decoration at Gates Center
                                    var ttl = `You have been invited to work on a job of ${provider[0].skill} at ${provider[0].company_name}` //title
                                    var text = `${title}.`; //body

                                    var saveId = save_job.insertId;
                                    var userId = user_list[i].user_id;
                                    var RoleId = user_list[i].role_id;
                                    var Id = user_id.toString();
                                    var latitude = lat.toString();
                                    var longitude = long.toString();

                                    var data = { //data
                                        "job_id": saveId.toString(), //job_id
                                        "sender_id": Id, //seeker provider user id
                                        "receiver_id": userId.toString(),
                                        "role_id": RoleId.toString(),
                                        "lat": latitude,
                                        "long": longitude,
                                        "isCompleted": "1"
                                    }
                                    common_function.send_push_notification(user_list[i].device_token, ttl, text, data);
                                    mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [save_job.insertId, user_list[i].user_id, ttl, lat, long, 0, user_list[i].distance, 1], (err, save_notification) => {
                                        if (err) {
                                            console.log('Error found in save notification.')
                                        } else {
                                            console.log('Save notification into DB.')
                                        }
                                    })
                                }
                            }
                        })
                    }
                })
                res.json({ status: 200, msg: "Successfully save long term job.", job_id: save_job.insertId })
            }
        })
    }
}

//---------------------------------------------------- API for save address ----------------------------------------------------------------

const add_address = async(req, res) => {

    const { name, address1, address2, city, state, zipcode, zone } = req.body;
    var user_id = req.decoded.user_id;

    await addAddress();

    function addAddress() {
        mysql.connection.query('Insert into tab_address SET user_id =?, name =?, addressline1 =?, addressline2 =?,city =?, state =?, zipcode =?, zone =?', [user_id, name, address1, address2, city, state, zipcode, zone], (err, save_address) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else {
                res.json({ status: 200, msg: "Successfully saved address." })
            }
        })
    }
}

//------------------------------------------------ API for save job categories ---------------------------------------------------------

const add_job_category = async(req, res) => {

    const { category } = req.body;

    await addJobCategory();

    function addJobCategory() {
        if (!category) {
            res.json({ status: 422, msg: "Category is required." })
        } else {
            mysql.connection.query('Insert into tab_job_category set category =?', [category], (err, save_category) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", err: err })
                } else {
                    res.json({ status: 200, msg: "Successfully saved category." })
                }
            })
        }
    }
}

//--------------------------------------------------- API for job category list ---------------------------------------------

const job_category_list = async(req, res) => {

    await jobCategoryLists();

    function jobCategoryLists() {
        mysql.connection.query('select * from tab_job_category ', (err, list) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (list.length == 0) {
                res.json({ status: 404, msg: "Category lists not found.", data: list })
            } else {
                res.json({ status: 200, msg: "Category lists found.", data: list })
            }
        })
    }
}

//--------------------------------------------------- API for save add work now -------------------------------------------------------


const save_work_now = async(req, res) => {

    const { location, lat, long, title, start_date, end_date, start_time, end_time, equipment, hourly_rate, worker_selection, address, no_of_opening } = req.body;
    var user_id = req.decoded.user_id;
    var category = req.body.category;

    await saveWorkNow();

    function saveWorkNow() {
        mysql.connection.query('SELECT A.*,B.skill FROM `tab_users` A LEFT JOIN tab_skills B ON B.id=? WHERE A.user_id=?', [category, user_id], (err, provider) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error.", err1: err })
            } else {

                // 16 Dec 2020
                // check provider create 3 jobs at a day

                var current_date = moment(new Date()).format("YYYY-MM-DD");
                // mysql.connection.query(`SELECT A.user_id,COUNT(A.created_at) AS no_of_job FROM tab_jobs A WHERE A.user_id=? AND A.created_at LIKE '%${current_date}%' GROUP BY A.user_id,A.created_at`, [user_id], (err, today_job) => {
                var d = `SELECT * FROM tab_jobs WHERE created_at LIKE '%${current_date}%' AND user_id=${user_id}`;
                console.log("d -------->", d);
                mysql.connection.query(`SELECT * FROM tab_jobs WHERE created_at LIKE '%${current_date}%' AND user_id=?`, [user_id], (err, today_job) => {
                    console.log("condition -------->", today_job.length, (today_job.length <= 3), (today_job.length == 0));

                    if (err) {
                        res.json({ status: 500, msg: "Internal server error." })
                    } else if (today_job.length < 3 || today_job.length == 0) {
                        //     }
                        // })
                        mysql.connection.query('Insert into tab_jobs set user_id =?, category =?, location =?,lat =?,lng =?, job_title =?,job_type =?,start_date =?, end_date =?,start_time =?,end_time =?, equipment =?, hourly_rate =?,worker_selection =?,address =?,no_of_opening =?', [user_id, category, location, lat, long, title, 1, start_date, end_date, start_time, end_time, equipment, hourly_rate, worker_selection, address, no_of_opening], (err, save_job) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error.", err: err })
                            } else {
                                // var sql='select * from tab_users where role_id=2 and     isCompleteProfile=1 and skill_id=?';
                                var sql = 'SELECT B.user_id,B.first_name,B.last_name,B.email,B.profile_pic,B.company_name,A.skill_id,B.category_id,B.category_name,B.ssn,B.dob,B.distance,B.background_check,B.drug_test,B.role_id,B.isCompleteProfile,B.token,B.device_type,B.device_token,B.quiz_score,B.lat,B.lng,B.work_lat,B.work_lng,B.created_at FROM `tab_user_skills` A LEFT JOIN tab_users B ON A.user_id = B.user_id WHERE (A.skill_id=? || A.skill_id=46) AND B.role_id=2 and B.isCompleteProfile=1'
                                mysql.connection.query(sql, [category], (err, user_list) => {
                                    if (err) {
                                        console.log("Error found.")
                                    } else {

                                        console.log("userlist ====>", user_list)

                                        for (var i = 0; i < user_list.length; i++) {
                                            var ttl = `You have been invited to work on a job of ${provider[0].skill} at ${provider[0].company_name}`
                                            var text = `${title}.`; //body

                                            var saveId = save_job.insertId;
                                            var userId = user_list[i].user_id;
                                            var RoleId = user_list[i].role_id;
                                            var Id = user_id.toString();
                                            var latitude = lat.toString();
                                            var longitude = long.toString();

                                            var data = { //data
                                                "job_id": saveId.toString(), //job_id
                                                "sender_id": Id, //seeker provider user id
                                                "receiver_id": userId.toString(),
                                                "role_id": RoleId.toString(),
                                                "lat": latitude,
                                                "long": longitude,
                                                "isCompleted": "1"
                                            }

                                            console.log("datatta ====>", data)

                                            var job = {
                                                lat: lat,
                                                lon: long
                                            }
                                            var user = '';

                                            if (user_list[i].work_lat != null && user_list[i].work_lng != null) {
                                                user = {
                                                    lat: Number(user_list[i].work_lat),
                                                    lon: Number(user_list[i].work_lng)
                                                }
                                            }

                                            console.log('job location', job);
                                            console.log('user location', user_list[i].user_id, user)


                                            var distance = geolib.getDistance(job, user);
                                            var d = distance / 1000;
                                            console.log('diffrence ====>', d)

                                            if (d <= Number(user_list[i].distance)) {
                                                common_function.send_push_notification(user_list[i].device_token, ttl, text, data);
                                                mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [save_job.insertId, user_list[i].user_id, ttl, lat, long, 1, user_list[i].distance, 1], (err, save_notification) => {
                                                    if (err) {
                                                        console.log('Error found in save notification.')
                                                    } else {
                                                        console.log('Save Notifications into DB.')
                                                    }
                                                })
                                            } else {
                                                console.log('No seeker found to send notification.')
                                            }
                                        }
                                    }
                                })
                                res.json({ status: 200, msg: "Successfully saved work now job.", job_id: save_job.insertId })
                            }
                        })
                    } else {
                        res.json({ status: 500, msg: "You can only create 3 jobs in one day." })
                    }
                })
            }
        })
    }
}




//new Api 

const save_work_now1 = async(req, res) => {

    const { location, lat, long, title, start_date, end_date, start_time, end_time, equipment, hourly_rate, worker_selection, address, no_of_opening } = req.body;
    var user_id = req.decoded.user_id;
    var category = req.body.category;

    await saveWorkNow();

    function saveWorkNow() {
        mysql.connection.query('SELECT A.*,B.skill FROM `tab_users` A LEFT JOIN tab_skills B ON B.id=? WHERE A.user_id=?', [category, user_id], (err, provider) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error.", err1: err })
            } else {
                mysql.connection.query('Insert into tab_jobs set user_id =?, category =?, location =?,lat =?,lng =?, job_title =?,job_type =?,start_date =?, end_date =?,start_time =?,end_time =?, equipment =?, hourly_rate =?,worker_selection =?,address =?,no_of_opening =?', [user_id, category, location, lat, long, title, 1, start_date, end_date, start_time, end_time, equipment, hourly_rate, worker_selection, address, no_of_opening], (err, save_job) => {
                    if (err) {
                        res.json({ status: 500, msg: "Internal server error.", err: err })
                    } else {
                        // var sql='select * from tab_users where role_id=2 and     isCompleteProfile=1 and skill_id=?';
                        var sql = 'SELECT B.user_id,B.first_name,B.last_name,B.email,B.profile_pic,B.company_name,A.skill_id,B.category_id,B.category_name,B.ssn,B.dob,B.distance,B.background_check,B.drug_test,B.role_id,B.isCompleteProfile,B.token,B.device_type,B.device_token,B.quiz_score,B.lat,B.lng,B.work_lat,B.work_lng,B.created_at FROM `tab_user_skills` A LEFT JOIN tab_users B ON A.user_id = B.user_id WHERE (A.skill_id=? || A.skill_id=46) AND B.role_id=2 and B.isCompleteProfile=1'
                        mysql.connection.query(sql, [category], (err, user_list) => {
                            if (err) {
                                console.log("Error found.")
                            } else {
                                for (var i = 0; i < user_list.length; i++) {
                                    var ttl = `You have been invited to work on a job of ${provider[0].skill} at ${provider[0].company_name}`
                                    var text = `${title}.`; //body
                                    var saveId = save_job.insertId;
                                    var userId = user_list[i].user_id;
                                    var RoleId = user_list[i].role_id;
                                    var Id = user_id.toString();
                                    var latitude = lat.toString();
                                    var longitude = long.toString();

                                    var data = { //data
                                        "job_id": saveId.toString(), //job_id
                                        "sender_id": Id, //seeker provider user id
                                        "receiver_id": userId.toString(),
                                        "role_id": RoleId.toString(),
                                        "lat": latitude,
                                        "long": longitude,
                                        "isCompleted": "1"
                                    }

                                    var job = {
                                        lat: lat,
                                        lon: long
                                    }
                                    var user = '';

                                    if (user_list[i].work_lat != null && user_list[i].work_lng != null) {
                                        user = {
                                            lat: Number(user_list[i].work_lat),
                                            lon: Number(user_list[i].work_lng)
                                        }
                                    }
                                    var distance = geolib.getDistance(job, user);
                                    var d = distance / 1000;

                                    if (d <= Number(user_list[i].distance)) {

                                        //check user's current job is running or not
                                        var user_token = user_list[i].device_token;
                                        console.log("user token ===>", user_token);

                                        mysql.connection.query('select A.*,B.* from tab_booking A LEFT JOIN tab_jobs B ON A.job_id=B.job_id where A.seeker_id =? and A.job_status=?', [user_list[i].user_id, 1], (err, job_status) => {
                                            if (err) {
                                                console.log('Error found while fetch seeker job running status.')
                                            } else if (job_status.length == 0) {
                                                common_function.send_push_notification(device_token, ttl, text, data);
                                                mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [save_job.insertId, user_list[i].user_id, ttl, lat, long, 1, user_list[i].distance, 1], (err, save_notification) => {
                                                    if (err) {
                                                        console.log('Error found in save notification.')
                                                    } else {
                                                        console.log('Save Notifications into DB.')
                                                    }
                                                })
                                            } else {

                                                var job_end_date = job_status[0].end_date;
                                                // var job_end_date = job_status[0].end_date;

                                                var date1 = new Date(job_end_date).getTime();
                                                var date2 = new Date(start_date).getTime();

                                                if (date1 > date2) {
                                                    console.log("if condition =========>")
                                                    var token = user_list[i].device_token;
                                                    console.log("token ====>", token);
                                                    common_function.send_push_notification(token, ttl, text, data);
                                                    mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [save_job.insertId, user_list[i].user_id, ttl, lat, long, 1, user_list[i].distance, 1], (err, save_notification) => {
                                                        if (err) {
                                                            console.log('Error found in save notification.')
                                                        } else {
                                                            console.log('Save Notifications into DB.')
                                                        }
                                                    })
                                                } else {
                                                    console.log("else condition =========>")
                                                        // console.log("Already doing a job.====>", user_list[i].user_id, job_status[0].job_id)
                                                        // common_function.send_push_notification(user_list[i].device_token, ttl, text, data);
                                                        // mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [save_job.insertId, user_list[i].user_id, ttl, lat, long, 1, user_list[i].distance, 1], (err, save_notification) => {
                                                        //     if (err) {
                                                        //         console.log('Error found in save notification.')
                                                        //     } else {
                                                        //         console.log('Save Notifications into DB.')
                                                        //     }
                                                        // })
                                                }
                                            }
                                        })

                                        // common_function.send_push_notification(user_list[i].device_token, ttl, text, data);
                                        // mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [save_job.insertId, user_list[i].user_id, ttl, lat, long, 1, user_list[i].distance, 1], (err, save_notification) => {
                                        //     if (err) {
                                        //         console.log('Error found in save notification.')
                                        //     } else {
                                        //         console.log('Save Notifications into DB.')
                                        //     }
                                        // })
                                    } else {
                                        console.log('No seeker found to send notification.')
                                    }
                                }
                            }
                        })
                        res.json({ status: 200, msg: "Successfully saved work now job.", job_id: save_job.insertId })
                    }
                })
            }
        })
    }
}


//===================================== API for check seeker working on a job =====================

const check_running_job = async(req, res) => {
    const { job_id } = req.body;
    var user_id = req.decoded.user_id;

    mysql.connection.query('select * from tab_jobs where job_id =?', [job_id], (err, job) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (job.length == 0) {
            res.json({ status: 500, msg: "No job found." })
        } else {
            if (job[0].isCompleted == 0) {
                res.json({ status: 200, msg: "Seeker can apply on this job." })
            } else {
                mysql.connection.query('select A.*,B.* from tab_booking A Left join tab_jobs B ON A.job_id=B.job_id Where A.seeker_id=?', [user_id], (err, result) => {
                    if (err) {
                        res.json({ status: 500, msg: "Internal server error." })
                    } else if (result.length == 0) {
                        res.json({ status: 200, msg: "Seeker can apply on this job." })
                    } else {

                        var status = '';
                        var msg = '';

                        async.forEachOf(result, (item, index) => {
                            var job_start_date = job[0].start_date;
                            var job_end_date = item.end_date;

                            var date1 = new Date(job_start_date).getTime();
                            var date2 = new Date(job_end_date).getTime();
                            console.log("date1,date2 =====>", date1, date2);
                            console.log(`item  ${index}=====>`, item);
                            if (date1 > date2 || item.isCompleted == 0) {
                                status = 200;
                                msg = "You can apply for this job."
                            } else {
                                status = 500;
                                msg = "Sorry, you can't apply for this job. You are already working somewhere."
                            }
                        })

                        res.json({ status: status, msg: msg })
                    }
                })
            }
        }
    })
}


//----------------------------------------------------- API for save equipments ------------------------------------------------------

const add_equipment = async(req, res) => {

    const { equipment_name } = req.body;

    await addEquipment();

    function addEquipment() {
        if (!equipment_name) {
            res.json({ status: 422, msg: "Equipment name is required." })
        } else {
            mysql.connection.query('Insert Into tab_equipments set equipment_name =?', [equipment_name], (err, save_equipment) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else {
                    res.json({ status: 200, msg: "Successfully saved equipment." })
                }
            })
        }
    }
}

//-------------------------------------------------------- API for equipment lists -----------------------------------------------------

const equipments = async(req, res) => {

    await equipmentLists();

    function equipmentLists() {
        mysql.connection.query('select * from tab_equipments', (err, list) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error" });
            } else if (list.length == 0) {
                res.json({ status: 404, msg: "No equipments founded.", data: list });
            } else {
                res.json({ status: 200, msg: "Equipment lists founded.", data: list });
            }
        })
    }
}

//----------------------------------------------------------- API for save skills ---------------------------------------------------------------

const add_skill = async(req, res) => {

    var skill_name = req.body.skill_name;
    var sub_category = req.body.sub_category;
    skill_name = skill_name.toUpperCase() || skill_name.toLowerCase() || skill_name


    await addSkill();

    function addSkill() {
        if (!skill_name) {
            res.json({ status: 422, msg: "Skill name is required." })
        } else {
            mysql.connection.query('select * from tab_skills where skill=?', [skill_name], (err, result) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (result.length > 0) {
                    res.json({ status: 500, msg: "Already exists category." })
                } else {
                    mysql.connection.query('Insert into tab_skills set skill =?,parent_id=?', [skill_name, 0], (err, save_skill) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else {
                            res.json({ status: 200, msg: "Successfully added skill." })
                        }
                    })
                }
            })
        }
    }
}

//----------------------------------------------------- API for get skill lists --------------------------------------------------------

const skills = async(req, res) => {

    await skillLists();

    function skillLists() {
        var sql = "SELECT * from tab_skills";
        mysql.connection.query(sql, (err, list) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error.", err })
            } else if (list.length == 0) {
                res.json({ status: 404, msg: "No skill founded.", data: list })
            } else {
                var data = list.filter(d => d.parent_id != 0);
                res.json({ status: 200, msg: "Skill founded.", data: data })
            }
        })
    }
}

//----------------------------------------------- Api for get work now jobs ---------------------------------------------------------------

const get_wok_now_job = async(req, res) => {
    var user_id = req.decoded.user_id;

    await getWorkJobNow();

    function getWorkJobNow() {
        // var sql = "SELECT A.*,B.apply_status, C.name,C.addressline1,C.addressline2,C.city,C.state,C.zipcode,C.zone,D.profile_pic,E.skill AS sub_category,F.skill AS category  FROM `tab_jobs` A  LEFT JOIN `tab_job_apply` B ON A.job_id = B.job_id AND B.user_id=? LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN `tab_users` D ON D.user_id = A.user_id LEFT JOIN tab_skills E ON E.id = A.category LEFT JOIN tab_skills F ON F.id = E.parent_id WHERE A.job_type=1 AND A.visibility=1 AND B.apply_status=1 ORDER BY A.job_id DESC"
        var sql = "SELECT A.*,B.apply_status, C.name,C.addressline1,C.addressline2,C.city,C.state,C.zipcode,C.zone,D.profile_pic,E.skill AS sub_category,F.skill AS category  FROM `tab_jobs` A  LEFT JOIN `tab_job_apply` B ON A.job_id = B.job_id AND B.user_id=? LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN `tab_users` D ON D.user_id = A.user_id LEFT JOIN tab_skills E ON E.id = A.category LEFT JOIN tab_skills F ON F.id = E.parent_id WHERE A.job_type=1 AND A.visibility=1 ORDER BY A.job_id DESC"
        mysql.connection.query(sql, [user_id], (err, result) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (result.length == 0) {
                res.json({ status: 404, msg: "No data found.", data: result })
            } else {
                res.json({ status: 200, msg: "Data found successfully.", data: result })
            }
        })
    }
}

//----------------------------------------------- Api for get long term jobs ---------------------------------------------------------------

const get_long_term_job = async(req, res) => {
    var user_id = req.decoded.user_id;

    await getLongTermJob();

    function getLongTermJob() {
        //    var sql = "SELECT job_id,tab_jobs.user_id, category, location,lat,lng,job_title,job_type,posted_date,hourly_rate,address,start_date,end_date,start_time,end_time,equipment,worker_selection,no_of_opening,visibility,tab_jobs.created_at, name,addressline1,addressline2,city,state,zipcode,zone, tab_users.profile_pic FROM `tab_jobs`, `tab_address`, `tab_users` WHERE tab_jobs.address = tab_address.id and tab_jobs.job_type=0 and visibility =1 and tab_jobs.user_id= tab_users.user_id Order by tab_jobs.job_id DESC";
        var sql = "SELECT A.*,B.apply_status, C.name,C.addressline1,C.addressline2,C.city,C.state,C.zipcode,C.zone,D.profile_pic,E.skill AS sub_category,F.skill AS category FROM `tab_jobs` A  LEFT JOIN `tab_job_apply` B ON A.job_id = B.job_id AND B.user_id=? LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN `tab_users` D ON D.user_id = A.user_id LEFT JOIN tab_skills E ON E.id = A.category LEFT JOIN tab_skills F ON F.id = E.parent_id WHERE A.job_type=0 AND A.visibility=1 ORDER BY A.job_id DESC"
        mysql.connection.query(sql, [user_id], (err, result) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (result.length == 0) {
                res.json({ status: 404, msg: "No data found.", data: result })
            } else {
                res.json({ status: 200, msg: "Data found successfully.", data: result })
            }
        })
    }
}

//----------------------------------- API for get job lists --------------------------------------------------------

const job_lists = async(req, res) => {

    const { job_type } = req.body;
    var user_id = req.decoded.user_id;

    await getJobLists();

    function getJobLists() {
        var sql = 'SELECT A.*,B.name,B.addressline1,B.addressline2,B.city,B.state,B.zipcode,B.zone,C.profile_pic,D.skill AS sub_category,E.skill AS category FROM tab_jobs A LEFT JOIN tab_address B ON B.id=A.address LEFT JOIN tab_users C ON C.user_id = A.user_id LEFT JOIN tab_skills D ON D.id=A.category LEFT JOIN tab_skills E ON E.id = D.parent_id WHERE A.user_id =? AND A.job_type=? ORDER BY job_id DESC'
        mysql.connection.query(sql, [user_id, job_type], (err, result) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error.", err: err })
            } else if (result.length == 0) {
                res.json({ status: 404, msg: "No data found.", data: result })
            } else {
                res.json({ status: 200, msg: "Data found successfully.", data: result })
            }
        })
    }
}


//================================================ API for update profile ============================================================

const update_profile = async(req, res) => {

    const { user_id, first_name, last_name, email, category_id, category_name, skill_id, skill, company_name, profile_pic, language, biography, previous_job } = req.body;

    const host = req.hostname;
    var url = req.protocol + "://" + host + ":2000" + "/";
    const destpath = 'uploads/image';
    const filename = Date.now();

    console.log("skill_id ====>", skill_id)

    var arr = skill_id.split(',');

    await updateProfile();

    function updateProfile() {

        // var filePath = '';
        // var mimetype = '';
        // var new_email = '';


        var base64 = ''

        // if (req.file == undefined) {
        if (!profile_pic) {

            mysql.connection.query('select * from tab_users where email =?', [email], (err, user) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", error1: err })
                    console.log('Error1 ====>', err)
                } else if (user.length == 0) {
                    new_email = email;
                    mysql.connection.query('update tab_users set first_name =?, last_name =?, email =?, profile_pic =?, type =?,company_name =?,skill_id =?,skills=?,category_id=?,category_name=?,language=?,biography=?,previous_job=? where user_id =?', [first_name, last_name, new_email, user[0].profile_pic, user[0].mimetype, company_name, skill_id, skill, category_id, category_name, language, biography, previous_job, user_id], (err, update) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", error2: err })
                            console.log('Error2 ====>', err)
                        } else {
                            mysql.connection.query('Delete from tab_user_skills where user_id=?', [user_id], (err, deleted_skill) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error.", error2: err })
                                    console.log('Error3 ====>', err)
                                } else {
                                    for (var i = 0; i < arr.length; i++) {
                                        mysql.connection.query('Insert into tab_user_skills set user_id=?,skill_id=?', [user_id, arr[i]], (err, save_skill) => {
                                            if (err) {
                                                console.log('Error found')
                                            } else {
                                                console.log('Saved skills');
                                            }
                                        })
                                    }
                                    res.json({ status: 200, msg: "Successfully updated profile." })
                                }
                            })
                        }
                    })

                } else {
                    if (user[0].user_id == user_id) {
                        new_email = user[0].email;

                        mysql.connection.query('update tab_users set first_name =?, last_name =?, email =?,profile_pic =?, company_name=?,skill_id=?,skills=?,category_id=?,category_name=?,language=?,biography=?,previous_job=? where user_id =?', [first_name, last_name, new_email, user[0].profile_pic, company_name, skill_id, skill, category_id, category_name, language, biography, previous_job, user_id], (err, update) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error.", error3: err })
                            } else {
                                mysql.connection.query('Delete from tab_user_skills where user_id=?', [user_id], (err, deleted_skill) => {
                                    if (err) {
                                        res.json({ status: 500, msg: "Internal server error.", error2: err })
                                    } else {
                                        for (var i = 0; i < arr.length; i++) {
                                            mysql.connection.query('Insert into tab_user_skills set user_id=?,skill_id=?', [user_id, arr[i]], (err, save_skill) => {
                                                if (err) {
                                                    console.log('Error found');
                                                } else {
                                                    console.log('Saved skills');
                                                }
                                            })
                                        }
                                        res.json({ status: 200, msg: "Successfully updated profile." })
                                    }
                                })
                            }
                        })
                    } else {
                        res.json({ status: 409, msg: "Email already exists." })
                    }
                }
            })
        } else {
            mysql.connection.query('select * from tab_users where email =?', [email], (err, user) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", error1: err })
                } else if (user.length == 0) {
                    new_email = email;
                    base64Img.img(profile_pic, destpath, filename, function(err, path) {
                        if (err) {
                            res.json({ status: 500, msg: "Error found at image upload." })
                        } else {
                            mysql.connection.query('update tab_users set first_name =?, last_name =?, email =?,profile_pic =?,company_name =?,skill_id=?,skills=?,category_id=?,category_name=?,language=?,biography=?,previous_job=? where user_id =?', [first_name, last_name, new_email, url + path, company_name, skill_id, skill, category_id, category_name, language, biography, previous_job, user_id], (err, update) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error.", error2: err })
                                } else {
                                    mysql.connection.query('Delete from tab_user_skills where user_id=?', [user_id], (err, deleted_skill) => {
                                        if (err) {
                                            res.json({ status: 500, msg: "Internal server error.", error2: err })
                                        } else {
                                            for (var i = 0; i < arr.length; i++) {
                                                mysql.connection.query('Insert into tab_user_skills set user_id=?,skill_id=?', [user_id, arr[i]], (err, save_skill) => {
                                                    if (err) {
                                                        console.log('Error found')
                                                    } else {
                                                        console.log('Saved skills');
                                                    }
                                                })
                                            }
                                            res.json({ status: 200, msg: "Successfully updated profile." })
                                        }
                                    })
                                }
                            })
                        }
                    });
                } else {
                    if (user[0].user_id == user_id) {
                        new_email = user[0].email;

                        base64Img.img(profile_pic, destpath, filename, function(err, path) {
                            if (err) {
                                res.json({ status: 500, msg: "Error found at image upload." })

                            } else {
                                mysql.connection.query('update tab_users set first_name =?, last_name =?, email =?, profile_pic =?,company_name=?,skill_id=?,skills=?,category_id=?,category_name=?,language=?,biography=?,previous_job=? where user_id =?', [first_name, last_name, new_email, url + path, company_name, skill_id, skill, category_id, category_name, language, biography, previous_job, user_id], (err, update) => {
                                    if (err) {
                                        res.json({ status: 500, msg: "Internal server error.", error3: err })
                                    } else {
                                        mysql.connection.query('Delete from tab_user_skills where user_id=?', [user_id], (err, deleted_skill) => {
                                            if (err) {
                                                res.json({ status: 500, msg: "Internal server error.", error2: err })
                                            } else {
                                                for (var i = 0; i < arr.length; i++) {
                                                    mysql.connection.query('Insert into tab_user_skills set user_id=?,skill_id=?', [user_id, arr[i]], (err, save_skill) => {
                                                        if (err) {
                                                            console.log('Error found')
                                                        } else {
                                                            console.log('Saved skills');
                                                        }
                                                    })
                                                }
                                                res.json({ status: 200, msg: "Successfully updated profile." })
                                            }
                                        })
                                    }
                                })
                            }
                        });
                    } else {
                        res.json({ status: 409, msg: "Email already exists." })
                    }
                }
            })
        }
    }
}


//====================================== API for provider update profile ============================================================

const provider_update_profile = async(req, res) => {

    const { user_id, first_name, last_name, email, company_name, profile_pic } = req.body;

    const host = req.hostname;
    var url = req.protocol + "://" + host + ":2000" + "/";
    const destpath = 'uploads/image';
    const filename = Date.now();


    await updateProfile();

    function updateProfile() {

        var base64 = ''

        if (!profile_pic) {
            mysql.connection.query('select * from tab_users where email =?', [email], (err, user) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", error1: err })
                } else if (user.length == 0) {
                    new_email = email;
                    mysql.connection.query('update tab_users set first_name =?, last_name =?, email =?,profile_pic =?,company_name =? where user_id =?', [first_name, last_name, new_email, user[0].profile_pic, company_name, user_id], (err, update) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", error2: err })
                        } else {
                            mysql.connection.query('Delete from tab_user_skills where user_id=?', [user_id], (err, deleted_skill) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error.", error2: err })
                                } else {
                                    res.json({ status: 200, msg: "Successfully updated profile." })
                                }
                            })
                        }
                    })

                } else {
                    if (user[0].user_id == user_id) {
                        new_email = user[0].email;
                        mysql.connection.query('update tab_users set first_name =?, last_name =?, email =?,profile_pic =?,company_name=? where user_id =?', [first_name, last_name, new_email, user[0].profile_pic, company_name, user_id], (err, update) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error.", error3: err })
                            } else {
                                mysql.connection.query('Delete from tab_user_skills where user_id=?', [user_id], (err, deleted_skill) => {
                                    if (err) {
                                        res.json({ status: 500, msg: "Internal server error.", error2: err })
                                    } else {
                                        res.json({ status: 200, msg: "Successfully updated profile." })
                                    }
                                })
                            }
                        })
                    } else {
                        res.json({ status: 409, msg: "Email already exists." })
                    }
                }
            })
        } else {
            mysql.connection.query('select * from tab_users where email =?', [email], (err, user) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", error1: err })
                } else if (user.length == 0) {
                    new_email = email;
                    base64Img.img(profile_pic, destpath, filename, function(err, path) {
                        if (err) {
                            res.json({ status: 500, msg: "Error found at image upload." })
                        } else {
                            mysql.connection.query('update tab_users set first_name =?, last_name =?, email =?, profile_pic =?,company_name =? where user_id =?', [first_name, last_name, new_email, url + path, company_name, user_id], (err, update) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error.", error2: err })
                                } else {
                                    mysql.connection.query('Delete from tab_user_skills where user_id=?', [user_id], (err, deleted_skill) => {
                                        if (err) {
                                            res.json({ status: 500, msg: "Internal server error.", error2: err })
                                        } else {
                                            res.json({ status: 200, msg: "Successfully updated profile." })
                                        }
                                    })
                                }
                            })
                        }
                    });
                } else {
                    if (user[0].user_id == user_id) {
                        new_email = user[0].email;
                        base64Img.img(profile_pic, destpath, filename, function(err, path) {
                            if (err) {
                                res.json({ status: 500, msg: "Error found at image upload." })
                            } else {
                                mysql.connection.query('update tab_users set first_name =?, last_name =?, email =?,profile_pic =?,company_name=? where user_id =?', [first_name, last_name, new_email, url + path, company_name, user_id], (err, update) => {
                                    if (err) {
                                        res.json({ status: 500, msg: "Internal server error.", error3: err })
                                    } else {
                                        mysql.connection.query('Delete from tab_user_skills where user_id=?', [user_id], (err, deleted_skill) => {
                                            if (err) {
                                                res.json({ status: 500, msg: "Internal server error.", error2: err })
                                            } else {
                                                res.json({ status: 200, msg: "Successfully updated profile." })
                                            }
                                        })
                                    }
                                })
                            }
                        });
                    } else {
                        res.json({ status: 409, msg: "Email already exists." })
                    }
                }
            })
        }
    }
}



//-------------------------------------------------- API for save quiz ----------------------------------------------

const add_quiz = async(req, res) => {

    const { question, optionsA, optionsB, optionsC, optionsD, ans } = req.body;

    await addQuiz();

    function addQuiz() {
        if (!question) {
            res.json({ status: 422, msg: "Question is required." })
        } else {
            mysql.connection.query('Insert into tab_quiz set question =?,option A =?,option B =?,option C =?,option D =?,ans =?', [question, optionsA, optionsB, optionsC, optionsD, ans], (err, result) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else {
                    res.json({ status: 200, msg: "Successfully added question." })
                }
            })
        }
    }
}

//================================================ API for save quiz response =================================================

const quiz_response = async(req, res) => {

    const { quiz_id, response } = req.body;
    var user_id = req.decoded.user_id;

    await saveQuizResponse();

    function saveQuizResponse() {
        if (!quiz_id || !user_id || !response) {
            res.json({ status: 422, msg: "Parameter is missing." })
        } else {
            mysql.connection.query('Insert into tab_quiz_response set quiz_id =?, user_id =?, quiz_response=?', [quiz_id, user_id, response], (err, save_response) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else {
                    res.json({ status: 200, msg: "Successfully saved response." })
                }
            })
        }
    }
}

//================================== API for get quiz lists =========================================================

const quiz_list = (req, res) => {

    mysql.connection.query('select * from tab_quiz ', (err, list) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (list.length == 0) {
            res.json({ status: 404, msg: "No quiz founded." })
        } else {
            res.json({ status: 200, msg: "Quiz founded.", data: list })
        }
    })
}


//=============================================== API for delet job posts ================================================

const delete_job_post = async(req, res) => {

    const { job_id } = req.body;
    var user_id = req.decoded.user_id;

    await removeJobPosts();

    function removeJobPosts() {
        mysql.connection.query('delete from tab_jobs where job_id =? and user_id =?', [job_id, user_id], (err, result) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else {

                //28 OCT 2020

                mysql.connection.query('update tab_users set job_id=?,step=? where user_id=? and job_id=?', ['', '', user_id, job_id], (err, update_job_status) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else {
                            res.json({ status: 200, msg: "Job post has been deleted successfully." })
                        }
                    })
                    // res.json({ status: 200, msg: "Job post has been deleted successfully." })
            }
        })
    }
}

//================================================== API for update drug test and background check =======================================

const update_background_check = async(req, res) => {

    const { background_check, user_id } = req.body;

    await updateDrugtestAndBackgroundCheck();

    function updateDrugtestAndBackgroundCheck() {
        mysql.connection.query('update tab_users set  background_check =? where user_id =?', [background_check, user_id], (err, result) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else {
                res.json({ status: 200, msg: "Successfully updated status." })
            }
        })
    }
}

const update_drugtest_check = async(req, res) => {

    const { drug_test, user_id } = req.body;

    await updateDrugtestAndBackgroundCheck();

    function updateDrugtestAndBackgroundCheck() {
        mysql.connection.query('update tab_users set drug_test =? where user_id =?', [drug_test, user_id], (err, result) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else {
                res.json({ status: 200, msg: "Successfully updated status." })
            }
        })
    }
}




//----------------------------------------------------- API for get category ----------------------------------------------------------

const category = async(req, res) => {

    mysql.connection.query('select * from tab_skills where parent_id=0 order by id desc', (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (result.length == 0) {
            res.json({ status: 404, msg: "No data found." })
        } else {

            // var data = result[result.length - 1];
            // data.unshift(result[result.length]);

            res.json({ status: 200, msg: "Category founded.", data: result })
        }
    })
}


//----------------------------------------------------- API for get sub category ----------------------------------------------------------

const sub_category = async(req, res) => {

    const { id } = req.body;

    mysql.connection.query('select * from tab_skills where parent_id=?', [id], (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (result.length == 0) {
            res.json({ status: 404, msg: "No data found." })
        } else {
            res.json({ status: 200, msg: "SubCategory founded.", data: result })
        }
    })
}


//=================================================== API for save quiz score ==========================================================

const quiz_score = async(req, res) => {

    const { score } = req.body;
    var user_id = req.decoded.user_id;

    await saveQuizScore();

    function saveQuizScore() {

        var quiz_score = '';
        var isCompleteProfile = '';

        if (score == '4') {
            quiz_score = score;
            isCompleteProfile = 1;
        } else {
            quiz_score = score;
            isCompleteProfile = 0;
        }

        mysql.connection.query('update tab_users set quiz_score=?, isCompleteProfile=? where user_id =?', [quiz_score, isCompleteProfile, user_id], (err, result) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else {
                res.json({ status: 200, msg: "Successfully saved score." })
            }
        })
    }
}

//-------------------------------------------------- API for get address lists =======================================================

const address_lists = async(req, res) => {

    var user_id = req.decoded.user_id;

    await addressLists();

    function addressLists() {
        mysql.connection.query('select * from tab_address where user_id=?', [user_id], (err, list) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (list.length == 0) {
                res.json({ status: 404, msg: "No address founded." })
            } else {
                res.json({ status: 200, msg: "Addresses founded.", data: list })
            }
        })
    }
}


//================================================= API for chnge password =========================================================

const change_password = async(req, res) => {

    const { old_password, new_password, confirm_password } = req.body;
    var user_id = req.decoded.user_id;

    if (!user_id) {
        res.json({ status: 422, msg: "User Id ie required." })
    } else if (new_password != confirm_password) {
        res.json({ status: 409, msg: "Password and Confirm password does not match." })
    } else {
        mysql.connection.query('SELECT * FROM tab_users where user_id =?', [user_id], (err, user) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." });
            } else if (user.length == 0) {
                res.json({ status: 404, msg: "User does not exists." });
            } else {
                var match = bcrypt.compareSync(old_password, user[0].password);
                if (match == true) {
                    var hash = bcrypt.hashSync(new_password, bcrypt.genSaltSync(10));
                    mysql.connection.query('Update tab_users set password=? where user_id =?', [hash, user_id], (err, update_password) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." });
                        } else {
                            res.json({ status: 200, msg: "Successfully changed password." });
                        }
                    })
                } else {
                    res.json({ status: 400, msg: "You entered wrong old password." });
                }
            }
        })
    }
}

//======================================================= API for logout ========================================================

const logout = async(req, res) => {

    var user_id = req.decoded.user_id;

    mysql.connection.query('update tab_users set token =? where user_id =?', ['', user_id], (err, update_token) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." });
        } else {
            res.json({ status: 200, msg: "Successfully logout." });
        }
    })
}


//========================================== API for notification lists ========================================================

const notification_lists = async(req, res) => {
    var user_id = req.decoded.user_id;

    mysql.connection.query('SELECT tab_notification.id,tab_notification.job_id,tab_notification.user_id,tab_notification.message,tab_notification.lat,tab_notification.lng,tab_notification.job_type,tab_notification.distance,tab_notification.status AS job_status,tab_notification.created_date FROM tab_notification WHERE user_id=? ORDER BY id DESC', [user_id], (err, list) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (list.length == 0) {
            res.json({ status: 404, msg: "No data found.", data: list })
        } else {
            res.json({ status: 200, msg: "Notifications founded.", data: list, count: list.length })
        }
    })
}


//============================================ COntact Us ==========================================================================

const contact_us = async(req, res) => {

    const { title, description, role_id } = req.body;
    var user_id = req.decoded.user_id;

    await contactUS();

    function contactUS() {
        if (!user_id) {
            res.json({ status: 422, msg: "UserId is required." })
        } else {
            mysql.connection.query('Insert into tab_contact_us set user_id =?,role_id=?, title =?,description =? ', [user_id, role_id, title, description], (err, result) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else {
                    res.json({ status: 200, msg: "Successfully saved contact us form." })
                }
            })
        }
    }
}

//============================================= API for apply jobs ===========================================================

const apply_job = async(req, res) => {

    const { job_id } = req.body;
    var user_id = req.decoded.user_id;

    await jobAPPLY();

    function jobAPPLY() {

        if (!user_id || !job_id) {
            res.json({ status: 422, msg: "UserId and JobId both are required." })
        } else {
            mysql.connection.query('select A.*,B.skill from tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category where A.job_id =?', [job_id], (err, job) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", err: err })
                } else if (job.length == 0) {
                    res.json({ status: 404, msg: "No job founded." }) // check job is closed or not 
                } else {

                    var job_date = moment(new Date(`${job[0].start_date}`)).format('MM/DD/YYYY')
                    var current_date = moment(new Date()).format('MM/DD/YYYY');

                    if (job_date >= current_date) {

                        //find provider id to send notification
                        mysql.connection.query('select * from tab_users where user_id=?', [job[0].user_id], (err, user) => { //here job[0].user_id ==> job provider id
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error." })
                            } else if (user.length == 0) {
                                res.json({ status: 404, msg: "No user founded." })
                            } else {
                                //insert seeker id with job id at applied job 
                                mysql.connection.query('insert into tab_job_apply set user_id =? , job_id =?,apply_status=?', [user_id, job_id, 1], (err, result) => {
                                    if (err) {
                                        res.json({ status: 500, msg: "Internal server error.", err: err })
                                    } else {
                                        // find seeker id to send notification 
                                        mysql.connection.query('select * from tab_users where user_id =?', [user_id], (err, seeker) => {
                                            if (err) {
                                                res.json({ status: 500, msg: "Internal server error." })
                                            } else if (seeker.length == 0) {
                                                res.json({ status: 404, msg: "No Seeker's founded." })
                                            } else {

                                                //23 NOV
                                                // update progress bar status (status =1 ) for apply seeker 

                                                mysql.connection.query('update tab_users set progress_bar_status=? where user_id=?', [1, user_id], (err, update_progress_bar) => {
                                                    if (err) {
                                                        res.json({ status: 500, msg: "Error found while update progress bar status." })
                                                    } else {

                                                        var title = `${seeker[0].first_name} ${seeker[0].last_name} applied for this ${job[0].skill} job post.`;
                                                        var text = `${job[0].job_title}`;

                                                        var recieverId = user[0].user_id;
                                                        var senderId = seeker[0].user_id;
                                                        var RoleId = user[0].role_id;
                                                        var JOB = job_id.toString();

                                                        var data = { //data
                                                            "job_id": JOB, //job_id
                                                            "sender_id": senderId.toString(), //seeker id
                                                            "receiver_id": recieverId.toString(), // provider id
                                                            "role_id": RoleId.toString(),
                                                            "isCompleted": "1"
                                                        }

                                                        console.log("datatta ====>", data)
                                                        common_function.send_push_notification(user[0].device_token, title, text, data);
                                                        mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [job_id, user[0].user_id, title, job[0].lat, job[0].lng, 0, seeker[0].distance, 2], (err, save_notification) => {
                                                            if (err) {
                                                                console.log('Error found in save notification.')
                                                            } else {
                                                                res.json({ status: 200, msg: "Successfully applied job." })

                                                                //4 june 2020 

                                                                // mysql.connection.query('Insert into tab_job_application_status set job_id=?, user_id=?,message=?', [job_id, user_id, `You applied for this ${job[0].skill} job post.`], (err, save_application) => {
                                                                //     if (err) {
                                                                //         console.log('Error found in job application notification.')
                                                                //     } else {
                                                                //         console.log('Save job application status into DB.')
                                                                //     }
                                                                // })
                                                                // res.json({ status: 200, msg: "Successfully applied job." })
                                                            }
                                                        })

                                                    }
                                                })
                                            }
                                        })
                                    }
                                })
                            }
                        })
                    } else {
                        res.json({ status: 500, msg: "You can't apply this job." })
                    }
                }
            })
        }
    }
}


//====================================== API for sorting / filter jobs =======================================================

const filter_job = async(req, res) => {

        const { hourly_rate, keyword, skill, job_type } = req.body;

        var user_id = req.decoded.user_id;

        // hourly_rate = 1 (job desc) , 2 job asc , 3 recent added
        var sequence = '';
        var sql = '';

        if (hourly_rate == 1) {
            sequence = 'A.hourly_rate DESC'
        } else if (hourly_rate == 2) {
            sequence = 'A.hourly_rate ASC'
        } else {
            sequence = 'A.created_at DESC'
        }

        if (keyword == '') {
            // sql = `SELECT A.*,D.apply_status,E.profile_pic, B.skill, B.parent_id, C.name, C.addressline1, C.addressline2, C.city, C.state, C.zipcode, C.zone FROM tab_jobs A  LEFT JOIN tab_job_apply D ON A.job_id = D.job_id AND D.user_id=? LEFT JOIN tab_users E ON E.user_id = A.user_id LEFT JOIN tab_skills B ON A.category = B.id LEFT JOIN tab_address C ON C.id = A.address WHERE B.skill LIKE '%${skill}%' AND visibility = 1 AND A.job_type =? AND D.apply_status=1 ORDER BY ${sequence} `
            sql = `SELECT A.job_id,A.user_id,F.skill AS category,A.location,A.lat,A.lng,A.job_title,A.job_type,A.posted_date,A.hourly_rate,address,A.start_date,A.end_date,A.start_time,A.end_time,A.equipment,A.worker_selection,A.no_of_opening,A.visibility ,A.booking_status,A.created_at,D.apply_status,E.profile_pic, B.skill AS sub_category, B.parent_id, C.name, C.addressline1, C.addressline2, C.city, C.state, C.zipcode, C.zone FROM tab_jobs A  LEFT JOIN tab_job_apply D ON A.job_id = D.job_id AND D.user_id=? LEFT JOIN tab_users E ON E.user_id = A.user_id LEFT JOIN tab_skills B ON A.category = B.id LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN tab_skills F ON F.id = B.parent_id WHERE B.skill LIKE '%${skill}%' AND visibility = 1 AND A.job_type =?  ORDER BY ${sequence} `

            console.log("sql =====>", sql)
        } else if (skill == '') {
            // sql = `SELECT A.*,D.apply_status,E.profile_pic, B.skill, B.parent_id, C.name, C.addressline1, C.addressline2, C.city, C.state, C.zipcode, C.zone FROM tab_jobs A  LEFT JOIN tab_job_apply D ON A.job_id = D.job_id AND D.user_id=? LEFT JOIN tab_users E ON E.user_id = A.user_id LEFT JOIN tab_skills B ON A.category = B.id LEFT JOIN tab_address C ON C.id = A.address WHERE  A.job_title LIKE '%${keyword}%' AND visibility = 1 AND A.job_type =? AND D.apply_status=1 ORDER BY ${sequence} `
            sql = `SELECT A.job_id,A.user_id,F.skill AS category,A.location,A.lat,A.lng,A.job_title,A.job_type,A.posted_date,A.hourly_rate,address,A.start_date,A.end_date,A.start_time,A.end_time,A.equipment,A.worker_selection,A.no_of_opening,A.visibility ,A.booking_status,A.created_at, D.apply_status,E.profile_pic, B.skill AS sub_category, B.parent_id, C.name, C.addressline1, C.addressline2, C.city, C.state, C.zipcode, C.zone FROM tab_jobs A  LEFT JOIN tab_job_apply D ON A.job_id = D.job_id AND D.user_id=? LEFT JOIN tab_users E ON E.user_id = A.user_id LEFT JOIN tab_skills B ON A.category = B.id LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN tab_skills F ON F.id = B.parent_id WHERE  A.job_title LIKE '%${keyword}%' AND visibility = 1 AND A.job_type =?  ORDER BY ${sequence} `

            console.log("sql =====>", sql)
        } else {
            // sql = `SELECT A.*,D.apply_status,E.profile_pic, B.skill, B.parent_id, C.name, C.addressline1, C.addressline2, C.city, C.state, C.zipcode, C.zone FROM tab_jobs A  LEFT JOIN tab_job_apply D ON A.job_id = D.job_id AND D.user_id=? LEFT JOIN tab_users E ON E.user_id = A.user_id LEFT JOIN tab_skills B ON A.category = B.id LEFT JOIN tab_address C ON C.id = A.address WHERE B.skill LIKE '%${skill}%' OR A.job_title LIKE '%${keyword}%' AND visibility = 1 AND A.job_type =? AND D.apply_status=1 ORDER BY ${sequence} `
            sql = `SELECT A.job_id,A.user_id,F.skill AS category,A.location,A.lat,A.lng,A.job_title,A.job_type,A.posted_date,A.hourly_rate,address,A.start_date,A.end_date,A.start_time,A.end_time,A.equipment,A.worker_selection,A.no_of_opening,A.visibility ,A.booking_status,A.created_at,D.apply_status,E.profile_pic, B.skill AS sub_category, B.parent_id, C.name, C.addressline1, C.addressline2, C.city, C.state, C.zipcode, C.zone FROM tab_jobs A  LEFT JOIN tab_job_apply D ON A.job_id = D.job_id AND D.user_id=? LEFT JOIN tab_users E ON E.user_id = A.user_id LEFT JOIN tab_skills B ON A.category = B.id LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN tab_skills F ON F.id = B.parent_id WHERE B.skill LIKE '%${skill}%' OR A.job_title LIKE '%${keyword}%' AND visibility = 1 AND A.job_type =? ORDER BY ${sequence} `

            console.log("sql =====>", sql)
        }

        mysql.connection.query(sql, [user_id, job_type], (err, list) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error", err: err })
            } else if (list.length == 0) {
                res.json({ status: 404, msg: "No data found.", data: list })
            } else {
                res.json({ status: 200, msg: "Data found.", data: list })
            }
        })
    }
    //=================================== Profile =================================================

const profile = async(req, res) => {
    var role_id = 111;

    // var message = {
    //     "token": req.body.device_token,
    //     "notification": {
    //         title: 'RockStaffing!',
    //         body: 'Hi! this is Akash Notify!'
    //     },
    //     "data": {
    //         sender_name: 'Akash',
    //         receiver_name: "Sachin",
    //         role_id: role_id.toString()
    //     },
    //     "android": {
    //         "priority": "high",
    //         "notification": {
    //             "click_action": "FLUTTER_NOTIFICATION_CLICK"
    //         },
    //     },
    //     "apns": {
    //         "headers": {
    //             "apns-priority": "5",
    //         },
    //         "payload": {
    //             "aps": {
    //                 "category": "NEW_MESSAGE_CATEGORY"
    //             }
    //         }
    //     },
    //     "webpush": {
    //         "headers": {
    //             "Urgency": "high"
    //         }
    //     }
    // };

    var message = {
        "token": req.body.device_token,
        "notification": {
            title: 'RockStaffing!',
            body: 'Hi! this is Akash Notify!'
        },
        "data": {
            sender_name: 'Akash',
            receiver_name: "Sachin",
            role_id: '1',
            isCompleted: "0"
        },
        "android": {
            "priority": "high",
            "notification": {
                "click_action": "FLUTTER_NOTIFICATION_CLICK"
            },
        },
        "apns": {
            "payload": {
                "aps": {
                    // "alert": {
                    //     "title": "Game Request",
                    //     "subtitle": "Five Card Draw",
                    //     "body": "Bob wants to play poker"
                    // },
                    "category": "NEW_MESSAGE_CATEGORY"
                }
            },
            "headers": {
                "apns-priority": "5",
            }
        },
        "webpush": {
            "headers": {
                "Urgency": "high"
            }
        }
    };

    console.log("messgae ====>", message)

    // Send a message to the device corresponding to the provided
    // registration token.
    admin.messaging().send(message)
        .then((response) => {
            // Response is a message ID string.
            console.log('Successfully sent message:', response);

            res.json({ status: 200, msg: "Successfully sent message", response: response })
        })
        .catch((error) => {
            console.log('Error sending message:', error);
            res.json({ status: 500, msg: "Error sending message", err: error })

        });
}


// =========================================== API for Update distance  =================================================

const update_distance = async(req, res) => {
    console.log("distance save ==>")
    const { distance, work_lat, work_long } = req.body;
    var user_id = req.decoded.user_id;

    await updateDistance();

    function updateDistance() {
        mysql.connection.query('update tab_users set distance =?,work_lat=?,work_lng=? where user_id=?', [distance, work_lat, work_long, user_id], (err, update_data) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else {
                res.json({ status: 200, msg: "Successfully saved distace." })
            }
        })
    }
}

//========================================= APi for change status(seeker accept/decline jobs) =============================

const change_status = async(req, res) => {
    const { job_id, notification_id, status } = req.body;
    var user_id = req.decoded.user_id; //job seeker user id

    await changeStatus();

    function changeStatus() {
        if (status == "1") { //accept 
            mysql.connection.query('select * from tab_jobs where job_id=? AND visibility=1', [job_id], (err, job) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (job.length == 0) {
                    res.json({ status: 404, msg: "Job has been expired." }) //check job is close or not
                } else {
                    mysql.connection.query('select * from tab_job_apply where job_id=?', [job_id], (err, apply_data) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", err1: err })
                        } else {
                            var condition = apply_data.filter(d => d.user_id == user_id && d.apply_status == 1 && (d.provider_acceptance == 1 || d.provider_acceptance == null))
                            if (condition.length > 0) {
                                res.json({ status: 500, msg: "You already applied on this job.", err1: err })
                            } else if (job[0].worker_selection == 1 && job[0].no_of_opening == apply_data.length) {
                                mysql.connection.query('insert into tab_job_apply set user_id =?,job_id =?,apply_status=3', [user_id, job_id], (err, insertData) => {
                                    if (err) {
                                        res.json({ status: 500, msg: "Internal server error." })
                                    } else {
                                        res.json({ status: 400, msg: "Job is full." })
                                    }
                                })
                            } else {
                                mysql.connection.query('insert into tab_job_apply set user_id =?,job_id =?,apply_status=?', [user_id, job_id, 1], (err, result) => {
                                    if (err) {
                                        res.json({ status: 500, msg: "Internal server error.", err: err })
                                    } else {
                                        mysql.connection.query('delete from tab_notification where id=?', [notification_id], (err, delete_notification) => {
                                            if (err) {
                                                res.json({ status: 500, msg: "Internal server error.", err: err })
                                            } else {
                                                var sql = 'SELECT A.id,D.user_id AS seeker_id, D.first_name,D.last_name,D.profile_pic,D.distance,D.role_id, A.job_id, B.user_id AS provider_id,B.job_title,B.job_type,B.lat,B.lng,C.role_id, C.device_type, C.device_token FROM tab_job_apply A LEFT JOIN tab_jobs B ON B.job_id = A.job_id LEFT JOIN tab_users C ON C.user_id = B.user_id LEFT JOIN tab_users D ON D.user_id=A.user_id WHERE A.job_id =? AND A.user_id =?'
                                                mysql.connection.query(sql, [job_id, user_id], (err, user) => {
                                                    if (err) {
                                                        res.json({ status: 500, msg: "Internal server error.", err: err })
                                                    } else {

                                                        var ttl = `Congratulations! ${user[0].first_name} has accepted "${user[0].job_title}" the job`; //title
                                                        var text = `${user[0].job_title}`; //body
                                                        var latitude = user[0].lat;
                                                        var longitude = user[0].lng;
                                                        var RoleId = user[0].role_id;
                                                        var JOB = job_id;
                                                        var senderID = user_id;
                                                        var recieverId = user[0].provider_id;

                                                        var data = { //data
                                                            "job_id": JOB.toString(), //job_id
                                                            "sender_id": senderID.toString(), //seeker provider user id
                                                            "receiver_id": recieverId.toString(),
                                                            "role_id": RoleId.toString(),
                                                            "lat": latitude.toString(),
                                                            "long": longitude.toString(),
                                                            "isCompleted": "1"

                                                        }
                                                        common_function.send_push_notification(user[0].device_token, ttl, text, data);
                                                        mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [job_id, user[0].provider_id, ttl, user[0].lat, user[0].lng, user[0].job_type, user[0].distance, 2], (err, save_notification) => {
                                                            if (err) {
                                                                res.json({ status: 500, msg: "Internal server error.", err: err })
                                                            } else {
                                                                //23 NOV
                                                                // update progress bar status (status =1 ) for apply seeker 
                                                                mysql.connection.query('update tab_users set progress_bar_status=? where user_id=?', [1, user_id], (err, update_progress_bar) => {
                                                                    if (err) {
                                                                        res.json({ status: 500, msg: "Error found while update progress bar status." })
                                                                    } else {
                                                                        res.json({ status: 200, msg: "Congratulations! You have accepted the job." })
                                                                    }
                                                                })
                                                            }
                                                        })
                                                    }
                                                })
                                            }
                                        })
                                    }
                                })
                            }
                        }
                    })
                }
            })
        } else if (status == "2") { //reject
            mysql.connection.query('select * from tab_jobs where job_id=? AND visibility=1', [job_id], (err, job) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (job.length == 0) {
                    res.json({ status: 404, msg: "Job has been expired." })
                } else {
                    mysql.connection.query('delete from tab_notification where id=?', [notification_id], (err, delete_notification) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", err: err })
                        } else {
                            mysql.connection.query('insert into tab_job_apply set user_id =? , job_id =?,apply_status=?', [user_id, job_id, 2], (err, result) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error.", err: err })
                                } else {
                                    res.json({ status: 200, msg: "Successfully Rejected job." })
                                }
                            })
                        }
                    })
                }
            })
        } else {
            res.json({ status: 400, msg: "Please provide status value." })
        }
    }
}




//========================================= APi for change status(accept/decline jobs) =============================

const change_status_automatic = async(req, res) => {
    const { job_id, notification_id, status } = req.body;
    var user_id = req.decoded.user_id; //job seeker user id
    await changeStatus();

    function changeStatus() {
        if (status == "1") { //accept 
            mysql.connection.query('select * from tab_jobs where job_id=? AND visibility=1', [job_id], (err, job) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (job.length == 0) {
                    res.json({ status: 404, msg: "Job has been expired." }) //check job is close or not
                } else {
                    mysql.connection.query('select * from tab_job_apply where job_id=?', (err, apply_data) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", err1: err })
                        } else if (job[0].no_of_opening == apply_data.length) {
                            mysql.connection.query('insert into tab_job_apply set user_id =?,job_id =?,apply_status=3', [user_id, job_id], (err, insertData) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error." })
                                } else {
                                    res.json({ status: 400, msg: "Job is full." })
                                }
                            })
                        } else {
                            var condition = apply_data.filter(d => d.user_id == user_id && d.apply_status == 1 && (d.provider_acceptance == 1 || d.provider_acceptance == null))
                            if (condition.length > 0) {
                                res.json({ status: 500, msg: "You already applied on this job.", err1: err })
                            } else {
                                mysql.connection.query('insert into tab_job_apply set user_id =? ,job_id =?,apply_status=?', [user_id, job_id, 1], (err, result) => {
                                    if (err) {
                                        res.json({ status: 500, msg: "Internal server error.", err: err })
                                    } else {
                                        mysql.connection.query('delete from tab_notification where id=?', [notification_id], (err, delete_notification) => {
                                            if (err) {
                                                res.json({ status: 500, msg: "Internal server error.", err: err })
                                            } else {
                                                var sql = 'SELECT A.id,D.user_id AS seeker_id, D.first_name,D.last_name,D.profile_pic,D.distance,D.role_id, A.job_id, B.user_id AS provider_id,B.job_title,B.job_type,B.lat,B.lng,C.role_id, C.device_type, C.device_token FROM tab_job_apply A LEFT JOIN tab_jobs B ON B.job_id = A.job_id LEFT JOIN tab_users C ON C.user_id = B.user_id LEFT JOIN tab_users D ON D.user_id=A.user_id WHERE A.job_id =? AND A.user_id =?'
                                                mysql.connection.query(sql, [job_id, user_id], (err, user) => {
                                                    if (err) {
                                                        res.json({ status: 500, msg: "Internal server error.", err: err })
                                                    } else {

                                                        var ttl = `${user[0].first_name}  has accepted the job "${user[0].job_title}"`; //title
                                                        var text = `${user[0].job_title}`; //body

                                                        var latitude = user[0].lat;
                                                        var longitude = user[0].lng;
                                                        var RoleId = user[0].role_id;
                                                        var JOB = job_id;
                                                        var senderID = user_id;
                                                        var recieverId = user[0].provider_id;

                                                        var data = { //data
                                                            "job_id": JOB.toString(), //job_id
                                                            "sender_id": senderID.toString(), //seeker provider user id
                                                            "receiver_id": recieverId.toString(),
                                                            "role_id": RoleId.toString(),
                                                            "lat": latitude.toString(),
                                                            "long": longitude.toString(),
                                                            "isCompleted": "1"

                                                        }
                                                        common_function.send_push_notification(user[0].device_token, ttl, text, data);
                                                        mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [job_id, user[0].provider_id, ttl, user[0].lat, user[0].lng, user[0].job_type, user[0].distance, 2], (err, save_notification) => {
                                                            if (err) {
                                                                res.json({ status: 500, msg: "Internal server error.", err: err })

                                                            } else {
                                                                res.json({ status: 200, msg: "Successfully Accepted job." })
                                                            }
                                                        })
                                                    }
                                                })
                                            }
                                        })
                                    }
                                })
                            }
                        }
                    })
                }
            })
        } else if (status == "2") { //reject
            mysql.connection.query('select * from tab_jobs where job_id=? AND visibility=1', [job_id], (err, job) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (job.length == 0) {
                    res.json({ status: 404, msg: "Job has been expired." })
                } else {
                    mysql.connection.query('delete from tab_notification where id=?', [notification_id], (err, delete_notification) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", err: err })
                        } else {
                            mysql.connection.query('insert into tab_job_apply set user_id =? , job_id =?,apply_status=?', [user_id, job_id, 2], (err, result) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error.", err: err })
                                } else {
                                    res.json({ status: 200, msg: "Successfully Rejected job." })
                                }
                            })
                        }
                    })
                }
            })
        } else {
            res.json({ status: 400, msg: "Please provide status value." })
        }
    }
}







//==================================== cron job for expire long term jobs =====================================


cron.schedule('*/2 * * * *', () => {
    // console.log('running a task every two minutes');

    mysql.connection.query('select * from tab_jobs where job_type=0 and visibility=1', (err, job_list) => {
        if (err) {
            console.log("Error found");
        } else if (job_list.length == 0) {
            console.log("No data found");
        } else {

            for (var i = 0; i < job_list.length; i++) {

                var posted_date = job_list[i].posted_date;
                var date1 = new Date(posted_date);
                var today = new Date();

                var getDate = `'${(today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear()}'`;
                // console.log('getDate ==>', getDate);

                var date2 = new Date(getDate);
                var diffDays = parseInt((date2 - date1) / (1000 * 60 * 60 * 24)); //gives day difference 
                // console.log("diffDays===>", diffDays)

                if (diffDays == 30) {
                    mysql.connection.query('update tab_jobs set visibility=0 where job_id=?', [job_list[i].job_id], (err, update_job) => {
                        if (err) {
                            console.log('Error found in expire job.')
                        } else {
                            console.log('Job has been expire.')
                        }
                    })
                } else {
                    console.log('No job expired.')
                }
            }
        }
    })
});


//======================================== API for repost long term job =========================================

const repost_long_term_job = async(req, res) => {

    const { job_id, job_title, posted_date } = req.body;
    var user_id = req.decoded.user_id;

    await repostLongTermJObPost();

    function repostLongTermJObPost() {
        if (!job_id || !user_id) {
            res.json({ status: 422, msg: "UserId and JobId both are required." })
        } else {
            mysql.connection.query('select A.*,B.skill,C.company_name from tab_jobs A LEFT JOIN tab_skills B ON A.category=B.id LEFT JOIN tab_users C ON C.user_id = A.user_id where A.job_id=? and A.user_id=? and A.job_type=0 and A.visibility=0', [job_id, user_id], (err, old_job) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", error1: err })
                } else if (old_job.length == 0) {
                    res.json({ status: 404, msg: "No data found." })
                } else {
                    var obj = [old_job[0].user_id, old_job[0].category, old_job[0].location, old_job[0].lat, old_job[0].lng, job_title, 0, posted_date, old_job[0].hourly_rate, old_job[0].address, old_job[0].no_of_opening, 1];
                    mysql.connection.query('Insert into tab_jobs set user_id=?,category=?,location=?,lat=?,lng=?,job_title=?,job_type=?,posted_date=?,hourly_rate=?,address=?,no_of_opening=?,visibility=?', obj, (err, save_new_job) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", error2: err })
                        } else {
                            mysql.connection.query('delete from tab_jobs where job_id=?', [job_id], (err, delete_old_job_post) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error.", error3: err })
                                } else {

                                    var sql = 'SELECT B.user_id,B.first_name,B.last_name,B.email,B.profile_pic,B.company_name,A.skill_id,B.category_id,B.category_name,B.ssn,B.dob,B.distance,B.background_check,B.drug_test,B.role_id,B.isCompleteProfile,B.token,B.device_type,B.device_token,B.quiz_score,B.lat,B.lng,B.work_lat,B.work_lng,B.created_at FROM `tab_user_skills` A LEFT JOIN tab_users B ON A.user_id = B.user_id WHERE (A.skill_id=? || A.skill_id=46) AND B.role_id=2 and B.isCompleteProfile=1'
                                        // var sql = 'select * from tab_users where role_id=2 and isCompleteProfile=1'
                                    mysql.connection.query(sql, (err, user_list) => {
                                        if (err) {
                                            console.log("Notification is not sent")
                                        } else {
                                            for (var i = 0; i < user_list.length; i++) {
                                                var ttl = `You have been invited to w ork on a job of ${old_job[0].skill} at ${old_job[0].company_name}`; //title
                                                var text = `${job_title}.`; //body

                                                var saveId = save_new_job.insertId;
                                                var ID = user_id;
                                                var receiverId = user_list[i].user_id;
                                                var RoleId = user_list[i].role_id;
                                                var latitude = old_job[0].lat;
                                                var longitude = old_job[0].lng;

                                                var data = { //data
                                                    "job_id": saveId.toString(), //job_id
                                                    "sender_id": ID.toString(), //seeker provider user id
                                                    "receiver_id": receiverId.toString(),
                                                    "role_id": RoleId.toString(),
                                                    "lat": latitude.toString(),
                                                    "long": longitude.toString(),
                                                    "isCompleted": "1"

                                                }
                                                common_function.send_push_notification(user_list[i].device_token, ttl, text, data);
                                                mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [save_new_job.insertId, user_list[i].user_id, ttl, old_job[0].lat, old_job[0].lng, 0, user_list[i].distance, 1], (err, save_notification) => {
                                                    if (err) {
                                                        console.log('Error found in save notification.')
                                                    } else {
                                                        console.log('Save Notifications into DB.')
                                                    }
                                                })
                                            }
                                        }
                                    })
                                    res.json({ status: 200, msg: "Successfully repost long term job.", job_id: save_new_job.insertId })
                                }
                            })
                        }
                    })
                }
            })
        }
    }
}


//====================================================== API for repost work now jobs ===================================================

const repost_work_post_job = async(req, res) => {

    const { job_id, job_title, start_date, end_date, start_time, end_time } = req.body;
    var user_id = req.decoded.user_id;

    var skill = '';

    if (!job_id || !user_id) {
        res.json({ status: 422, msg: "UserId and JobId both are required." })
    } else {
        mysql.connection.query('select A.*,B.skill,C.company_name from tab_jobs A LEFT JOIN tab_skills B ON A.category=B.id LEFT JOIN tab_users C ON C.user_id = A.user_id where A.job_id=? and A.user_id=? and A.job_type=1 and A.visibility=0', [job_id, user_id], (err, old_job) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (old_job.length == 0) {
                res.json({ status: 500, msg: "No data found." })
            } else {
                skill = old_job[0].category;
                var obj = [old_job[0].user_id, old_job[0].category, old_job[0].location, old_job[0].lat, old_job[0].lng, job_title, 1, start_date, end_date, start_time, end_time, old_job[0].equipment, old_job[0].worker_selection, old_job[0].hourly_rate, old_job[0].address, old_job[0].no_of_opening, 1];
                mysql.connection.query('Insert into tab_jobs set user_id=?,category=?,location=?,lat=?,lng=?,job_title=?,job_type=?,start_date=?,end_date=?,start_time=?,end_time=?,equipment=?,worker_selection=?,hourly_rate=?,address=?,no_of_opening=?,visibility=?', obj, (err, save_new_job) => {

                    if (err) {
                        res.json({ status: 500, msg: "Internal server error." })
                    } else {
                        mysql.connection.query('delete from tab_jobs where job_id=?', [job_id], (err, delete_old_job_post) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error." })
                            } else {
                                var sql = 'SELECT B.user_id,B.first_name,B.last_name,B.email,B.profile_pic,B.company_name,A.skill_id,B.category_id,B.category_name,B.ssn,B.dob,B.distance,B.background_check,B.drug_test,B.role_id,B.isCompleteProfile,B.token,B.device_type,B.device_token,B.quiz_score,B.lat,B.lng,B.work_lat,B.work_lng,B.created_at FROM `tab_user_skills` A LEFT JOIN tab_users B ON A.user_id = B.user_id WHERE (A.skill_id=? || A.skill_id=46) AND B.role_id=2 and B.isCompleteProfile=1'
                                    // var sql = 'select * from tab_users where role_id=2 and isCompleteProfile=1'
                                mysql.connection.query(sql, [skill], (err, user_list) => {
                                    if (err) {
                                        console.log("Error found.")
                                    } else if (user_list.length == 0) {
                                        console.log("No seeker found.")
                                    } else {
                                        for (var i = 0; i < user_list.length; i++) {
                                            var ttl = `You have been invited to work on a job of ${old_job[0].skill} at ${old_job[0].company_name}`; //title
                                            var text = `${job_title}.`; //body


                                            var saveId = save_new_job.insertId;
                                            var ID = user_id;
                                            var receiverId = user_list[i].user_id;
                                            var RoleId = user_list[i].role_id;
                                            var latitude = old_job[0].lat;
                                            var longitude = old_job[0].lng;

                                            var data = { //data
                                                "job_id": saveId.toString(), //job_id
                                                "sender_id": ID.toString(), //seeker provider user id
                                                "receiver_id": receiverId.toString(),
                                                "role_id": RoleId.toString(),
                                                "lat": latitude.toString(),
                                                "long": longitude.toString(),
                                                "isCompleted": "1"

                                            }

                                            var job = {
                                                lat: old_job[0].lat,
                                                lon: old_job[0].lng
                                            }
                                            var user = '';

                                            if (user_list[i].work_lat != null && user_list[i].work_lng != null) {
                                                user = {
                                                    lat: Number(user_list[i].work_lat),
                                                    lon: Number(user_list[i].work_lng)
                                                }
                                            }

                                            console.log('job location', job);
                                            console.log('user location', user_list[i].user_id, user)

                                            var distance = geolib.getDistance(job, user);
                                            var d = distance / 1000;
                                            console.log('diffrence', d)

                                            if (d <= Number(user_list[i].distance)) {
                                                common_function.send_push_notification(user_list[i].device_token, ttl, text, data);
                                                mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [save_new_job.insertId, user_list[i].user_id, ttl, old_job[0].lat, old_job[0].lng, 1, user_list[i].distance, 1], (err, save_notification) => {
                                                    if (err) {
                                                        console.log('Error found in save notification.')
                                                    } else {
                                                        console.log('Save Notifications into DB.')
                                                    }
                                                })
                                            } else {
                                                console.log('No seeker found to send notification.')
                                            }
                                        }
                                    }
                                })
                                res.json({ status: 200, msg: "Successfully repost work now job.", job_id: save_new_job.insertId })
                            }
                        })
                    }
                })
            }
        })
    }
}

//========================================= API for find number of peoples ========================================

const find_no_people = async(req, res) => {

    var user_id = req.decoded.user_id; // job provider id

    if (!user_id) {
        res.json({ status: 422, msg: "UserId is required." })
    } else {
        var sql1 = "SELECT A.*,B.skill,C.skill As category, D.name,D.addressline1,D.addressline2,D.city,D.state,D.zipcode,D.zone FROM tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category LEFT JOIN tab_skills C ON C.id=B.parent_id LEFT JOIN tab_address D ON D.id=A.address WHERE A.job_id=?"
        mysql.connection.query(sql1, [req.body.job_id], (err, job_detail) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error.", err1: err })
            } else if (job_detail.length == 0) {
                res.json({ status: 200, msg: "Successfully found number of people who accepeted this job.", data: list, job_detail: job_detail })
            } else {
                // var sql = "SELECT A.*,B.first_name,B.last_name,B.profile_pic FROM tab_job_apply A LEFT JOIN tab_users B ON A.user_id=B.user_id WHERE A.job_id=? AND A.provider_acceptance=1";
                var sql = "SELECT A.*,B.first_name,B.last_name,B.profile_pic FROM tab_job_apply A LEFT JOIN tab_users B ON A.user_id=B.user_id WHERE A.job_id=?";
                mysql.connection.query(sql, [req.body.job_id], (err, list) => {
                    if (err) {
                        res.json({ status: 500, msg: "Internal server error.", err2: err })
                    } else if (list.length == 0) {
                        var current_seeker = list.filter(d => d.provider_acceptance == 1);
                        res.json({ status: 200, msg: "No Seeker's found.", data: list, current_seeker_lenght: current_seeker.length, job_detail: job_detail })
                    } else {
                        res.json({ status: 200, msg: "Successfully found number of people who accepeted this job.", data: list, job_detail: job_detail })
                    }
                })
            }
        })
    }
}


//============================================ API for manual find no people ===============================================================

const find_no_people_manual = async(req, res) => {

    var user_id = req.decoded.user_id; // job provider id

    if (!user_id) {
        res.json({ status: 422, msg: "UserId is required." })
    } else {
        var sql1 = "SELECT A.*,B.skill,C.skill As category, D.name,D.addressline1,D.addressline2,D.city,D.state,D.zipcode,D.zone FROM tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category LEFT JOIN tab_skills C ON C.id=B.parent_id LEFT JOIN tab_address D ON D.id=A.address WHERE A.job_id=?"
        mysql.connection.query(sql1, [req.body.job_id], (err, job_detail) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error.", err1: err })
                console.log("Internal server error. 1====>", err);
            } else if (job_detail.length == 0) {
                res.json({ status: 200, msg: "Successfully found number of people who accepeted this job.", data: [], job_detail: job_detail })
            } else {
                var sql = "SELECT A.*,B.first_name,B.last_name,B.profile_pic,ROUND(AVG(C.rating),0) AS rating FROM tab_job_apply A LEFT JOIN tab_users B ON A.user_id=B.user_id LEFT JOIN tab_rating C ON C.user_id=A.user_id WHERE (A.job_id=? AND A.apply_status=1) GROUP BY C.user_id,A.user_id";
                mysql.connection.query(sql, [req.body.job_id], (err, list) => {
                    if (err) {
                        res.json({ status: 500, msg: "Internal server error.", err2: err })
                        console.log("Internal server error. 2====>", err);
                    } else if (list.length == 0) {
                        res.json({ status: 200, msg: "No Seeker's found.", data: [], count: null, job_detail: job_detail })
                    } else {
                        var d = list.filter(d => d.provider_acceptance == 1 || d.provider_acceptance == null)
                        var current_seeker = d.filter(d => d.provider_acceptance == 1);
                        res.json({ status: 200, msg: "Successfully found number of people who accepeted this job.", data: d, count: d.length, current_seeker_lenght: current_seeker.length, job_detail: job_detail })
                    }
                })
            }
        })
    }
}

//================================================ APi for get job seeker lat long =============================================

const get_location = async(req, res) => {

    const { job_id } = req.body;
    var user_id = req.decoded.user_id;
    var sql = 'SELECT A.id,A.job_id, A.job_type, A.user_id,B.work_lat,B.work_lng,A.created_date FROM `tab_notification` A LEFT JOIN tab_users B ON B.user_id = A.user_id WHERE A.job_id=?'

    mysql.connection.query(sql, [job_id], (err, list) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error" })
        } else if (list.length == 0) {
            res.json({ status: 404, msg: "No data found." })
        } else {
            res.json({ status: 200, msg: "Successfully founded seeker's location.", data: list, count: list.length })
        }
    })
}

//======================================== APi for job detail ===================================================

const job_detail = async(req, res) => {
    const { job_id } = req.body;
    var user_id = req.decoded.user_id;

    // var mysql ='SELECT A.*,B.skill,C.name,C.addressline1,C.addressline2,C.city,C.state,C.zipcode,C.zone FROM `tab_jobs` A LEFT JOIN tab_skills B ON B.id= A.category LEFT JOIN tab_address C ON	C.id = A.address WHERE A.job_id=?'

    var sql = 'SELECT A.*,B.skill,D.skill AS category_name, C.name,C.addressline1,C.addressline2,C.city,C.state,C.zipcode,C.zone FROM `tab_jobs` A LEFT JOIN tab_skills B ON B.id= A.category LEFT JOIN tab_address C ON	C.id = A.address LEFT JOIN tab_skills D ON D.id=B.parent_id WHERE A.job_id=?'

    mysql.connection.query(sql, [job_id], (err, list) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error" })
        } else if (list.length == 0) {
            res.json({ status: 404, msg: "No data found." })
        } else {
            res.json({ status: 200, msg: "Successfully founded job details.", data: list })
        }
    })
}

//====================================== API for update device token =============================================

const update_device_token = async(req, res) => {

    const { device_type, device_token } = req.body;
    var user_id = req.decoded.user_id;

    await updateDeviceToken();

    function updateDeviceToken() {
        mysql.connection.query('update tab_users set device_type=?,device_token=? where user_id=?', [device_type, device_token, user_id], (err, update_data) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error" })
            } else {
                res.json({ status: 200, msg: "Successfully updated device token." })
            }
        })
    }
}

//====================================== Cron job for expire work now jobs =============================================


cron.schedule('*/2 * * * *', () => {
    // console.log('running a task every two minutes');

    mysql.connection.query('select * from tab_jobs where job_type=1 and visibility=1', (err, job_list) => {
        if (err) {
            console.log("Error found");
        } else if (job_list.length == 0) {
            console.log("No data found");
        } else {

            for (var i = 0; i < job_list.length; i++) {

                var start_date = job_list[i].start_date;
                var end_date = job_list[i].end_date;
                var date1 = new Date(start_date);
                var date2 = new Date(end_date);
                var date3 = new Date();

                var getDate = `'${(date3.getMonth() + 1) + '/' + date3.getDate() + '/' + date3.getFullYear()}'`;

                var date4 = new Date(getDate);

                var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

                var day1 = days[date1.getDay()];
                var day2 = days[date2.getDay()];
                var today = days[date4.getDay()];

                // console.log('start date and day===>', job_list[i].job_id, date1, day1, date1.getDay());
                // console.log('end date and day===>',b job_list[i].job_id, date2, day2, date2.getDay());
                // console.log('today date and day===>', getDate, today, date4.getDay());


                // var date1 = new Date(posted_date);
                // var today = new Date();


                // var date2 = new Date(getDate);
                var diffDays = parseInt((date2 - date1) / (1000 * 60 * 60 * 24)); //gives day difference 
                // console.log("diffDays===>", diffDays)

                // console.log('days list ==>',)

                var visibility = 0;

                if (today == 'Sunday') {
                    visibility = 0;
                } else {

                }

                // mysql.connection.query('update tab_jobs set visibility =? where job_type=1', [visibility], (err, result) => {
                //     if (err) {
                //         console.log('error found to expire job.', err)
                //     } else {
                //         console.log('successfully expired job.')
                //     }
                // })

                //     var posted_date = job_list[i].posted_date;
                //     var date1 = new Date(posted_date);
                //     var today = new Date();

                //     var getDate = `'${(today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear()}'`;
                //     // console.log('getDate ==>', getDate);

                //     var date2 = new Date(getDate);  
                //     var diffDays = parseInt((date2 - date1) / (1000 * 60 * 60 * 24)); //gives day difference 
                //     console.log("diffDays===>", diffDays)

                //     if (diffDays == 30) {
                //         mysql.connection.query('update tab_jobs set visibility=0 where job_id=?', [job_list[i].job_id], (err, update_job) => {
                //             if (err) {
                //                 console.log('Error found in expire job.')
                //             } else {
                //                 console.log('Job has been expire.')
                //             }
                //         })
                //     } else {
                //         console.log('No job expired.')

                //     }
            }
        }
    })
});

//=========================================== API for accept/reject job by provider =======================================

const select_seeker = async(req, res) => {

    var user_id = req.decoded.user_id;
    // console.log("user_id ==>", user_id)
    var status = req.body.status; //status = 1 (accept) ,  0 => Reject
    var job_id = req.body.job_id;
    var seeker_id = req.body.seeker_id;
    var title = '';
    var text = '';
    var message = '';
    var data = '';


    console.log("req ====>", req.body);

    var sql = 'Select A.*,B.skill from tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category Where A.job_id=? AND A.user_id=?'

    await selectSeekers();

    function selectSeekers() {
        mysql.connection.query(sql, [job_id, user_id], (err, job) => {

            console.log("result ===>", err, job);
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (job.length == 0) {
                res.json({ status: 404, msg: "No data found." })
            } else {
                if (status == "1") { //accept provider
                    console.log("status ===> true")
                        // title = `Provider has been accepted for ${job[0].job_title} job post.`;
                    title = `Congratulations! You have been accepted on ${job[0].job_title}. `;

                    text = `${job[0].skill}`;
                    message = 'Accepted';

                    mysql.connection.query('select * from tab_users where user_id=?', [seeker_id], (err, seeker) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else if (seeker.length == 0) {
                            res.json({ status: 404, msg: "No seeker found." })
                        } else {

                            var RoleId = seeker[0].role_id;
                            data = {
                                "role_id": RoleId.toString(),
                                "isCompleted": "1"

                            }
                            common_function.send_push_notification(seeker[0].device_token, title, text, data);
                            mysql.connection.query('Insert into tab_notification set job_id=?, user_id=?,message=?,job_type=1,status=?', [job_id, seeker_id, title, 2], (err, save_notification) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error." })
                                } else {
                                    // confirm booking(status = 2) job for progress bar
                                    // mysql.connection.query('update tab_users set progress_bar_status=? where user_id=?', [2, seeker_id], (err, update_progress_bar) => {
                                    //     if (err) {
                                    //         console.log('Error found while update progress bar status.')
                                    //     } else {
                                    mysql.connection.query('update tab_job_apply set provider_acceptance=1 where user_id=? AND job_id=? AND apply_status=?', [seeker_id, job_id, 1], (err, update_job) => {
                                            if (err) {
                                                res.json({ status: 500, msg: "Internal server error." })
                                            } else {

                                                //4 june 2020
                                                //1 => provider accept
                                                mysql.connection.query('Insert into tab_job_application_status set status=?,user_id=?, job_id=?,message=?,hourly_rate=?,address=?', [1, seeker_id, job_id, job[0].job_title, job[0].hourly_rate, job[0].address], (err, save_application) => {
                                                    if (err) {
                                                        console.log('Error found in job application notification.')
                                                    } else {
                                                        console.log('Save job application status into DB.')
                                                    }
                                                })
                                                res.json({ status: 200, msg: `Provider has been ${message}  this job.` })
                                            }
                                        })
                                        //     }
                                        // })
                                }
                            })
                        }
                    })
                } else { // Reject
                    console.log("status ===> false")

                    title = `Provider has been rejected for ${job[0].job_title} job post.`;
                    text = `${job[0].skill}`;
                    message = 'Rejected';
                    mysql.connection.query('select * from tab_users where user_id=?', [seeker_id], (err, seeker) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else if (seeker.length == 0) {
                            res.json({ status: 404, msg: "No seeker found." })
                        } else {
                            var RoleID = seeker[0].role_id;

                            data = {
                                'role_id': RoleID.toString(),
                                "isCompleted": "1"
                            }
                            common_function.send_push_notification(seeker[0].device_token, title, text, data);
                            mysql.connection.query('Insert into tab_notification set job_id=?, user_id=?,message=?,job_type=1,status=?', [job_id, seeker_id, title, 2], (err, save_notification) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error." })
                                } else {

                                    var sql1 = 'update tab_job_apply set provider_acceptance=0 where user_id=? AND job_id=? AND apply_status=?';
                                    // console.log("sql1 ====>", sql1);
                                    mysql.connection.query(sql1, [seeker_id, job_id, 1], (err, update_job) => {
                                        if (err) {
                                            res.json({ status: 500, msg: "Internal server error." })
                                        } else {
                                            console.log("successfully updated ===>")
                                                //4 june 2020
                                                //2 => provider reject
                                            mysql.connection.query('Insert into tab_job_application_status set status=?,user_id=?, job_id=?,message=?,hourly_rate=?,address=?', [2, seeker_id, job_id, job[0].job_title, job[0].hourly_rate, job[0].address], (err, save_application) => {
                                                if (err) {
                                                    console.log('Error found in job application notification.')
                                                } else {
                                                    console.log('Save job application status into DB.')
                                                }
                                            })
                                            res.json({ status: 200, msg: `Provider has been ${message}  this job.` })
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            }
        })
    }
}

//=========================================== Confirmed booking ================================================

const confirm_booking = async(req, res) => {

    const { job_id, seeker_id } = req.body;
    var provider_id = req.decoded.user_id;
    //  console.log('provider id ==>', provider_id);
    var arr = seeker_id.split(',');
    // console.log('seeker array ==>', arr);

    await confirmBooking();

    function confirmBooking() {
        mysql.connection.query('Update tab_jobs set booking_status=? where job_id=? and user_id =?', [1, job_id, provider_id], (err, update_data) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error.", err: err })
            } else {

                for (var i = 0; i < arr.length; i++) {
                    mysql.connection.query('Insert into tab_booking set job_id=?,provider_id=?,seeker_id=?', [job_id, provider_id, arr[i]], (err, save_booking) => {
                        if (err) {
                            console.log('Error found.')
                        } else {
                            mysql.connection.query('select * from tab_users where user_id=? and isCompleteProfile=1', [arr[i]], (err, user) => {
                                if (err) {
                                    console.log('Unbale to find an user.')
                                } else if (user.length == 0) {
                                    console.log('No user founded.')
                                } else {
                                    // 23 nov
                                    // confirm booking(status = 2) job for progress bar
                                    mysql.connection.query('update tab_users set progress_bar_status=? where user_id=?', [2, arr[i]], (err, update_progress_bar) => {
                                        if (err) {
                                            console.log('Error found while update progress bar status.')
                                        } else {
                                            console.log("successfully updated progress bar status.")
                                            mysql.connection.query('select A.*,B.skill from tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category where A.job_id=?', [job_id], (err, job) => {
                                                if (err) {
                                                    console.log('Unbale to find an user.')
                                                } else if (job.length == 0) {
                                                    console.log('No job founded.')
                                                } else {
                                                    var title = `Prvider has been approved your request for ${job[0].job_title}.`;
                                                    var text = `${job[0].skill}`;
                                                    var RoleID = user[0].role_id;
                                                    var data = {
                                                        "role_id": RoleID.toString(),
                                                        "isCompleted": "1"
                                                    }
                                                    common_function.send_push_notification(user[0].device_token, title, text, data);

                                                    var SEEKER_ID = user[0].user_id;
                                                    mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [job_id, user[0].user_id, title, job[0].lat, job[0].lng, job[0].job_type, user[0].distance, 2], (err, save_notification) => {
                                                        if (err) {
                                                            console.log('Error found in save notification.')
                                                        } else {
                                                            // console.log('Save Notifications into DB.')
                                                            //4 june 2020
                                                            //5 => provider confirm booking
                                                            mysql.connection.query('update tab_job_application_status set status=? where user_id=? AND job_id=?', [3, SEEKER_ID, job_id], (err, save_application) => {
                                                                if (err) {
                                                                    console.log('Error found in job application notification.')
                                                                } else {
                                                                    console.log('Save job application status into DB.')
                                                                }
                                                            })
                                                        }
                                                    })
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
                res.json({ status: 200, msg: "Successfully booking saved." })
            }
        })
    }
}


//======================================== Find people ==========================================================

const find_people1 = async(req, res) => {

    const { job_id } = req.body;
    var provider_id = req.decoded.user_id;

    var lat = '';
    var lng = '';

    mysql.connection.query('select A.*,B.skill,C.company_name from tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category LEFT JOIN tab_users C ON C.user_id=A.user_id where A.job_id =? and A.user_id=?', [job_id, provider_id], (err, job) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server eror." })
        } else if (job.length == 0) {
            res.json({ status: 404, msg: "No job founded." })
        } else {
            lat = job[0].lat;
            lng = job[0].lng;
            var skill = job[0].category;
            var title = `You have been invited to work on a job of ${job[0].skill} at ${job[0].company_name} `;
            var text = `${job[0].job_title}`;
            //    var sql ='select * from tab_users where role_id=2 and isCompleteProfile=1 and skill_id=?';
            var sql = 'SELECT B.user_id,B.first_name,B.last_name,B.email,B.profile_pic,B.company_name,A.skill_id,B.category_id,B.category_name,B.ssn,B.dob,B.distance,B.background_check,B.drug_test,B.role_id,B.isCompleteProfile,B.token,B.device_type,B.device_token,B.quiz_score,B.lat,B.lng,B.work_lat,B.work_lng,B.created_at FROM `tab_user_skills` A LEFT JOIN tab_users B ON A.user_id = B.user_id WHERE A.skill_id=? AND B.role_id=2 and B.isCompleteProfile=1'
            mysql.connection.query(sql, [skill], (err, user_list) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (user_list.length == 0) {
                    res.json({ status: 404, msg: "No seeker founded." })
                } else {
                    mysql.connection.query('select * from tab_job_apply where job_id=? AND apply_status=?', [job_id, 1], (err, applicant) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else if (applicant.length == 0) {

                            for (var i = 0; i < user_list.length; i++) {

                                var JOB = job_id;
                                var senderID = provider_id;
                                var receiverId = user_list[i].user_id;
                                var RoleId = user_list[i].role_id;
                                var latitude = lat.toString();
                                var longitude = lng.toString();


                                var data = { //data
                                    "job_id": JOB.toString(), //job_id
                                    "sender_id": senderID.toString(), //seeker provider user id
                                    "receiver_id": receiverId.toString(),
                                    "role_id": RoleId.toString(),
                                    "lat": latitude,
                                    "long": longitude,
                                    "isCompleted": "1"
                                }
                                var job = {
                                    lat: lat,
                                    lon: lng
                                }
                                var user = '';

                                if (user_list[i].work_lat != null && user_list[i].work_lng != null) {
                                    user = {
                                        lat: Number(user_list[i].work_lat),
                                        lon: Number(user_list[i].work_lng)
                                    }
                                }

                                console.log('job location', job);
                                console.log('user location', user_list[i].user_id, user)


                                var distance = geolib.getDistance(job, user);
                                var d = distance / 1000;
                                console.log('diffrence', d)

                                if (d <= Number(user_list[i].distance)) {

                                    common_function.send_push_notification(user_list[i].device_token, title, text, data);

                                    mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [job_id, user_list[i].user_id, title, lat, lng, 1, user_list[i].distance, 1], (err, save_notification) => {
                                        if (err) {
                                            console.log('Error found in save notification.')
                                        } else {
                                            console.log('Save Notifications into DB.')
                                        }
                                    })
                                } else {
                                    console.log('No seeker found to send notification.')
                                }
                            }
                            res.json({ status: 200, msg: "Successfully sent for find resouces." })
                        } else {
                            for (var i = 0; i < user_list.length; i++) {
                                for (var j = 0; j < applicant.length; j++) {

                                    if (applicant[j].user_id == user_list[i].user_id && applicant[j].job_id == job_id) {
                                        console.log('Seeker Already applied', user_list[i].user_id)
                                            // return false;
                                    }
                                    // return false;
                                    else {

                                        // if (applicant[j].user_id != user_list[i].user_id && applicant[j].job_id == job_id) {

                                        var JOB = job_id;
                                        var senderID = provider_id;
                                        var receiverId = user_list[i].user_id;
                                        var RoleId = user_list[i].role_id;
                                        var latitude = lat.toString();
                                        var longitude = lng.toString();


                                        var data = { //data
                                            "job_id": JOB.toString(), //job_id
                                            "sender_id": senderID.toString(), //seeker provider user id
                                            "receiver_id": receiverId.toString(),
                                            "role_id": RoleId.toString(),
                                            "lat": latitude,
                                            "long": longitude,
                                            "isCompleted": "1"
                                        }


                                        console.log("data ===>", data)
                                            // var data = { //data
                                            //     job_id: job_id, //job_id
                                            //     sender_id: provider_id, //seeker provider user id
                                            //     receiver_id: user_list[i].user_id,
                                            //     role_id: user_list[i].role_id,
                                            //     lat: lat,
                                            //     long: lng
                                            // }
                                        var job = {
                                            lat: lat,
                                            lon: lng
                                        }
                                        var user = '';

                                        if (user_list[i].work_lat != null && user_list[i].work_lng != null) {
                                            user = {
                                                lat: Number(user_list[i].work_lat),
                                                lon: Number(user_list[i].work_lng)
                                            }
                                        }

                                        // console.log('job location', job);
                                        // console.log('user location', user_list[i].user_id, user)

                                        var distance = geolib.getDistance(job, user);
                                        var d = distance / 1000;
                                        // console.log('diffrence', d)

                                        if (d <= Number(user_list[i].distance)) {
                                            // var SEEKER_ID = user_list[i].user_id;

                                            console.log("user_id  ===>", user_list[i].user_id);
                                            common_function.send_push_notification(user_list[i].device_token, title, text, data);
                                            mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [job_id, user_list[i].user_id, title, lat, lng, 1, user_list[i].distance, 1], (err, save_notification) => {
                                                if (err) {
                                                    console.log('Error found in save notification.')
                                                } else {
                                                    console.log('Save Notifications into DB.')

                                                    //4 june 2020
                                                    //4 => provider confirm booking
                                                    // mysql.connection.query('insert into tab_job_application_status set job_id=?,user_id=?,message=?', [job_id, SEEKER_ID, title], (err, save_application) => {
                                                    //     if (err) {
                                                    //         console.log('Error found in job application notification.')
                                                    //     } else {
                                                    //         console.log('Save job application status into DB.')
                                                    //     }
                                                    // })
                                                }
                                            })
                                        } else {
                                            console.log('No seeker found to send notification.')
                                        }
                                    }
                                    // else {
                                    //     console.log('Seeker Already applied', user_list[i].user_id)
                                    // }
                                }
                            }
                            res.json({ status: 200, msg: "Successfully sent for find resouces." })
                        }
                    })
                }
            })
        }
    })
}


// 8 july 2020

//======================================== Find people ==========================================================

const find_people = async(req, res) => {

    const { job_id } = req.body;
    var provider_id = req.decoded.user_id;

    var lat = '';
    var lng = '';

    mysql.connection.query('select A.*,B.skill,C.company_name from tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category LEFT JOIN tab_users C ON C.user_id=A.user_id where A.job_id =? and A.user_id=?', [job_id, provider_id], (err, job) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server eror." })
        } else if (job.length == 0) {
            res.json({ status: 404, msg: "No job founded." })
        } else {
            lat = job[0].lat;
            lng = job[0].lng;
            var skill = job[0].category;
            var title = `You have been invited to work on a job of ${job[0].skill} at ${job[0].company_name} `;
            var text = `${job[0].job_title}`;

            var sql = 'SELECT B.user_id,B.first_name,B.last_name,B.email,B.profile_pic,B.company_name,A.skill_id,B.category_id,B.category_name,B.ssn,B.dob,B.distance,B.background_check,B.drug_test,B.role_id,B.isCompleteProfile,B.token,B.device_type,B.device_token,B.quiz_score,B.lat,B.lng,B.work_lat,B.work_lng,B.created_at FROM `tab_user_skills` A LEFT JOIN tab_users B ON A.user_id = B.user_id WHERE (A.skill_id=? || A.skill_id=46) AND B.role_id=2 and B.isCompleteProfile=1 And A.user_id NOT IN (select user_id from tab_job_apply where job_id=? AND apply_status=1)'

            mysql.connection.query(sql, [skill, job_id], (err, user_list) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (user_list.length == 0) {
                    res.json({ status: 404, msg: "No seeker founded." })
                } else {
                    for (var i = 0; i < user_list.length; i++) {
                        var JOB = job_id;
                        var senderID = provider_id;
                        var receiverId = user_list[i].user_id;
                        var RoleId = user_list[i].role_id;
                        var latitude = lat.toString();
                        var longitude = lng.toString();


                        var data = { //data
                            "job_id": JOB.toString(), //job_id
                            "sender_id": senderID.toString(), //seeker provider user id
                            "receiver_id": receiverId.toString(),
                            "role_id": RoleId.toString(),
                            "lat": latitude,
                            "long": longitude,
                            "isCompleted": "1"
                        }
                        var job = {
                            lat: lat,
                            lon: lng
                        }
                        var user = '';

                        if (user_list[i].work_lat != null && user_list[i].work_lng != null) {
                            user = {
                                lat: Number(user_list[i].work_lat),
                                lon: Number(user_list[i].work_lng)
                            }
                        }

                        console.log('job location', job);
                        console.log('user location', user_list[i].user_id, user)


                        var distance = geolib.getDistance(job, user);
                        var d = distance / 1000;
                        console.log('diffrence', d)
                        if (d <= Number(user_list[i].distance)) {
                            common_function.send_push_notification(user_list[i].device_token, title, text, data);
                            mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [job_id, user_list[i].user_id, title, lat, lng, 1, user_list[i].distance, 1], (err, save_notification) => {
                                if (err) {
                                    console.log('Error found in save notification.')
                                } else {
                                    console.log('Save Notifications into DB.')
                                }
                            })
                        } else {
                            console.log('No seeker found to send notification.')
                        }
                    }
                    res.json({ status: 200, msg: "Successfully sent for find resouces." })
                }
            })
        }
    })
}


//================================================ API for global search ===========================================

const global_search = async(req, res) => {

    const { search } = req.body;
    var user_id = req.decoded.user_id;

    await globalSearch();

    function globalSearch() {
        var sql = `SELECT A.*,D.apply_status,E.profile_pic, B.skill,F.skill AS category, B.parent_id, C.name, C.addressline1, C.addressline2, C.city, C.state, C.zipcode, C.zone FROM tab_jobs A  LEFT JOIN tab_job_apply D ON A.job_id = D.job_id AND D.user_id=? LEFT JOIN tab_users E ON E.user_id = A.user_id LEFT JOIN tab_skills B ON A.category = B.id LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN tab_skills F ON F.id = B.parent_id WHERE A.visibility = 1 AND B.skill LIKE '%${search}%' OR A.job_title LIKE '%${search}%' `;
        mysql.connection.query(sql, [user_id], (err, list) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (list.length == 0) {
                res.json({ status: 404, msg: "No data found." })
            } else {
                var data = list.filter(d => d.visibility = 1);
                res.json({ status: 200, msg: "Successfully found jobs.", data: data })
            }
        })
    }
}

//========================================= API for submit user's rating ==========================================

const save_rating = (req, res) => {

    const { seeker_id, rating, comment, job_id } = req.body;
    var provider_id = req.decoded.user_id;
    mysql.connection.query('Insert into tab_rating set user_id=?,job_id=?, rating=?,comment=?,provider_id=?', [seeker_id, job_id, rating, comment, provider_id], (err, save) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else {
            res.json({ status: 200, msg: "Successfully saved rating." })
        }
    })
}

//======================================== API for verify email by given link ==================================

const verifyLink = async(req, res) => {

    const { user_id, code } = req.params;

    await verifyEmailByLink();

    function verifyEmailByLink() {
        mysql.connection.query('select * from tab_users where user_id=? and verification_code=?', [user_id, code], (err, user) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (user.length == 0) {
                res.sendFile('/var/www/html/projects/rockstaffing/dir/linkExpire.html')
            } else if (user[0].isEmailVerify == '1') {
                res.sendFile('/var/www/html/projects/rockstaffing/dir/alreadyVerify.html')
            } else {
                mysql.connection.query('update tab_users set isEmailVerify=? where user_id=?', [1, user_id], (err, verifyEmail) => {
                    if (err) {
                        res.json({ status: 500, msg: "Internal server error." })
                    } else {
                        res.sendFile('/var/www/html/projects/rockstaffing/dir/verifyLink.html')
                    }
                })
            }
        })
    }
}

//============================================== API for seeker Save log ===============================================

//old API 
const log_start1 = async(req, res) => {

    const { hour, pay_scale, job_id, minute } = req.body;

    var seeker_id = req.decoded.user_id;

    //check job is closed or not

    mysql.connection.query('select * from tab_booking where job_id=? and seeker_id=?', [job_id, seeker_id], (err, isConfirmBooking) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (isConfirmBooking.length == 0) {
            res.json({ status: 400, msg: "You are not authorized." })
        } else {
            //29 july 2020
            if (isConfirmBooking[0].change_status == '1') { //check seeker is replaced or not
                res.json({ status: 400, msg: "You are not authorized to start the job yet." })
            } else {

                // 6 june 2020

                mysql.connection.query('select * from tab_booking where job_id =?', [job_id], (err, booking_list) => {
                    if (err) {
                        res.json({ status: 500, msg: "Something went wrong." })
                    } else if (booking_list.length == 0) {
                        res.json({ status: 404, msg: "No data found." })
                    } else {

                        for (var i = 0; i < booking_list.length; i++) {
                            if (booking_list[i].seeker_id == seeker_id) {
                                mysql.connection.query('Insert into tab_log set job_id=?, user_id=?, hour=?,minute=?,pay_scale=?,status=?', [job_id, seeker_id, hour, minute, pay_scale, 1], (err, logSave) => {
                                    if (err) {
                                        // res.json({ status: 500, msg: "Internal server error." })
                                        console.log("Error found while save seeker job log.")
                                    } else {

                                        // ///////////////////////// 14 oct

                                        // mysql.connection.query(`SELECT A.*,D.skill, B.device_token as provider_device_token , B.role_id as provider_role,C.user_id As seekerID, C.first_name as seeker_first_name,C.last_name as seeker_last_name from tab_jobs A LEFT JOIN tab_users B ON B.user_id=A.user_id LEFT JOIN tab_users C ON C.user_id=${seeker_id} LEFT JOIN tab_skills D ON D.id=A.category where A.job_id=?`, [seeker_id, job_id], (err, job) => {
                                        //     if (err) {
                                        //         // res.json({ status: 500, msg: "Internal server error.", err: err })
                                        //         console.log("error found while find a job.")
                                        //     } else {

                                        //         console.log("job  ===>", job[0]);

                                        //         var title = `${job[0].seeker_first_name} ${job[0].seeker_last_name} stop the ${job[0].skill} job.`
                                        //         var text = `${job[0].job_title}`;

                                        //         var userId = job[0].user_id;
                                        //         var RoleId = job[0].provider_role;

                                        //         var data = { //data
                                        //             "job_id": job_id.toString(), //job_id
                                        //             "sender_id": job[0].seekerID, //seeker userid
                                        //             "receiver_id": userId.toString(),
                                        //             "role_id": RoleId.toString(),
                                        //             "isCompleted": "1"
                                        //         }

                                        //         common_function.send_push_notification(job[0].provider_device_token, title, text, data);

                                        //         var end_date = new Date();
                                        //         end_date = end_date.toISOString();

                                        //         mysql.connection.query('update tab_clock_in_clock_out set isStart=?,end_date=? where user_id=?,job_id=?', [0, end_date, seeker_id, job_id], (err, start_clock_in) => {
                                        //             if (err) {
                                        //                 // res.json({ status: 500, msg: "Internal server error.", err: err })
                                        //                 console.log("error found while clock out.")
                                        //             } else {
                                        //                 mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,status=?', [job_id, job[0].user_id, title, job[0].lat, job[0].lng, job[0].job_type, 2], (err, save_notification) => {
                                        //                     if (err) {
                                        //                         // res.json({ status: 500, msg: "Internal server error.", err: err })
                                        //                         console.log("error found while inser notification.")
                                        //                     } else {
                                        //                         // res.json({ status: 200, msg: "Successfully start the job." })
                                        //                         console.log("Successfully saved your log.")
                                        //                     }
                                        //                 })
                                        //             }
                                        //         })
                                        //     }
                                        // })

                                        ///////////////////////////////

                                        console.log("Successfully saved your log.")
                                            // res.json({ status: 200, msg: "Successfully saved your log." })
                                    }
                                })
                            } else {
                                mysql.connection.query('Insert into tab_log set job_id=?, user_id=?, hour=?,minute=?,pay_scale=?,status=?', [job_id, booking_list[i].seeker_id, 0, 0, 0, 0], (err, logSave) => {
                                    if (err) {
                                        // res.json({ status: 500, msg: "Internal server error." })
                                        console.log("Error found while save abscent seeker job log.")
                                    } else {
                                        console.log("Successfully abscent saved your log.")
                                            // res.json({ status: 200, msg: "Successfully saved your log." })
                                    }
                                })
                            }
                        }
                        res.json({ status: 200, msg: "Successfully saved your log." })
                    }
                })
            }
        }
    })
}


//new API

const log_start = async(req, res) => {

    const { hour, pay_scale, job_id, minute } = req.body;

    var seeker_id = req.decoded.user_id;

    //check job is closed or not

    mysql.connection.query('select * from tab_booking where job_id=? and seeker_id=?', [job_id, seeker_id], (err, isConfirmBooking) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (isConfirmBooking.length == 0) {
            res.json({ status: 400, msg: "You are not authorized." })
        } else if (isConfirmBooking[0].change_status == '1') {
            res.json({ status: 400, msg: "You are not authorized to start the job yet." })
        } else {
            mysql.connection.query('Insert into tab_log set job_id=?, user_id=?, hour=?,minute=?,pay_scale=?,status=?', [job_id, seeker_id, hour, minute, pay_scale, 1], (err, logSave) => {
                if (err) {
                    res.json({ status: 500, msg: "Error found while save log." })
                } else {
                    // res.json({ status: 200, msg: "Successfully saved your log." })
                    mysql.connection.query(`SELECT A.*,D.skill, B.device_token as provider_device_token , B.role_id as provider_role,C.user_id As seekerID, C.first_name as seeker_first_name,C.last_name as seeker_last_name from tab_jobs A LEFT JOIN tab_users B ON B.user_id=A.user_id LEFT JOIN tab_users C ON C.user_id=${seeker_id} LEFT JOIN tab_skills D ON D.id=A.category where A.job_id=${job_id}`, (err, job) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", err: err })
                                // console.log("error found while find a job.")
                        } else {

                            console.log("job  ===>", job[0]);

                            var title = `${job[0].seeker_first_name} ${job[0].seeker_last_name} has clocked out from ${job[0].job_title} job.`
                            var text = `${job[0].job_title}`;

                            var userId = job[0].user_id;
                            // var RoleId = job[0].provider_role;
                            var senderID = seeker_id.toString();

                            var data = { //data
                                "job_id": job_id.toString(), //job_id
                                "sender_id": senderID, //seeker userid
                                "receiver_id": userId.toString(),
                                // "role_id": RoleId.toString(),
                                "isCompleted": "1"
                            }

                            console.log("data ====>", data);

                            common_function.send_push_notification(job[0].provider_device_token, title, text, data);

                            var end_date = new Date();
                            // end_date = end_date.toISOString();

                            mysql.connection.query('update tab_clock_in_clock_out set isStart=?,end_date=? where user_id=? and job_id=? and isStart=?', [0, end_date, seeker_id, job_id, 1], (err, start_clock_in) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Error found while clock out.", err: err })
                                        // console.log("error found while clock out.")
                                } else {
                                    mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,status=?', [job_id, job[0].user_id, title, job[0].lat, job[0].lng, job[0].job_type, 2], (err, save_notification) => {
                                        if (err) {
                                            res.json({ status: 500, msg: "Internal server error.", err: err })
                                                // console.log("error found while inser notification.")
                                        } else {
                                            res.json({ status: 200, msg: "Successfully clock out  the job." })
                                                // console.log("Successfully saved your log.")
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            })
        }
    })
}



//===================================== Cron job for send notification =======================

cron.schedule('*/2 * * * *', () => {

    var sql = "SELECT A.*,B.first_name,B.last_name,B.device_token,C.job_title,C.job_type FROM `tab_clock_in_clock_out` A LEFT JOIN tab_users B ON B.user_id=A.user_id LEFT JOIN tab_jobs C ON C.job_id=A.job_id where A.isStart=? and A.isNotificationSent=?"
    mysql.connection.query(sql, [1, 0], (err, result) => {
        if (err) {
            console.log("Internal server error.")
        } else if (result.length == 0) {
            console.log("No data found.")
        } else {
            for (var i = 0; i < result.length; i++) {
                var date = new Date(result[i].start_date);

                var hours = date.getHours();
                if (hours > 12) {
                    hours -= 12;
                } else if (hours === 0) {
                    hours = 12;
                }

                console.log("Hours ==>", (hours + 5) * 60);

                var min = date.getMinutes();
                var total_min = (hours + 5) * 60 + (min + 30);
                var condition = 8 * 60; // 8 hours
                console.log("total min and 8 hrs into min", total_min, condition)

                if (total_min >= condition) {

                    var JOB = result[i].job_id;
                    var receiverId = result[i].user_id;

                    var data = { //data
                        "job_id": JOB.toString(), //job_id
                        "receiver_id": receiverId.toString(),
                        "isCompleted": "1"
                    }
                    var title = `Your time is over than 8 hours please time your log for ${result[i].job_title} job.`;
                    var text = `${result[i].job_title}`;
                    common_function.send_push_notification(result[i].device_token, title, text, data);

                    mysql.connection.query('Update tab_clock_in_clock_out set isNotificationSent=? where id=?', [1, result[i].id], (err, notify_seeker) => {
                        if (err) {
                            console.log("Error found while notify seeker.")
                        } else {
                            console.log("Seeker notify that they over than 8 hours.")
                        }
                    })
                } else {
                    console.log("No data founded for notify.")
                }
            }
        }
    })
})




//=========================================== API for check seeker is approved  by provider ===================================

const check_approval = async(req, res) => {
    const { job_id } = req.body;
    var seeker_id = req.decoded.user_id;
    var time_log_status = 0; // is define is job completed or not

    await checkApproval();

    function checkApproval() {
        if (!seeker_id) {
            res.json({ status: 422, msg: "UserId is required." })
        } else {
            // check job is closed or not
            mysql.connection.query('select * from tab_jobs where job_id=?', [job_id], (err, job) => {
                if (err) {
                    res.json({ status: 500, msg: "Something went wrong." })
                } else if (job.length == 0) {
                    res.json({ status: 500, msg: "Job not found." })
                } else {
                    mysql.connection.query('select * from tab_booking where job_id=? AND seeker_id=?', [job_id, seeker_id], (err, result) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else if (result.length == 0) {
                            // time_log_status = 0;
                            // res.json({ status: 404, msg: "You are not authorized to start the job.", time_log_status: time_log_status })
                            res.json({ status: 404, msg: "You are not authorized to start the job.", time_log_status: job[0].isCompleted })

                        } else {
                            if (result[0].change_status == '1') { //check this seeker is replaced or not
                                // time_log_status = 0;
                                // res.json({ status: 404, msg: "You are not authorized to start the job yet.", time_log_status: time_log_status })
                                res.json({ status: 404, msg: "You are not authorized to start the job yet.", time_log_status: job[0].isCompleted })

                            } else {
                                // time_log_status = 1;
                                // res.json({ status: 200, msg: "Success! you can start the job.", time_log_status: time_log_status })
                                res.json({ status: 200, msg: "Success! you can start the job.", time_log_status: job[0].isCompleted })

                            }
                        }
                    })
                }
            })
        }
    }
}


//==================================================== API for delete notification =========================================

const delete_notification = async(req, res) => {

    const { id } = req.body;
    var user_id = req.decoded.user_id;

    mysql.connection.query('Delete from tab_notification where id=? and user_id=?', [id, user_id], (err, result) => {
        if (err) {
            res.json({ status: 400, msg: "Internal server error." })
        } else {
            res.json({ status: 200, msg: "Successfully removed." })
        }
    })
}


//==================================== API for clear all notifications =============================================

const clear_notification = async(req, res) => {

    var user_id = req.decoded.user_id;

    mysql.connection.query('Delete from tab_notification where user_id=?', [user_id], (err, result) => {
        if (err) {
            res.json({ status: 400, msg: "Internal server error." })
        } else {
            res.json({ status: 200, msg: "Successfully removed." })
        }
    })
}

//========================================= remove notifications ===================================================

const notification_remove = async(req, res) => {
    const { id } = req.body;
    var user_id = req.decoded.user_id;
    var arr = id.split(',');

    if (!user_id) {
        res.json({ status: 422, msg: "UserId is required." })
    } else if (!id) {
        res.json({ status: 422, msg: "Please select atleast one notification" })
    } else {
        for (var i = 0; i < arr.length; i++) {
            mysql.connection.query('Delete from tab_notification where id=? and user_id=?', [arr[i], user_id], (err, result) => {
                if (err) {
                    console.log('Error found.')
                } else {
                    console.log('Successfully deleted notification')
                }
            })
        }
        res.json({ status: 200, msg: "Successfully removed." })
    }
}


//===============================API for payment using stripe ========================================

const create_payment = async(req, res) => {

    const { number, exp_month, exp_year, cvc, name, amount, job_id } = req.body;

    var user_id = req.decoded.user_id;

    // var user_id = req.body.user_id;

    stripe.tokens.create({
            card: {
                number: number,
                exp_month: exp_month,
                exp_year: exp_year,
                cvc: cvc,
                name: name
            },
        },
        function(err, token) {
            // asynchronously called
            if (err) {
                res.json({ status: 400, msg: "Error found while create card token", err: err })
            } else {

                stripe.charges.create({
                    amount: amount * 100, // amount in cents, again
                    currency: "usd",
                    source: token.id,
                    description: name + " " + `charge you $${amount}`
                }, function(error, charge) {
                    if (error && error.type === 'StripeCardError') {
                        // The card has been declined
                        // console.log(err);
                        res.json({ status: 400, msg: "Error found while create charge", error: error })
                    } else {
                        // console.log("change ====>", charge);
                        // res.json({ status: 200, msg: "Successfully charge created" })
                        mysql.connection.query('insert into tab_invoice set job_id=?,user_id=?,amount=?', [job_id, user_id, amount], (err, save) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error.", err: err })
                            } else {
                                // res.json({ status: 200, msg: "Successfully approved." })
                                // res.json({ status: 200, msg: "Successfully charge created" })

                                // 28 July  
                                mysql.connection.query('update tab_users set payment_status=? where user_id=?', [1, user_id], (err, updated) => {
                                    if (err) {
                                        res.json({ status: 500, msg: "Internal server error.", err: err })
                                    } else {
                                        //22 sep 2020

                                        mysql.connection.query('select * from tab_jobs where job_id=?', [job_id], (err, job) => {
                                                if (err) {
                                                    res.json({ status: 500, msg: "Internal server error." })
                                                } else if (job.length == 0) {
                                                    res.json({ status: 500, msg: "No job found." })
                                                } else {
                                                    mysql.connection.query('select * from tab_approve_seeker where job_id=?', [job_id], (err, seeker_list) => {
                                                        if (err) {
                                                            res.json({ status: 500, msg: "Internal server error." })
                                                        } else if (seeker_list.length == 0) {
                                                            res.json({ status: 500, msg: "No seeker found." })
                                                        } else {
                                                            for (var i = 0; i < seeker_list.length; i++) {
                                                                var seeker_id = seeker_list[i].seeker_id;
                                                                mysql.connection.query('Insert into tab_job_application_status set status=?,user_id=?, job_id=?,message=?,hourly_rate=?,address=?', [3, seeker_id, job_id, job[0].job_title, job[0].hourly_rate, job[0].address], (err, save_application) => {
                                                                    if (err) {
                                                                        console.log('Error found in job application notification.')
                                                                    } else {
                                                                        console.log('Save job application status into DB.')
                                                                            // res.json({ status: 200, msg: "Successfully paid." })
                                                                    }
                                                                })
                                                            }
                                                            res.json({ status: 200, msg: "Successfully paid." })
                                                        }
                                                    })
                                                }
                                            })
                                            // res.json({ status: 200, msg: "Successfully paid." })
                                    }
                                })
                            }
                        })
                    }
                });
                // });
            }
        }
    );

    // stripe.paymentMethods.create({
    //         type: 'card',
    //         // card: {
    //         //     number: '4242424242424242',
    //         //     exp_month: 5,
    //         //     exp_year: 2021,
    //         //     cvc: '314',
    //         // },
    //         card: {
    //             number: number,
    //             exp_month: exp_month,
    //             exp_year: exp_year,
    //             cvc: cvc
    //         },
    //     },
    //     function(err, paymentMethod) {
    //         // asynchronously called

    //         if (err) {
    //             res.json({ status: 400, msg: "Error found while create payment", err: err })
    //         } else {
    //             res.json({ status: 200, msg: "Success!!", data: paymentMethod })
    //         }
    //     }
    // );
}

//=========================================== API for job log lists ================================================

const log_list = async(req, res) => {
    const { job_id } = req.body;
    var seeker_id = req.decoded.user_id;
    var sql = 'SELECT user_id,job_id, DATE(created_at) AS date, SUM(hour) as total_hour, SUM(minute) AS total_minute, SUM(pay_scale) AS total_pay_scale  FROM tab_log WHERE user_id =? AND job_id=? GROUP BY DATE(created_at)';
    mysql.connection.query(sql, [seeker_id, job_id], (err, list) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (list.length == 0) {
            res.json({ status: 404, msg: "No data found.", data: list })
        } else {
            res.json({ status: 200, msg: "Successfully found logs.", data: list })
        }
    })
}

//========================================= API for count notification list ====================================

const notification_count = async(req, res) => {

    var user_id = req.decoded.user_id;

    await notificationCOUNT();

    function notificationCOUNT() {

        mysql.connection.query('select * from tab_notification where user_id=? AND seen=1', [user_id], (err, list) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error.", err: err })
            } else if (list.length == 0) {
                res.json({ status: 404, msg: "No data found.", data: list })
            } else {
                res.json({ status: 200, msg: "Notification", count: list.length })
            }
        })
    }
}

//========================================= API for update notification either seen or unseen ===========================

const update_notification_status = async(req, res) => {

    const { id } = req.body;
    var user_id = req.decoded.user_id;

    if (!id) {
        res.json({ status: 200, msg: "Success" })
    } else {
        var arr = id.split(',')

        for (var i = 0; i < arr.length; i++) {
            mysql.connection.query('Update tab_notification set seen=? where user_id=? AND id=?', [0, user_id, arr[i]], (err, update_status) => {
                if (err) {
                    console.log('Error found.')
                } else {
                    console.log('Seen updated.')
                }
            })
        }
        res.json({ status: 200, msg: "Success" })
    }
}

//==================================== get seeker distance ==================================================

const get_distance = (req, res) => {

    var user_id = req.decoded.user_id;

    mysql.connection.query('select * from tab_users where user_id =? and role_id=2', [user_id], (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else {
            res.json({ status: 200, msg: "Distance founded successfully.", data: result[0].distance })
        }
    })
}

//===================================== Update seeker work lat/long location ===========================================

const update_work_location = async(req, res) => {
    const { work_lat, work_long, work_address } = req.body;
    var user_id = req.decoded.user_id;

    await updateWorkLocation();

    function updateWorkLocation() {

        if (!work_lat || !work_long) {
            res.json({ status: 422, msg: "Work location is required." })
        } else {
            mysql.connection.query('update tab_users set work_lat=?,work_lng=?,work_address=? where user_id=?', [work_lat, work_long, work_address, user_id], (err, result) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else {
                    res.json({ status: 200, msg: "Successfully updated work location." })
                }
            })
        }
    }
}

//=========================================== API for show job application status =========================================

const job_application_status = async(req, res) => {

    var user_id = req.decoded.user_id;

    await applicationStatus();

    function applicationStatus() {
        mysql.connection.query('select A.id,A.job_id,A.user_id,A.message AS job_title,A.status,A.hourly_rate,A.address,A.created_at,B.name,B.addressline1,B.addressline2,B.city,B.state,B.zipcode,B.zone from tab_job_application_status A LEFT JOIN tab_address B ON B.id=A.address where A.user_id=? Order by id desc', [user_id], (err, list) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (list.length == 0) {
                res.json({ status: 404, msg: "No data found.", data: list })
            } else {
                res.json({ status: 200, msg: "Data found successfully.", data: list })
            }
        })
    }
}


//============================================== Api for show hour log with thier dates =========================================

const job_journey_date = (req, res) => {
    const { job_id } = req.body;
    var obj;
    var array = [];

    var sql = 'SELECT job_id, DATE(created_at) AS date, SUM(hour) as total_hour, SUM(minute) AS total_minute, SUM(pay_scale) AS total_pay_scale FROM tab_log WHERE job_id=? GROUP BY DATE(created_at)'

    mysql.connection.query(sql, [job_id], (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error.", err: err })
        } else if (result.length == 0) {
            res.json({ status: 404, msg: "No data found.", data: result, total_hour: null, total_minute: null, total_payment: null })
        } else {
            mysql.connection.query('SELECT job_id, SUM(hour) as total_hour, SUM(minute) AS total_minute, SUM(pay_scale) AS total_pay_scale FROM tab_log WHERE job_id=? GROUP BY job_id', [job_id], (err, total_log) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else {
                    if (total_log[0].total_minute >= 60) {
                        var divisor = Math.floor((total_log[0].total_minute) / 60);
                        var reminder = (total_log[0].total_minute) % 60;
                        var hour = total_log[0].total_hour + divisor;
                        var minute = reminder;

                        async.forEachOf(result, (item, index) => {
                            function formatDate(date) {
                                var d = new Date(date),
                                    month = '' + (d.getMonth() + 1),
                                    day = '' + d.getDate(),
                                    year = d.getFullYear();

                                if (month.length < 2)
                                    month = '0' + month;
                                if (day.length < 2)
                                    day = '0' + day;
                                return [year, month, day].join('-');
                            }

                            var match_date = formatDate(item.date);

                            // var sql1 = `SELECT A.user_id,A.job_id, SUM(A.hour) as total_hour, SUM(A.minute) AS total_minute, SUM(A.pay_scale) AS total_pay_scale,B.first_name,B.last_name,B.role_id,B.profile_pic,A.status FROM tab_log A LEFT JOIN tab_users B ON B.user_id=A.user_id WHERE A.job_id=? AND A.created_at LIKE '%${match_date}%' GROUP BY A.user_id`;
                            // var sql1 = `SELECT A.user_id,A.job_id, SUM(A.hour) as total_hour, SUM(A.minute) AS total_minute, SUM(A.pay_scale) AS total_pay_scale,B.first_name,B.last_name,B.role_id,B.profile_pic,A.status FROM tab_log A LEFT JOIN tab_users B ON B.user_id=A.user_id WHERE A.job_id=? AND A.created_at LIKE '%${match_date}%' GROUP BY A.user_id`;
                            // 22 july

                            var sql1 = `SELECT A.user_id,A.job_id, SUM(A.hour) as total_hour, SUM(A.minute) AS total_minute, SUM(A.pay_scale) AS total_pay_scale,B.first_name,B.last_name,B.role_id,B.profile_pic,A.status,C.change_status FROM tab_log A LEFT JOIN tab_users B ON B.user_id=A.user_id LEFT JOIN tab_job_apply C ON C.user_id=B.user_id && C.job_id=A.job_id WHERE A.job_id=? AND A.created_at LIKE '%${match_date}%' GROUP BY A.user_id`;
                            mysql.connection.query(sql1, [job_id], (err, list) => {
                                if (err) {
                                    console.log("Internal server error.")
                                } else if (list.length == 0) {
                                    console.log("No data found.")
                                } else {

                                    console.log("match_date ===>", match_date)

                                    obj = {};
                                    list.map((x) => {
                                        x['date'] = match_date,
                                            x['index'] = index,
                                            x['approval_hour'] = ''
                                    })
                                    obj[`seeker`] = list;
                                    array.push(obj);
                                }
                            })
                        })

                        new Promise(resolve => {
                            setTimeout(() => {
                                resolve(array);
                            }, 2000);
                        }).then((response) => {
                            res.json({ status: 200, msg: "Data found successfully.", data: response, total_hour: hour + " hr", total_minute: minute + " min", total_payment: total_log[0].total_pay_scale })
                        })
                    } else {
                        async.forEachOf(result, (item, index) => {
                            function formatDate(date) {
                                var d = new Date(date),
                                    month = '' + (d.getMonth() + 1),
                                    day = '' + d.getDate(),
                                    year = d.getFullYear();

                                if (month.length < 2)
                                    month = '0' + month;
                                if (day.length < 2)
                                    day = '0' + day;

                                return [year, month, day].join('-');
                            }

                            var match_date = formatDate(item.date);

                            // var sql1 = `SELECT A.user_id,A.job_id, SUM(A.hour) as total_hour, SUM(A.minute) AS total_minute, SUM(A.pay_scale) AS total_pay_scale,B.first_name,B.last_name,B.role_id,B.profile_pic,A.status FROM tab_log A LEFT JOIN tab_users B ON B.user_id=A.user_id WHERE A.job_id=? AND A.created_at LIKE '%${match_date}%' GROUP BY A.user_id`;

                            // 22 july

                            var sql1 = `SELECT A.user_id,A.job_id, SUM(A.hour) as total_hour, SUM(A.minute) AS total_minute, SUM(A.pay_scale) AS total_pay_scale,B.first_name,B.last_name,B.role_id,B.profile_pic,A.status,C.change_status FROM tab_log A LEFT JOIN tab_users B ON B.user_id=A.user_id LEFT JOIN tab_job_apply C ON C.user_id=B.user_id && C.job_id=A.job_id WHERE A.job_id=? AND A.created_at LIKE '%${match_date}%' GROUP BY A.user_id`

                            mysql.connection.query(sql1, [job_id], (err, list) => {
                                if (err) {
                                    console.log("Internal server error.")
                                } else if (list.length == 0) {
                                    console.log("No data found.")
                                } else {

                                    obj = {};
                                    list.map((x) => {
                                        x['date'] = match_date,
                                            x['approval_hour'] = ''
                                    })

                                    obj[`seeker`] = list;
                                    array.push(obj);
                                }
                            })
                        })

                        new Promise(resolve => {
                            setTimeout(() => {
                                resolve(array);
                            }, 2000);
                        }).then((response) => {
                            res.json({ status: 200, msg: "Data found successfully.", data: response, total_hour: total_log[0].total_hour + " hr", total_minute: total_log[0].total_minute + " min", total_payment: total_log[0].total_pay_scale })
                        })
                    }
                }
            })
        }
    })








    // async function formatDate(date) {

    //     var d = new Date(date),
    //         month = '' + (d.getMonth() + 1),
    //         day = '' + d.getDate(),
    //         year = d.getFullYear();

    //     if (month.length < 2)
    //         month = '0' + month;
    //     if (day.length < 2)
    //         day = '0' + day;

    //     return [year, month, day].join('-');
    // }

    // var arr = [];

    // var sql = 'SELECT job_id, DATE(created_at) AS date, SUM(hour) as total_hour, SUM(minute) AS total_minute, SUM(pay_scale) AS total_pay_scale FROM tab_log WHERE job_id=? GROUP BY DATE(created_at)'
    // SELECT A.*,B.* FROM `tab_booking` A LEFT JOIN tab_log B ON (A.seeker_id=B.user_id AND B.job_id = 411) WHERE A.`job_id` LIKE '411'

    // mysql.connection.query(sql, [job_id], (err, result) => {
    //     if (err) {
    //         res.json({ status: 500, msg: "Internal server error.", err: err })
    //     } else if (result.length == 0) {
    //         res.json({ status: 404, msg: "No data found.", data: result })
    //     } else {
    //         mysql.connection.query('SELECT job_id, SUM(hour) as total_hour, SUM(minute) AS total_minute, SUM(pay_scale) AS total_pay_scale FROM tab_log WHERE job_id=? GROUP BY job_id', [job_id], (err, total_log) => {
    //             if (err) {
    //                 res.json({ status: 500, msg: "Internal server error." })
    //             } else {

    //                 if (total_log[0].total_minute > 60) {

    //                     var divisor = Math.floor((total_log[0].total_minute) / 60);
    //                     var reminder = (total_log[0].total_minute) % 60;
    //                     var hour = total_log[0].total_hour + divisor;
    //                     var minute = reminder;


    //                     for (var i = 0; i < result.length; i++) {

    //                         var Result = result[i];

    //                         console.log("date ===>", result[i].date)

    //                         formatDate(result[i].date).then((match_date) => {
    //                             // console.log("match date1 ===>", match_date)

    //                             var sql = `SELECT A.user_id,A.job_id, SUM(A.hour) as total_hour, SUM(A.minute) AS total_minute, SUM(A.pay_scale) AS total_pay_scale,B.first_name,B.last_name,B.role_id,B.profile_pic FROM tab_log A LEFT JOIN tab_users B ON B.user_id=A.user_id WHERE A.job_id=? AND A.created_at LIKE '%${match_date}%' GROUP BY A.user_id`;
    //                             // console.log("sql1 ====>", sql)


    //                             // new Promise((resolve, reject) => {
    //                             //     mysql.connection.query(sql, [job_id], (err, list) => {

    //                             //         if (err) {
    //                             //             reject("Internal server error.")
    //                             //         } else if (list.length == 0) {
    //                             //             reject("No data found.")
    //                             //         } else {
    //                             //             resolve("Data found")
    //                             //         }
    //                             //     })
    //                             // }).then((response) => {
    //                             //     // console.log(response)
    //                             //     console.log("match date1 ===>", match_date)

    //                             // }).catch((error) => {
    //                             //     console.log("error", error)
    //                             //         // console.log("match date1 ===>", match_date)

    //                             // })




    //                             mysql.connection.query(sql, [job_id], (err, list) => {
    //                                 if (err) {
    //                                     console.log("Internal server error.")
    //                                 } else if (list.length == 0) {
    //                                     console.log("No data found.")
    //                                 } else {
    //                                     console.log("match date1 ===>", match_date)

    //                                     // console.log("Data found successfully.=====>", match_date, list)
    //                                     // console.log("sql2 ====>", sql)

    //                                     var obj = {};

    //                                     obj[`${match_date}`] = list[0]

    //                                     // arr.push(obj);

    //                                     // console.log("match date2 ===>", match_date)

    //                                     // Result[`${match_date}`] = list[0];
    //                                     // console.log(`result ===>`, Result)

    //                                     // Result.push(obj);
    //                                     // console.log("obj ==>", obj)
    //                                     // console.log(`result ===>`, Result)
    //                                     arr.push(Result);

    //                                     // console.log("array ==>", arr)

    //                                 }
    //                             })
    //                         })
    //                     }
    //                     // console.log("array ==>", arr)

    //                     res.json({ status: 200, msg: "Data found successfully.", data: result, total_hour: hour, total_minute: minute, total_payment: total_log[0].total_pay_scale })
    //                 } else {
    //                     res.json({ status: 200, msg: "Data found successfully.", data: result, total_hour: total_log[0].total_hour, total_minute: total_log[0].total_minute, total_payment: total_log[0].total_pay_scale })
    //                 }
    //             }
    //         })
    //     }
    // })
}

//====================================== API for earning source ============================

const seeker_earning = async(req, res) => {

    const { year } = req.body;
    var seeker_id = req.decoded.user_id;

    //  var sql = 'SELECT seeker_id, job_id, SUM(hour) as total_hour, SUM(minute) AS total_minute, SUM(pay_scale) AS total_pay_scale,SUM(approval_hour) as approval_hour, SUM(approval_min) AS approval_min, SUM(approval_payment) AS approval_payment  FROM tab_approve_seeker WHERE seeker_id=? GROUP BY seeker_id'

    var sql = 'SELECT seeker_id, SUM(hour) as total_hour, SUM(minute) AS total_minute, SUM(pay_scale) AS total_pay_scale,SUM(approval_hour) as approval_hour, SUM(approval_min) AS approval_min, SUM(approval_payment) AS approval_payment  FROM tab_approve_seeker WHERE seeker_id=? AND YEAR(CAST(created_at AS DATE))=? GROUP BY seeker_id'
        // var sql1 = 'SELECT seeker_id,job_id,SUM(hour) as total_hour, SUM(minute) AS total_minute, SUM(pay_scale) AS total_pay_scale,SUM(approval_hour) AS approval_hour,SUM(approval_min) AS approval_min,SUM(approval_payment) AS approval_payment, created_at FROM tab_approve_seeker WHERE seeker_id=? GROUP BY created_at'
        // var sql1 = 'SELECT seeker_id,job_id,SUM(hour) as total_hour, SUM(minute) AS total_minute, SUM(pay_scale) AS total_pay_scale,SUM(approval_hour) AS approval_hour,SUM(approval_min) AS approval_min,SUM(approval_payment) AS approval_payment,MONTHNAME(created_at) AS month, created_at FROM tab_approve_seeker WHERE seeker_id=? GROUP BY created_at'

    // var sql1 = 'SELECT seeker_id,job_id,SUM(hour) as total_hour, SUM(minute) AS total_minute, SUM(pay_scale) AS total_pay_scale,SUM(approval_hour) AS approval_hour,SUM(approval_min) AS approval_min,SUM(approval_payment) AS approval_payment,MONTHNAME(created_at) AS month, created_at FROM tab_approve_seeker WHERE seeker_id=? AND YEAR(CAST(created_at AS DATE))=? GROUP BY created_at'

    var sql1 = 'SELECT seeker_id,SUM(pay_scale) AS total_pay_scale,SUM(approval_payment) AS approval_payment,MONTHNAME(created_at) AS month FROM tab_approve_seeker WHERE seeker_id=? AND YEAR(CAST(created_at AS DATE))=? GROUP BY created_at'

    var sql2 = 'SELECT seeker_id,job_id FROM tab_approve_seeker WHERE seeker_id=? GROUP BY job_id';

    mysql.connection.query(sql, [seeker_id, year], (err, total_earning) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error 1.", error: err })
        } else if (total_earning.length == 0) {
            res.json({ status: 500, msg: "No earning founded.", data: [], total_earning: 0, total_job: 0 })
        } else {
            mysql.connection.query(sql1, [seeker_id, year], (err, result) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error 2.", err: err })
                } else if (total_earning.length == 0) {
                    res.json({ status: 500, msg: "No earning founded.", data: [], total_earning: 0, total_job: 0 })
                } else {
                    mysql.connection.query(sql2, [seeker_id], (err, total_job) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error 3.", err: err })
                            } else if (total_job.length == 0) {
                                res.json({ status: 200, msg: "Earning founded.", data: result, total_earning: total_earning[0].approval_payment, total_job: 0 })
                            } else {
                                var month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                                var array = [];
                                async.forEachOf(month, (item, index) => {
                                    var filter_data = result.filter(d => d.month == item);
                                    if (filter_data.length > 0) {
                                        array.push(filter_data[0])
                                    } else {

                                        // seeker_id,total_pay_scale,approval_payment,month

                                        var obj = { seeker_id: seeker_id, total_pay_scale: 0, approval_payment: 0, "month": item, }
                                        array.push(obj)
                                    }
                                })
                                new Promise(resolve => {
                                        setTimeout(() => {
                                            resolve(array);
                                        }, 1000);
                                    }).then((response) => {
                                        res.json({ status: 200, message: "Earning founded", data: response, total_earning: (total_earning[0].approval_payment).toFixed(2), total_job: total_job.length })
                                        console.log("Earning founded ===>", total_earning[0].approval_payment, (total_earning[0].approval_payment).toFixed(2));
                                    }).catch((error) => {
                                        res.json({ status: 400, msg: "Something went wrong." })
                                    })
                                    // res.json({ status: 200, msg: "Earning founded.", data: result, total_earning: total_earning[0].total_pay_scale, total_job: total_job.length })
                            }
                        })
                        // res.json({ status: 200, msg: "Earning founded.", data: result, total_earning: total_earning[0].total_pay_scale })
                }
            })
        }
    })
}

//========================================= API for job_journey ====================================================

const job_journey = (req, res) => {

    const { job_id, date } = req.body;
    var sql = `SELECT A.user_id,A.job_id, SUM(A.hour) as total_hour, SUM(A.minute) AS total_minute, SUM(A.pay_scale) AS total_pay_scale,B.first_name,B.last_name,B.role_id,B.profile_pic FROM tab_log A LEFT JOIN tab_users B ON B.user_id=A.user_id WHERE A.job_id=? AND A.created_at LIKE '%${date}%' GROUP BY A.user_id`;

    mysql.connection.query(sql, [job_id, date], (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error.", err: err })
        } else if (result.length == 0) {
            res.json({ status: 404, msg: "No data found.", data: result })
        } else {
            res.json({ status: 200, msg: "Data found successfully.", data: result })
        }
    })
}


//============================================ API for show total hour log at job completions ===================

const job_completion = (req, res) => {

    const { job_id } = req.body;
    // const { user_id } = req.decoded.user_id;
    var arr = [];
    var obj;
    //  var sql = 'SELECT user_id,job_id, SUM(hour) as total_hour, SUM(minute) AS total_minute, SUM(pay_scale) AS total_pay_scale,COUNT(*) AS COUNT FROM tab_log WHERE job_id=268 GROUP BY user_id'
    var sql = 'SELECT A.user_id,A.job_id, SUM(A.hour) as total_hour, SUM(A.minute) AS total_minute, SUM(A.pay_scale) AS total_pay_scale,COUNT(*) AS COUNT, B.first_name,B.last_name,B.profile_pic,B.role_id FROM tab_log A LEFT JOIN tab_users B ON B.user_id = A.user_id WHERE A.job_id=? GROUP BY A.user_id'
    mysql.connection.query(sql, [job_id], (err, list) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (list.length == 0) {
            res.json({ status: 404, msg: "No data found.", data: list, total_hour: null, total_minute: null, total_payment: null })
        } else {
            async.forEachOf(list, (item, index) => {
                var sql1 = 'SELECT user_id, COUNT(*) AS entries, created_at FROM tab_log WHERE user_id = ? AND job_id=? AND status=1 GROUP BY DATE(created_at)'
                mysql.connection.query(sql1, [item.user_id, job_id], (err, result) => {
                    if (err) {
                        console.log("Internal server error.")
                    } else if (result.length == 0) {
                        console.log("No data found.")
                    } else {
                        var length = result.length;
                        item['day'] = length;
                        item['approval_hour'] = '';
                        item['approval_min'] = '';
                        item['approval_payment'] = '';
                        arr.push(item);
                    }
                })
            })

            new Promise(resolve => {
                setTimeout(() => {
                    resolve(arr);
                }, 2000);
            }).then((response) => {
                mysql.connection.query('SELECT job_id, SUM(hour) as total_hour, SUM(minute) AS total_minute, SUM(pay_scale) AS total_pay_scale FROM tab_log WHERE job_id=? GROUP BY job_id', [job_id], (err, total_log) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else {
                            if (total_log[0].total_minute >= 60) {
                                var divisor = Math.floor((total_log[0].total_minute) / 60);
                                var reminder = (total_log[0].total_minute) % 60;
                                var hour = total_log[0].total_hour + divisor;
                                var minute = reminder;
                                res.json({ status: 200, msg: "Data found successfully.", data: response, total_hour: hour, total_minute: minute, total_payment: total_log[0].total_pay_scale })
                            } else {
                                res.json({ status: 200, msg: "Data found successfully.", data: response, total_hour: total_log[0].total_hour, total_minute: total_log[0].total_minute, total_payment: total_log[0].total_pay_scale })
                            }
                        }
                    })
                    // res.json({ status: 200, msg: "Data found successfully.", data: response })
            }).catch((error) => {
                res.json({ status: 400, msg: "Something went wrong." })
            })
        }
    })
}


//============================================ API for complete job =================================================


const complete_job = async(req, res) => {

    const provider_id = req.decoded.user_id;
    const { job_id } = req.body

    await completeJOB();

    function completeJOB() {
        if (!job_id) {
            res.json({ status: 422, msg: "Job Id is required." })
        } else {
            mysql.connection.query('SELECT * FROM tab_invoice where job_id=?', [job_id], (err, invoice) => {
                if (err) {
                    res.json({ status: 500, msg: "Something went wrong." })
                } else if (invoice.length == 0) {
                    res.json({ status: 500, msg: "Please payment complete first." })
                } else {
                    mysql.connection.query('update tab_jobs set isCompleted=?,payment_status=?,payment=?,visibility=? where job_id=? AND user_id=?', [0, 1, invoice[0].amount, 0, job_id, provider_id], (err, result) => {
                        if (err) {
                            res.json({ status: 500, msg: "Something went wrong." })
                        } else {

                            // change status=0 for progress bar

                            // mysql.connection.query('update tab_users set payment_job_id=? ,payment_status=?,payment=? where  user_id=?', [job_id, 1, invoice[0].amount, provider_id], (err, updated) => {

                            mysql.connection.query('update tab_users set payment_job_id=? ,payment_status=?,payment=?,progress_bar_status=?,progress_bar_job_id=? where  user_id=?', [job_id, 1, invoice[0].amount, 0, '', provider_id], (err, updated) => {
                                    if (err) {
                                        res.json({ status: 500, msg: "Something went wrong." })
                                    } else {
                                        // 29 sep 2020
                                        mysql.connection.query('select * from tab_booking where job_id =?', [job_id], (err, seeker_list) => {
                                            if (err) {
                                                res.json({ status: 500, msg: "Something went wrong." })
                                            } else if (seeker_list.length == 0) {
                                                res.json({ status: 500, msg: "No seeker founded." })
                                            } else {
                                                mysql.connection.query('select * from tab_jobs where job_id=?', [job_id], (err, job) => {
                                                    if (err) {
                                                        res.json({ status: 500, msg: "Something went wrong." })
                                                    } else if (job.length == 0) {
                                                        res.json({ status: 500, msg: "No job found." })
                                                    } else {
                                                        var title = `${job[0].job_title} job has been closed.`;
                                                        var text = `${job[0].job_title}`;
                                                        // console.log("seeker_list ===>", seeker_list)

                                                        async.forEachOf(seeker_list, (item, index) => {
                                                            // console.log("item ===>", index, item);
                                                            mysql.connection.query('select * from tab_users where user_id=?', [item.seeker_id], (err, seeker) => {
                                                                if (err) {
                                                                    console.log("Error found")
                                                                } else if (seeker.length == 0) {
                                                                    console.log("No seeker found")
                                                                } else {
                                                                    mysql.connection.query('update tab_users set progress_bar_status=? where user_id=?', [0, item.seeker_id], (err, update_dataaa) => {
                                                                        if (err) {
                                                                            console.log("Error found")
                                                                        } else {

                                                                            console.log("seeker_list ===>", seeker)
                                                                            var JOB = job_id;
                                                                            var senderID = provider_id;
                                                                            var receiverId = item.seeker_id;
                                                                            var RoleId = seeker[0].role_id;

                                                                            var data = { //data
                                                                                "job_id": JOB.toString(), //job_id
                                                                                "sender_id": senderID.toString(), //seeker provider user id
                                                                                "receiver_id": receiverId.toString(),
                                                                                "role_id": RoleId.toString(),
                                                                                "isCompleted": "0"
                                                                            }

                                                                            console.log("data ==>", data)
                                                                            common_function.send_push_notification(seeker[0].device_token, title, text, data);

                                                                            mysql.connection.query('Insert into tab_notification set sender_id=?,user_id=?,message=?,status=?', [provider_id, seeker[0].user_id, title, 2], (err, save_notification) => {
                                                                                if (err) {
                                                                                    console.log("Error found while save notification")
                                                                                } else {
                                                                                    console.log("Successfully save notification");
                                                                                }
                                                                            })
                                                                        }
                                                                    })
                                                                }

                                                            })
                                                        })
                                                        res.json({ status: 200, msg: "Successfully completed job." })
                                                    }
                                                })
                                            }
                                        })
                                    }
                                })
                                // res.json({ status: 200, msg: "Successfully completed job." })
                        }
                    })
                }
            })
        }
    }
}


//==================================== Api for replace seeker ============

const replace_seeker = async(req, res) => {

    const { job_id, seeker_id } = req.body;

    var provider_id = req.decoded.user_id;

    var lat = '';
    var lng = '';
    var no_of_opening;

    var sql = 'select A.*, B.skill, C.company_name from tab_jobs A LEFT JOIN tab_skills B ON B.id = A.category LEFT JOIN tab_users C ON C.user_id = A.user_id where A.job_id =? and A.user_id =? and A.visibility=1';

    mysql.connection.query(sql, [job_id, provider_id], (err, job) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error.", err1: err })
        } else if (job.length == 0) {
            res.json({ status: 404, msg: "No job founded", data: job })
        } else {

            lat = job[0].lat;
            lng = job[0].lng;
            no_of_opening = job[0].no_of_opening;
            var skill = job[0].category;
            var title = `You have been invited to work on a job of ${job[0].skill} at ${job[0].company_name} `;
            var text = `${job[0].job_title}`;

            var sql1 = 'update tab_job_apply set change_status=? where user_id=? and job_id=?';

            mysql.connection.query(sql1, [1, seeker_id, job_id], (err, change_user) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", err2: err })
                } else {
                    mysql.connection.query('Update tab_booking set change_status=? where seeker_id=? and job_id=?', [1, seeker_id, job_id], (err, update_tab_booking_status) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", err11: err })
                        } else {
                            var sql2 = 'select * from tab_users where user_id=?';
                            mysql.connection.query(sql2, [seeker_id], (err, seeker) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error.", err: err })
                                } else {
                                    var change = seeker[0].change_user;
                                    change += 1;

                                    var sql3 = 'update tab_users set change_user=? where user_id=?';

                                    mysql.connection.query(sql3, [change, seeker_id], (err, change_seeker_count) => {
                                        if (err) {
                                            res.json({ status: 500, msg: "Internal server error.", err4: err })
                                        } else {

                                            var sql4 = 'SELECT  B.user_id,B.first_name,B.last_name,B.email,B.profile_pic,B.company_name,A.skill_id,B.category_id,B.category_name,B.ssn,B.dob,B.distance,B.background_check,B.drug_test,B.role_id,B.isCompleteProfile,B.token,B.device_type,B.device_token,B.quiz_score,B.lat,B.lng,B.work_lat,B.work_lng,B.created_at FROM `tab_user_skills` A LEFT JOIN tab_users B ON A.user_id = B.user_id WHERE (A.skill_id=? || A.skill_id=46) AND B.role_id=2 and B.isCompleteProfile=1 And A.user_id NOT IN (select user_id from tab_job_apply where job_id=? AND apply_status=1)';

                                            mysql.connection.query(sql4, [skill, job_id], (err, user_list) => {
                                                if (err) {
                                                    res.json({ status: 500, msg: "Internal server error.", err5: err })
                                                } else if (user_list.length == 0) {
                                                    res.json({ status: 404, msg: "No seeker founded." })
                                                } else {
                                                    var opening = no_of_opening - 1;
                                                    var sql5 = 'update tab_jobs set no_of_opening=? where job_id=?';
                                                    mysql.connection.query(sql5, [opening, job_id], (err, update_opening) => {
                                                        if (err) {
                                                            res.json({ status: 500, msg: "Internal server error.", err6: err })
                                                        } else {

                                                            for (var i = 0; i < user_list.length; i++) {
                                                                var JOB = job_id;
                                                                var senderID = provider_id;
                                                                var receiverId = user_list[i].user_id;
                                                                var RoleId = user_list[i].role_id;
                                                                var latitude = lat.toString();
                                                                var longitude = lng.toString();

                                                                var data = { //data
                                                                    "job_id": JOB.toString(), //job_id
                                                                    "sender_id": senderID.toString(), //seeker provider user id
                                                                    "receiver_id": receiverId.toString(),
                                                                    "role_id": RoleId.toString(),
                                                                    "lat": latitude,
                                                                    "long": longitude,
                                                                    "isCompleted": "1"
                                                                }
                                                                var job = {
                                                                    lat: lat,
                                                                    lon: lng
                                                                }
                                                                var user = '';

                                                                if (user_list[i].work_lat != null && user_list[i].work_lng != null) {
                                                                    user = {
                                                                        lat: Number(user_list[i].work_lat),
                                                                        lon: Number(user_list[i].work_lng)
                                                                    }
                                                                }

                                                                console.log('job location', job);
                                                                console.log('user location', user_list[i].user_id, user);

                                                                var distance = geolib.getDistance(job, user);
                                                                var d = distance / 1000;
                                                                console.log('diffrence', d)
                                                                if (d <= Number(user_list[i].distance)) {
                                                                    common_function.send_push_notification(user_list[i].device_token, title, text, data);
                                                                    mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?,type=?', [job_id, user_list[i].user_id, title, lat, lng, 1, user_list[i].distance, 1, 1], (err, save_notification) => {
                                                                        if (err) {
                                                                            console.log('Error found in save notification.')
                                                                        } else {
                                                                            console.log('Save Notifications into DB.')
                                                                        }
                                                                    })
                                                                } else {
                                                                    console.log('No seeker found to send notification.')
                                                                }
                                                            }
                                                            res.json({ status: 200, msg: "Successfully sent for find resouces." })
                                                        }
                                                    })
                                                }
                                            })
                                        }
                                    })
                                }
                            })

                        }
                    })
                }
            })
        }
    })
}




// ==================================== API for change seeker ==============================================

const change_seeker = async(req, res) => {

    const { job_id, provider_id, seeker_id } = req.body;

    // const { provider_id } = req.decoded.user_id;
    // select A.*, B.skill, C.company_name from tab_jobs A LEFT JOIN tab_skills B ON B.id = A.category LEFT JOIN tab_users C ON C.user_id = A.user_id where A.job_id =? and A.user_id =? and A.visibility=1
    // select * from tab_jobs where job_id =? AND user_id=? AND visibility=?
    mysql.connection.query('select A.*, B.skill, C.company_name from tab_jobs A LEFT JOIN tab_skills B ON B.id = A.category LEFT JOIN tab_users C ON C.user_id = A.user_id where A.job_id =? and A.user_id =? and A.visibility=1', [job_id, provider_id, 1], (err, job) => {
        if (err) {
            res.json({ status: 200, msg: "Internal server error." })
        } else if (job.length == 0) {
            res.json({ status: 404, msg: "No job founded", data: job })
        } else {
            // console.log("job ===>", job)

            var lat = job[0].lat;
            var lng = job[0].lng;
            var category = job[0].category;
            var skill = job[0].skill;
            var company_name = job[0].company_name;
            var job_title = job[0].job_title;

            var sql = 'SELECT  B.user_id,B.first_name,B.last_name,B.email,B.profile_pic,B.company_name,A.skill_id,B.category_id,B.category_name,B.ssn,B.dob,B.distance,B.background_check,B.drug_test,B.role_id,B.isCompleteProfile,B.token,B.device_type,B.device_token,B.quiz_score,B.lat,B.lng,B.work_lat,B.work_lng,B.created_at FROM `tab_user_skills` A LEFT JOIN tab_users B ON A.user_id = B.user_id WHERE A.skill_id=? AND B.role_id=2 and B.isCompleteProfile=1 And A.user_id NOT IN (select user_id from tab_job_apply where job_id=? AND apply_status=1)'

            var sql1 = 'SELECT A.*,B.first_name,B.last_name,B.email,B.role_id,B.profile_pic,B.device_token,B.work_lat,B.work_lng,B.lat,B.lng FROM `tab_user_skills` A LEFT JOIN tab_users B On B.user_id=A.user_id WHERE (A.skill_id=? || A.skill_id=46) AND B.isCompleteProfile=1';

            mysql.connection.query(sql1, [job[0].category], (err, seeker_list) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (seeker_list.length == 0) {
                    res.json({ status: 404, msg: "No seeker found." })
                } else {
                    async.forEachOf(seeker_list, (item, index) => {
                        mysql.connection.query('select * from tab_booking where job_id =?', [job_id], (err, booking_list) => {
                            if (err) {
                                console.log("Internal server error")
                            } else if (booking_list.length == 0) {
                                console.log("No data found")
                            } else {
                                // console.log("user ===>", index, item.user_id)



                                // async.forEachOf(booking_list, (value, i) => {

                                //     if (item.user_id == value.seeker_id) {
                                //         console.log("Already Working on this job.==>", item.user_id)
                                //     } else {

                                //         // console.log("job ===>", job)
                                //         // lat = job[0].lat;
                                //         // lng = job[0].lng;
                                //         // var skill = category;
                                //         var title = `You have been invited to work on a job of ${skill} at ${company_name} `;
                                //         var text = `${job_title}`;


                                //         var JOB = job_id;
                                //         var senderID = provider_id;
                                //         var receiverId = item.user_id;
                                //         var RoleId = item.role_id;
                                //         var latitude = lat.toString();
                                //         var longitude = lng.toString();


                                //         var data = { //data
                                //             "job_id": JOB.toString(), //job_id
                                //             "sender_id": senderID.toString(), //seeker provider user id
                                //             "receiver_id": receiverId.toString(),
                                //             "role_id": RoleId.toString(),
                                //             "lat": latitude,
                                //             "long": longitude
                                //         }
                                //         var job = {
                                //             lat: lat,
                                //             lon: lng
                                //         }
                                //         var user = '';

                                //         if (item.work_lat != null && item.work_lng != null) {
                                //             user = {
                                //                 lat: Number(item.work_lat),
                                //                 lon: Number(item.work_lng)
                                //             }
                                //         }

                                //         console.log('job location', job);
                                //         console.log('user location', item.user_id, user)


                                //         var distance = geolib.getDistance(job, user);
                                //         var d = distance / 1000;
                                //         console.log('diffrence', d)


                                //         if (d <= Number(item.distance)) {


                                //             common_function.send_push_notification(item.device_token, title, text, data);

                                //             mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?,type=?', [job_id, item.user_id, title, lat, lng, 1, item.distance, 1, 0], (err, save_notification) => {
                                //                 if (err) {
                                //                     console.log('Error found in save notification.')
                                //                 } else {
                                //                     console.log('Save Notifications into DB.')
                                //                 }
                                //             })
                                //         } else {
                                //             console.log('No seeker found to send notification.')
                                //         }


                                //     }
                                // })


                                if (item.user_id == booking_list[0].seeker_id) {
                                    console.log("Already Working on this job.==>", item.user_id)
                                } else {
                                    // console.log("job ===>", job)
                                    // lat = job[0].lat;
                                    // lng = job[0].lng;
                                    // var skill = category;
                                    var title = `You have been invited to work on a job of ${skill} at ${company_name}`;
                                    var text = `${job_title}`;

                                    var JOB = job_id;
                                    var senderID = provider_id;
                                    var receiverId = item.user_id;
                                    var RoleId = item.role_id;
                                    var latitude = lat.toString();
                                    var longitude = lng.toString();

                                    var data = { //data
                                        "job_id": JOB.toString(), //job_id
                                        "sender_id": senderID.toString(), //seeker provider user id
                                        "receiver_id": receiverId.toString(),
                                        "role_id": RoleId.toString(),
                                        "lat": latitude,
                                        "long": longitude,
                                        "isCompleted": "1"
                                    }
                                    var job = {
                                        lat: lat,
                                        lon: lng
                                    }

                                    var user = '';

                                    if (item.work_lat != null && item.work_lng != null) {
                                        user = {
                                            lat: Number(item.work_lat),
                                            lon: Number(item.work_lng)
                                        }
                                    }

                                    console.log('job location', job);
                                    console.log('user location', item.user_id, user)


                                    var distance = geolib.getDistance(job, user);
                                    var d = distance / 1000;
                                    console.log('diffrence', d)

                                    if (d <= Number(item.distance)) {
                                        common_function.send_push_notification(item.device_token, title, text, data);
                                        mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?,type=?', [job_id, item.user_id, title, lat, lng, 1, item.distance, 1, 0], (err, save_notification) => {
                                            if (err) {
                                                console.log('Error found in save notification.')
                                            } else {
                                                console.log('Save Notifications into DB.')
                                            }
                                        })
                                    } else {
                                        console.log('No seeker found to send notification.')
                                    }
                                }
                            }
                        })
                    })
                    res.json({ status: 200, msg: "Successfully sent for change seeker." })
                }
            })
        }
    })
}


//======================================== API for approved seeker's log ============================================

const approve_seeker = async(req, res) => {

    const { data, approved_hours, approved_min, approved_payment } = req.body;
    // const { user_id } = req.deco

    console.log("body ===>", req.body);

    // ded.user_id;
    const provider_id = req.body.user_id;
    // const provider_id = req.body.user_id;

    console.log("data ===>", data)
        // const host = req.hostname;
        // var url = req.protocol + "://" + host + ":2000" + "/";
        // const destpath = 'uploads/invoice';
        // const filename = Date.now();


    // var base64 = '';

    // if (!file) {
    //     base64 = ''
    // } else {
    //     base64 = file
    // }

    // base64Img.img(file, destpath, filename, function(err, path) {
    //     if (err) {
    //         res.json({ status: 500, msg: "Error found at image upload." })
    //     } else {
    //         console.log("path ====>", url + path)

    var arr;
    if (!data) {
        arr = [];
    } else {
        arr = data;
    }


    var list = [{
            "user_id": 195,
            "job_id": 411,
            "total_hour": 0,
            "total_minute": 8,
            "total_pay_scale": 13.32,
            "COUNT": 4,
            "first_name": "BMW",
            "last_name": "BMW ",
            "profile_pic": "http://178.62.83.145:2000/uploads/image/1591370082366.png",
            "role_id": 2,
            "day": 3
        },
        {
            "user_id": 193,
            "job_id": 411,
            "total_hour": 0,
            "total_minute": 2,
            "total_pay_scale": 3.33,
            "COUNT": 3,
            "first_name": "job",
            "last_name": "seeker5",
            "profile_pic": "http://178.62.83.145:2000/uploads/image/1591170531086.png",
            "role_id": 2,
            "day": 1
        }
    ];


    async.forEachOf(arr, (item, index) => {
        var obj = [item.job_id, provider_id, item.user_id, item.total_hour, item.approval_hour, item.approval_min, item.approval_payment, item.total_minute, item.total_pay_scale, item.day];
        mysql.connection.query('select * from tab_jobs where job_id=?', [item.job_id], (err, job) => {
            if (err) {
                console.log("Error found while find job.")
            } else if (job.length == 0) {
                console.log("No job found.")
            } else {
                mysql.connection.query('insert into tab_approve_seeker set job_id=?,provider_id=?,seeker_id=?,hour=?,approval_hour=?,approval_min=?,approval_payment=?,minute=?,pay_scale=?,day=?', obj, (err, approve_seeker) => {
                    if (err) {
                        console.log('Error found while approved seeker.')
                    } else {
                        // approve seeker (status = 3) for approve seeker progress bar
                        mysql.connection.query('update tab_users set progress_bar_status=? where user_id=?', [3, item.user_id], (err, update_progress_bar) => {
                            if (err) {
                                console.log("Error found.")
                            } else {
                                console.log('Successfully approved seeker.')
                            }
                        })
                    }
                })
            }
        })


        // for (var i = 0; i < arr.length; i++) {

        //     var obj = [arr[i].job_id, provider_id, arr[i].user_id, arr[i].total_hour, arr[i].approval_hour, arr[i].approval_min, arr[i].approval_payment, arr[i].total_minute, arr[i].total_pay_scale, arr[i].day];

        //     // 12 OCT 2020

        //     mysql.connection.query('select * from tab_jobs where job_id=?', [arr[i].job_id], (err, job) => {
        //         if (err) {
        //             console.log("Error found while find job.")
        //         } else if (job.length == 0) {
        //             console.log("No job found.")
        //         } else {

        //             // console.log("Successfully updated.")

        //             // var hourly_rate = job[0].hourly_rate;
        //             // var minute_rate = (job[0].hourly_rate) / 60;
        //             // var total_min = arr[i].total_hour * 60 + arr[i].total_minute;
        //             // var per_minute_ot_charge = minute_rate * total_min;

        //             mysql.connection.query('insert into tab_approve_seeker set job_id=?,provider_id=?,seeker_id=?,hour=?,approval_hour=?,approval_min=?,approval_payment=?,minute=?,pay_scale=?,day=?', obj, (err, approve_seeker) => {
        //                 if (err) {
        //                     console.log('Error found while approved seeker.')
        //                 } else {

        //                     // 28 OCT 2020

        //                     // mysql.connection.query('update tab_booking set job_status=? where job_id=? and seeker_id=?', [0, arr[i].job_id, arr[i].user_id], (err, close_job) => {
        //                     //     if (err) {
        //                     //         console.log('Error found while close job from seeker.')
        //                     //     } else {
        //                     //         console.log('Successfully approved seeker.')
        //                     //     }
        //                     // })

        //                     console.log('Successfully approved seeker.')
        //                 }
        //             })
        //         }
        //     })
        // }



        // mysql.connection.query('insert into tab_invoice set job_id=?,user_id=?,invoice=?,invoice_number=?', [job_id, user_id, file, invoice_number], (err, save) => {
        //     if (err) {
        //         res.json({ status: 500, msg: "Internal server error.", err: err })
        //     } else {
        //         res.json({ status: 200, msg: "Successfully approved." })
        //     }
        // })
        //     }
    })

    res.json({ status: 200, msg: "Successfully approved." })

}

//======================================== API for show seeker's rating ==========================================

const show_seeker_rating = async(req, res) => {

    const { job_id } = req.body;
    // var sql ='SELECT A.user_id,A.job_id, SUM(A.hour) as total_hour, SUM(A.minute) AS total_minute, SUM(A.pay_scale) AS total_pay_scale,B.first_name,B.last_name,B.role_id,B.profile_pic,A.status FROM tab_log A LEFT JOIN tab_users B ON B.user_id=A.user_id WHERE A.job_id=? GROUP BY A.user_id'
    // var sql = 'SELECT A.user_id,A.job_id,B.first_name,B.last_name,B.role_id,B.profile_pic FROM tab_log A LEFT JOIN tab_users B ON B.user_id=A.user_id WHERE A.job_id=? GROUP BY A.user_id'; 
    var sql = 'SELECT A.user_id,A.job_id,B.first_name,B.last_name,B.role_id,B.profile_pic, AVG(C.rating) AS rating FROM tab_log A LEFT JOIN tab_users B ON B.user_id=A.user_id LEFT JOIN tab_rating C ON C.user_id = A.user_id WHERE A.job_id=? GROUP BY A.user_id, C.user_id';
    mysql.connection.query(sql, [job_id], (err, list) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (list.length == 0) {
            res.json({ status: 200, msg: "No data found." })
        } else {
            res.json({ status: 200, msg: "Data dound successfully.", data: list })
        }
    })
}


//====================================================== API for repost work now jobs ===================================================

const repost_work_post_job1 = async(req, res) => {

    const { job_id, job_title, start_date, end_date, start_time, end_time } = req.body;
    var user_id = req.decoded.user_id;

    var skill = '';

    if (!job_id || !user_id) {
        res.json({ status: 422, msg: "UserId and JobId both are required." })
    } else {
        mysql.connection.query('select A.*,B.skill,C.company_name from tab_jobs A LEFT JOIN tab_skills B ON A.category=B.id LEFT JOIN tab_users C ON C.user_id = A.user_id where A.job_id=? and A.user_id=? and A.job_type=1 and A.visibility=0', [job_id, user_id], (err, old_job) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (old_job.length == 0) {
                res.json({ status: 500, msg: "No data found." })
            } else {
                skill = old_job[0].category;
                var obj = [old_job[0].user_id, old_job[0].category, old_job[0].location, old_job[0].lat, old_job[0].lng, job_title, 1, start_date, end_date, start_time, end_time, old_job[0].equipment, old_job[0].worker_selection, old_job[0].hourly_rate, old_job[0].address, old_job[0].no_of_opening, 1];
                mysql.connection.query('Insert into tab_jobs set user_id=?,category=?,location=?,lat=?,lng=?,job_title=?,job_type=?,start_date=?,end_date=?,start_time=?,end_time=?,equipment=?,worker_selection=?,hourly_rate=?,address=?,no_of_opening=?,visibility=?', obj, (err, save_new_job) => {
                    if (err) {
                        res.json({ status: 500, msg: "Internal server error." })
                    } else {
                        var sql = 'SELECT B.user_id,B.first_name,B.last_name,B.email,B.profile_pic,B.company_name,A.skill_id,B.category_id,B.category_name,B.ssn,B.dob,B.distance,B.background_check,B.drug_test,B.role_id,B.isCompleteProfile,B.token,B.device_type,B.device_token,B.quiz_score,B.lat,B.lng,B.work_lat,B.work_lng,B.created_at FROM `tab_user_skills` A LEFT JOIN tab_users B ON A.user_id = B.user_id WHERE A.skill_id=? AND B.role_id=2 and B.isCompleteProfile=1'
                            // var sql = 'select * from tab_users where role_id=2 and isCompleteProfile=1'
                        mysql.connection.query(sql, [skill], (err, user_list) => {
                            if (err) {
                                console.log("Error found.")
                            } else if (user_list.length == 0) {
                                console.log("No seeker found.")
                            } else {
                                for (var i = 0; i < user_list.length; i++) {
                                    var ttl = `You have been invited to work on a job of ${old_job[0].skill} at ${old_job[0].company_name}`; //title
                                    var text = `${job_title}.`; //body
                                    var saveId = save_new_job.insertId;
                                    var ID = user_id;
                                    var receiverId = user_list[i].user_id;
                                    var RoleId = user_list[i].role_id;
                                    var latitude = old_job[0].lat;
                                    var longitude = old_job[0].lng;

                                    var data = { //data
                                        "job_id": saveId.toString(), //job_id
                                        "sender_id": ID.toString(), //seeker provider user id
                                        "receiver_id": receiverId.toString(),
                                        "role_id": RoleId.toString(),
                                        "lat": latitude.toString(),
                                        "long": longitude.toString(),
                                        "isCompleted": "1"
                                    }


                                    // var data = { //data
                                    //     job_id: save_new_job.insertId, //job_id
                                    //     sender_id: user_id, //seeker provider user id
                                    //     receiver_id: user_list[i].user_id,
                                    //     role_id: user_list[i].role_id,
                                    //     lat: old_job[0].lat,
                                    //     long: old_job[0].lng
                                    // }


                                    var job = {
                                        lat: old_job[0].lat,
                                        lon: old_job[0].lng
                                    }
                                    var user = '';

                                    if (user_list[i].work_lat != null && user_list[i].work_lng != null) {
                                        user = {
                                            lat: Number(user_list[i].work_lat),
                                            lon: Number(user_list[i].work_lng)
                                        }
                                    }

                                    console.log('job location', job);
                                    console.log('user location', user_list[i].user_id, user)


                                    var distance = geolib.getDistance(job, user);
                                    var d = distance / 1000;
                                    console.log('diffrence', d)


                                    if (d <= Number(user_list[i].distance)) {
                                        // var SAVE_ID = save_job.insertId;
                                        // var SEEKER_ID = user_list[i].user_id;
                                        common_function.send_push_notification(user_list[i].device_token, ttl, text, data);
                                        mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?,status=?', [save_new_job.insertId, user_list[i].user_id, ttl, old_job[0].lat, old_job[0].lng, 1, user_list[i].distance, 1], (err, save_notification) => {
                                            if (err) {
                                                console.log('Error found in save notification.')
                                            } else {
                                                console.log('Save Notifications into DB.')

                                                //4 june 2020

                                                // mysql.connection.query('insert into tab_job_application_status set job_id=?, user_id=?, message=?', [SAVE_ID, SEEKER_ID, ttl], (err, save_application) => {
                                                //     if (err) {
                                                //         console.log('Error found in job application notification.')
                                                //     } else {
                                                //         console.log('Save job application status into DB.')
                                                //     }
                                                // })
                                            }
                                        })
                                    } else {
                                        console.log('No seeker found to send notification.')
                                    }
                                }
                            }
                        })
                        res.json({ status: 200, msg: "Successfully repost work now job.", job_id: save_new_job.insertId })
                            // }
                            // })
                    }
                })
            }
        })
    }
}


//============================================ API for manual find no people ===============================================================

const find_no_people_long_term_job = async(req, res) => {

    var user_id = req.decoded.user_id; // job provider id
    var array = [];
    var obj = {};
    if (!user_id) {
        res.json({ status: 422, msg: "UserId is required." })
    } else {
        var sql1 = "SELECT A.*,B.skill,C.skill As category, D.name,D.addressline1,D.addressline2,D.city,D.state,D.zipcode,D.zone FROM tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category LEFT JOIN tab_skills C ON C.id=B.parent_id LEFT JOIN tab_address D ON D.id=A.address WHERE A.job_id=?"
        mysql.connection.query(sql1, [req.body.job_id], (err, job_detail) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error.", err1: err })
            } else if (job_detail.length == 0) {
                res.json({ status: 200, msg: "Successfully found number of people who accepeted this job.", data: null, job_detail: job_detail })
            } else {

                // var sql = "SELECT A.*,B.first_name,B.last_name,B.profile_pic FROM tab_job_apply A LEFT JOIN tab_users B ON A.user_id=B.user_id WHERE A.job_id=? AND A.apply_status=1  ";

                var sql = "SELECT A.*,B.first_name,B.last_name,B.profile_pic,ROUND(AVG(C.rating),0) AS rating FROM tab_job_apply A LEFT JOIN tab_users B ON A.user_id=B.user_id LEFT JOIN tab_rating C ON C.user_id=A.user_id WHERE A.job_id=? AND A.apply_status=1 GROUP BY C.user_id,A.user_id"

                // var sql = "SELECT A.*,B.first_name,B.last_name,B.profile_pic FROM tab_job_apply A LEFT JOIN tab_users B ON A.user_id=B.user_id LEFT JOIN tab_rating C ON C.user_id=A.user_id WHERE A.job_id=? AND A.apply_status=1 GROUP BY C.user_id"

                mysql.connection.query(sql, [req.body.job_id], (err, list) => {
                    if (err) {
                        res.json({ status: 500, msg: "Internal server error.", err2: err })
                    } else if (list.length == 0) {
                        res.json({ status: 200, msg: "No Seeker's found.", data: [], count: null, job_detail: job_detail })
                    } else {

                        var d = list.filter(d => d.provider_acceptance == 1 || d.provider_acceptance == null)

                        async.forEachOf(d, (item, index) => {
                            mysql.connection.query('select * from tab_approve_seeker where seeker_id=? ORDER BY id DESC', [item.user_id], (err, result) => {
                                if (err) {
                                    console.log("Error found while seeker's job records.")
                                } else if (result.length == 0) {
                                    console.log("No data found.")
                                    item['total_job_complete'] = '';
                                    item['last_job_date'] = '';
                                    array.push(item);
                                } else {
                                    item['total_job_complete'] = result.length;
                                    item['last_job_date'] = result[0].created_at;
                                    array.push(item);
                                }
                            })
                        })

                        new Promise(resolve => {
                                setTimeout(() => {
                                    resolve(array);
                                }, 1000);
                            }).then((response) => {
                                var current_seeker = response.filter(d => d.provider_acceptance == 1);
                                res.json({ status: 200, msg: "Data found successfully.", data: response, count: response.length, current_seeker_lenght: current_seeker.length, job_detail: job_detail })
                            }).catch((error) => {
                                res.json({ status: 400, msg: "Something went wrong." })
                            })
                            // res.json({ status: 200, msg: "Successfully found number of people who accepeted this job.", data: list, count: list.length, job_detail: job_detail })
                    }
                })
            }
        })
    }
}



//================================== API for find number of users ========================================

const users = async(req, res) => {
    var user_id = req.decoded.user_id;
    mysql.connection.query('select * from tab_users', (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 404, msg: "No user found." })
        } else {
            var seeker = user.filter(d => d.role_id == 2);
            var provider = user.filter(d => d.role_id == 1);
            res.json({ status: 200, msg: "Successfully found data.", seeker: seeker.length, provider: provider.length })
        }
    })
}

//================================== API for find number of users ========================================

const recent_users = async(req, res) => {
    var user_id = req.decoded.user_id;

    mysql.connection.query('SELECT A.first_name,A.last_name,A.email,B.role,A.role_id,A.profile_pic,A.created_at FROM `tab_users` A LEFT JOIN tab_roles B ON B.role_id = A.role_id WHERE A.role_id!=3 ORDER BY A.user_id LIMIT 7', (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 404, msg: "No user found." })
        } else {
            res.json({ status: 200, msg: "Successfully found data.", data: user })
        }
    })
}


//==================================== API for job  ==================================

const jobs = async(req, res) => {

    var user_id = req.decoded.user_id;

    mysql.connection.query('select * from tab_jobs ', (err, list) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (list.length == 0) {
            res.json({ status: 404, msg: "No Jobs founded" })
        } else {
            var long_term_job = list.filter(d => d.job_type == 1);
            var work_now_job = list.filter(d => d.job_type == 0);
            res.json({ status: 200, msg: "Successfully found data.", long_term_job: long_term_job.length, work_now_job: work_now_job.length })
        }
    })
}


//=========================================== API for job seeker lists ==============================

const seeker_list = async(req, res) => {

    var user_id = req.decoded.user_id;

    new Promise((resolve, reject) => {

        // var sql = 'SELECT A.user_id,A.first_name,A.last_name,A.email,A.profile_pic,A.skill_id,A.skills,A.category_id,A.ssn,A.dob,A.distance,A.background_check,A.drug_test,A.role_id,B.role,A.isCompleteProfile,A.isEmailVerify,A.quiz_score,A.lat,A.lng,A.work_lat,A.work_lng,A.current_address,A.work_address,A.created_at FROM `tab_users` A LEFT JOIN tab_roles B ON A.role_id=B.role_id WHERE A.role_id=2';
        // var sql = "SELECT A.user_id As id,A.first_name,A.last_name,A.email,A.profile_pic,A.skill_id,A.skills,A.category_id,A.ssn,A.dob,A.distance, IF(A.background_check = 1 , 'checked','') AS background_check,IF(A.drug_test = 1 , 'checked','') AS drug_test, A.role_id, B.role,IF(A.isCompleteProfile = 1 , 'checked','') AS isCompleteProfile ,IF(A.isEmailVerify = 1 , 'checked','') AS isEmailVerify,A.quiz_score,A.lat,A.lng,A.work_lat,A.work_lng,A.current_address,A.work_address,A.created_at, IF(A.verify_account = 1 , 'checked','') AS verify_account,AVG(C.rating) AS rating FROM `tab_users` A LEFT JOIN tab_roles B ON A.role_id=B.role_id LEFT JOIN tab_rating C on C.user_id=A.user_id WHERE A.role_id=2 Order by A.user_id DESC";

        var sql = "SELECT A.user_id As id,A.first_name,A.last_name,A.email,A.profile_pic,A.skill_id,A.skills,A.category_id,A.ssn,A.dob,A.distance, IF(A.background_check = 1 , 'checked','') AS background_check,IF(A.drug_test = 1 , 'checked','') AS drug_test, A.role_id, B.role,IF(A.isCompleteProfile = 1 , 'checked','') AS isCompleteProfile ,IF(A.isEmailVerify = 1 , 'checked','') AS isEmailVerify,A.quiz_score,A.lat,A.lng,A.work_lat,A.work_lng,A.current_address,A.work_address,A.created_at, IF(A.verify_account = 1 , 'checked','') AS verify_account, IF(A.verify_account = 1 , 'Deactivate account','Activate account') AS account_status, ROUND(AVG(C.rating),0) AS rating FROM `tab_users` A LEFT JOIN tab_roles B ON A.role_id=B.role_id LEFT JOIN tab_rating C on C.user_id=A.user_id WHERE A.role_id=2 GROUP BY C.user_id,A.user_id Order by A.user_id DESC";

        mysql.connection.query(sql, (err, list) => {
            if (err) {
                reject({ status: 500, msg: "Internal server error." })
            } else if (list.length == 0) {
                reject({ status: 404, msg: "No seeker found.", data: [] })
            } else {
                resolve({ status: 200, msg: "Successfully data founded.", data: list })
            }
        })
    }).then((result) => {
        res.json(result);
    }).catch((error) => {
        res.json(error);
    })
}


//=========================== API for rate admin ========================

const rate_now = async(req, res) => {

    var admin_id = req.decoded.user_id;
    // const { user_id, rating } = req.body;

    mysql.connection.query('insert into tab_rating set user_id=?,provider_id=?,rating=?', [req.body.id, admin_id, req.body.rating], (err, save) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else {
            res.json({ status: 200, msg: "Successfully rated." })
        }
    })

}



//=========================================== API for job seeker lists ==============================

const provider_list = async(req, res) => {

    var user_id = req.decoded.user_id;

    new Promise((resolve, reject) => {


        var sql = "SELECT A.user_id As id,A.first_name,A.last_name,A.email,A.profile_pic,A.company_name,A.role_id,B.role,IF(A.isCompleteProfile = 1, 'true','false') AS isCompleteProfile,IF(A.isEmailVerify =1,'true','false') AS isEmailVerify,IF(A.invoice_permit =1,'checked','') AS invoice_permit,A.lat,A.lng,A.current_address,A.created_at,IF(A.verify_account =1,'checked','') AS verify_account, IF(A.verify_account = 1 , 'Deactivate account','Activate account') AS account_status, ROUND(AVG(C.rating),0) AS provider_rating FROM `tab_users` A LEFT JOIN tab_roles B ON B.role_id=A.role_id LEFT JOIN tab_rating C on C.user_id=A.user_id WHERE A.role_id=1 GROUP BY C.user_id,A.user_id Order by A.user_id DESC";

        mysql.connection.query(sql, (err, list) => {
            if (err) {
                reject({ status: 500, msg: "Internal server error." })
            } else if (list.length == 0) {
                reject({ status: 404, msg: "No provider found.", data: [] })
            } else {
                resolve({ status: 200, msg: "Successfully data founded.", data: list })
            }
        })
    }).then((result) => {
        res.json(result);
    }).catch((error) => {
        res.json(error);
    })
}


//======================= API for update seeker profile by admin ===========================

const upadte_seeker_profile = async(req, res) => {

    var admin_id = req.decoded.user_id;
    var user_id = req.body.id;
    const { first_name, last_name, ssn, dob, distance } = req.body;
    var email = req.body.email;

    var sql = 'select * from tab_users where user_id =? And role_id=3'
    mysql.connection.query(sql, [admin_id], (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 500, msg: "You are not authorized." })
        } else {
            mysql.connection.query('select * from tab_users where user_id=?', [user_id], (err, result) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (result.length == 0) {
                    res.json({ status: 500, msg: "No data found." })
                } else {
                    if (result[0].user_id && result[0].email == email) {
                        var sql1 = 'update tab_users set first_name=?,last_name=?,email=?,ssn=?,dob=?,distance=? where user_id=?'
                        mysql.connection.query(sql1, [first_name, last_name, email, ssn, dob, distance, user_id], (err, update_record) => {
                            if (err) {
                                res.json({ status: 500, msg: "Error found while update records." })
                            } else {
                                res.json({ status: 200, msg: "Successfully updated." })
                            }
                        })
                    } else {
                        mysql.connection.query('select * from tab_users where email=?', [email], (err, user_data) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error." })
                            } else if (user_data.length == 0) {
                                var sql2 = 'update tab_users set first_name=?,last_name=?,email=?,ssn=?,dob=?,distance=? where user_id=?'
                                mysql.connection.query(sql2, [first_name, last_name, email, ssn, dob, distance, user_id], (err, update_record) => {
                                    if (err) {
                                        res.json({ status: 500, msg: "Error found while update records." })
                                    } else {
                                        res.json({ status: 200, msg: "Successfully updated." })
                                    }
                                })

                            } else {
                                res.json({ status: 500, msg: "Email already exists." })
                            }
                        })
                    }
                }
            })
        }
    })





    // var sql = 'select * from tab_users where user_id =? And role_id=3'
    // mysql.connection.query(sql, [admin_id], (err, user) => {
    //     if (err) {
    //         res.json({ status: 500, msg: "Internal server error." })
    //     } else if (user.length == 0) {
    //         res.json({ status: 500, msg: "You are not authorized." })
    //     } else {
    //         var sql1 = 'update tab_users set first_name=?,last_name=?,ssn=?,dob=?,distance=? where user_id=?'

    //         mysql.connection.query(sql1, [first_name, last_name, ssn, dob, distance, user_id], (err, update_record) => {
    //             if (err) {
    //                 res.json({ status: 500, msg: "Error found while update records.", err: err })
    //             } else {
    //                 res.json({ status: 200, msg: "Successfully updated." })
    //             }
    //         })
    //     }
    // })
}


//=============================api for update profile =======================


const upadte_provider_profile = async(req, res) => {

    var admin_id = req.decoded.user_id;
    var user_id = req.body.id;
    const { first_name, last_name, company_name } = req.body;

    var email = req.body.email;

    var sql = 'select * from tab_users where user_id =? And role_id=3'
    mysql.connection.query(sql, [admin_id], (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 500, msg: "You are not authorized." })
        } else {
            mysql.connection.query('select * from tab_users where user_id=?', [user_id], (err, result) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (result.length == 0) {
                    res.json({ status: 500, msg: "No data found." })
                } else {
                    if (result[0].user_id && result[0].email == email) {
                        var sql1 = 'update tab_users set first_name=?,last_name=?,company_name=?,email=? where user_id=?'
                        mysql.connection.query(sql1, [first_name, last_name, company_name, email, user_id], (err, update_record) => {
                            if (err) {
                                res.json({ status: 500, msg: "Error found while update records." })
                            } else {
                                res.json({ status: 200, msg: "Successfully updated." })
                            }
                        })
                    } else {
                        mysql.connection.query('select * from tab_users where email=?', [email], (err, user_data) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error." })
                            } else if (user_data.length == 0) {
                                var sql2 = 'update tab_users set first_name=?,last_name=?,company_name=?,email=? where user_id=?'
                                mysql.connection.query(sql2, [first_name, last_name, company_name, email, user_id], (err, update_record) => {
                                    if (err) {
                                        res.json({ status: 500, msg: "Error found while update records." })
                                    } else {
                                        res.json({ status: 200, msg: "Successfully updated." })
                                    }
                                })
                            } else {
                                res.json({ status: 500, msg: "Email already exists." })
                            }
                        })
                    }
                }
            })
        }
    })
}

//=============================== DELETe user =========================

// const delete_seeker = async(req, res) => {

//     var admin_id = req.decoded.user_id;
//     var user_id = req.body.id;

//     var sql = 'Select * from tab_users where user_id =? and role_id=3'
//     mysql.connection.query(sql, [admin_id], (err, user) => {
//         if (err) {
//             res.json({ status: 500, msg: "Internal server error." })
//         } else if (user.length == 0) {
//             res.json({ status: 500, msg: "You are not authorized." })
//         } else {

//             var sql1 = 'Delete from tab_users where user_id =?'

//             mysql.connection.query(sql1, [user_id], (err, deleted) => {
//                 if (err) {
//                     res.json({ status: 500, msg: "Error found while permanent delete this records." })
//                 } else {

//                     var sql2 = 'Delete from tab_address where user_id =?'

//                     mysql.connection.query(sql2, [user_id], (err, deleted) => {
//                         if (err) {
//                             res.json({ status: 500, msg: "Error found while permanent delete this records." })
//                         } else {

//                             var sql3 = 'Delete from tab_approve_seeker where seeker_id =?'

//                             mysql.connection.query(sql3, [user_id], (err, deleted) => {
//                                 if (err) {
//                                     res.json({ status: 500, msg: "Error found while permanent delete this records." })
//                                 } else {

//                                     var sql4 = 'Delete from tab_booking where seeker_id =?'

//                                     mysql.connection.query(sql4, [user_id], (err, deleted) => {
//                                         if (err) {
//                                             res.json({ status: 500, msg: "Error found while permanent delete this records." })
//                                         } else {

//                                             var sql5 = 'Delete from tab_invoice where user_id =?'

//                                             mysql.connection.query(sql5, [user_id], (err, deleted) => {
//                                                 if (err) {
//                                                     res.json({ status: 500, msg: "Error found while permanent delete this records." })
//                                                 } else {

//                                                     var sql6 = 'Delete from tab_job_application_status where user_id =?'

//                                                     mysql.connection.query(sql6, [user_id], (err, deleted) => {
//                                                         if (err) {
//                                                             res.json({ status: 500, msg: "Error found while permanent delete this records." })
//                                                         } else {

//                                                             var sql7 = 'Delete from tab_job_apply where user_id =?'

//                                                             mysql.connection.query(sql7, [user_id], (err, deleted) => {
//                                                                 if (err) {
//                                                                     res.json({ status: 500, msg: "Error found while permanent delete this records." })
//                                                                 } else {

//                                                                     var sql8 = 'Delete from tab_log where user_id =?'

//                                                                     mysql.connection.query(sql8, [user_id], (err, deleted) => {
//                                                                         if (err) {
//                                                                             res.json({ status: 500, msg: "Error found while permanent delete this records." })
//                                                                         } else {

//                                                                             var sql9 = 'Delete from tab_log where user_id =?'

//                                                                         }
//                                                                     })

//                                                                 }
//                                                             })

//                                                         }
//                                                     })

//                                                 }
//                                             })
//                                         }
//                                     })
//                                 }
//                             })

//                         }
//                     })
//                 }
//             })
//         }
//     })
// }

const delete_user = async(req, res) => {

    var admin_id = req.decoded.user_id;
    var user_id = req.body.id;

    var sql = 'Select * from tab_users where user_id =? and role_id=3'
    mysql.connection.query(sql, [admin_id], (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 500, msg: "You are not authorized." })
        } else {
            mysql.connection.query('delete from tab_users where user_id=?', [user_id], (err, deleted) => {
                if (err) {
                    res.json({ status: 500, msg: "Error found while delete records permanentaly." })
                } else {
                    res.json({ status: 200, msg: "Successfully deleted." })
                }
            })
        }
    })
}


//================================= API for save steps ============================

const save_step = async(req, res) => {

    const { step, job_id, job_type } = req.body;
    var user_id = req.decoded.user_id;


    // work_now_job(manual)-- > Step 1
    // work_now_job(automatic)-- > Step 2
    // work_now_job(job journey)-- > Step 4
    // work_now_job(Approve screen)-- > Step 5
    // work_now_job(credit card screen)-- > Step 6
    // work_now_job(user Rating screen)-- > Step 7

    // Longterm_job-- > Step 3
    // Longterm_job(job journey)-- > Step 4
    // Longterm_job(Approve screen)-- > Step 5
    // Longterm_job(credit card screen)-- > Step 6
    // Longterm_job(userRating screen)-- > Step 7

    await stepSave();

    function stepSave() {

        mysql.connection.query('update tab_users set step=?, job_id=?,job_type=? where user_id=?', [step, job_id, job_type, user_id], (err, updated) => {
            if (err) {
                res.json({ status: 500, msg: "Error found while update steps." })
            } else {
                res.json({ status: 200, msg: "Successfully updated." })
            }
        })

    }
}


//================================ Account block (seeker) in case when they not present at 3 times to completed the jobs======================

cron.schedule('*/2 * * * *', () => {
        // console.log('running a task every two minutes');

        mysql.connection.query('update tab_users set account_status=? where change_user>=3', [0], (err, account_blcok) => {
            if (err) {
                console.log('Error found while account blocked.');
            } else {
                console.log('Successfully blocked the account.');
            }
        })
    })
    //============================== Invoice permit ===========================


//================================== Api for long term job(Admin)============================

const long_term_job_list = async(req, res) => {

    var admin_id = req.decoded.user_id;

    var array = [];
    var sql = 'select * from tab_users where user_id =? And role_id=3'
    mysql.connection.query(sql, [admin_id], (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 500, msg: "You are not authorized." })
        } else {
            // var sql1 ="select A.job_id,A.user_id,A.location,A.category,A.lat,A.lng,A.job_title,A.job_type,A.posted_date,A.hourly_rate,A.address,A.no_of_opening,A.visibility,A.booking_status,A.isCompleted,A.created_at,IF(A.visibility = 1, 'Active','Expire') As job_visibility,IF(A.isCompleted = 1,'Running', 'Completed') As job_status, B.id As skill_id,B.skill,C.first_name,C.last_name,C.role_id,C.profile_pic,C.company_name from tab_jobs A LEFT JOIN tab_skills B ON A.category=B.id LEFT JOIN tab_users C ON A.user_id=C.user_id where A.job_type=0 Order By A.job_id DESC";
            var sql1 = "Select A.job_id,A.user_id,A.location,A.category,A.lat,A.lng,A.job_title,A.job_type,A.posted_date,A.hourly_rate,A.address,A.no_of_opening,A.visibility,A.booking_status,A.isCompleted,A.created_at,IF(A.visibility = 1, 'Active','Expire') As job_visibility,IF(A.isCompleted = 1,'Running', 'Completed') As job_status, B.id As skill_id,B.skill,C.first_name,C.last_name,C.role_id,C.profile_pic,C.company_name,SUM(D.hour) AS total_hour,SUM(D.minute) AS total_minute,SUM(D.pay_scale) As total_payment,IF(A.payment_status = 1, 'Success','Pending') AS payment_status,A.payment from tab_jobs A LEFT JOIN tab_skills B ON A.category=B.id LEFT JOIN tab_users C ON A.user_id=C.user_id LEFT JOIN tab_log D ON D.job_id=A.job_id where A.job_type=0 GROUP BY A.job_id DESC"
            mysql.connection.query(sql1, (err, job) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (job.length == 0) {
                    res.json({ status: 500, msg: "No jobs found." })
                } else {
                    async.forEachOf(job, (item, index) => {
                        var job_id = item.job_id;
                        mysql.connection.query('SELECT A.job_id,A.user_id,B.first_name,B.last_name,B.profile_pic,SUM(A.hour) AS total_hour,SUM(A.minute) AS total_minute,SUM(A.pay_scale) AS total_payment FROM tab_log A LEFT JOIN tab_users B ON B.user_id=A.user_id WHERE A.job_id =? GROUP BY A.user_id', [job_id], (err, result) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error." })
                            } else {
                                var seeker = [];
                                for (var i = 0; i < result.length; i++) {
                                    seeker.push(result[i].first_name + " " + result[i].last_name + " - " + result[i].total_hour + "hr" + result[i].total_minute + "min")
                                }
                                item['seeker'] = seeker;
                                array.push(item);
                            }
                        })
                    })

                    new Promise(resolve => {
                            setTimeout(() => {
                                resolve(array);
                            }, 1000);
                        }).then((response) => {
                            res.json({ status: 200, msg: "Data found successfully.", data: response })
                        }).catch((error) => {
                            res.json({ status: 500, msg: "Error found" })
                        })
                        // res.json({ status: 200, msg: "Data found successfully.", data: value })
                }
            })
        }
    })
}


//================================ API for work now job (Admin) =============================

const work_now_job_list = async(req, res) => {

    var admin_id = req.decoded.user_id;
    var array = [];

    var sql = 'select * from tab_users where user_id =? And role_id=3'
    mysql.connection.query(sql, [admin_id], (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 500, msg: "You are not authorized." })
        } else {
            // var sql1 = "select A.*,IF(A.visibility = 1, 'Active','Expire') As job_visibility,IF(A.isCompleted = 1,'Running', 'Completed') As job_status, B.id As skill_id,B.skill,C.first_name,C.last_name,C.role_id,C.profile_pic,C.company_name,SUM(D.hour) AS total_hour,SUM(D.minute) AS total_minute,SUM(D.pay_scale) As payment from tab_jobs A LEFT JOIN tab_skills B ON A.category=B.id LEFT JOIN tab_users C ON A.user_id=C.user_id LEFT JOIN tab_log D ON D.job_id=A.job_id where A.job_type=1 GROUP BY A.job_id DESC";

            // var sql1 = "Select A.*,IF(A.visibility = 1, 'Active','Expire') As job_visibility,IF(A.isCompleted = 1,'Running', 'Completed') As job_status, B.id As skill_id,B.skill,C.first_name,C.last_name,C.role_id,C.profile_pic,C.company_name,SUM(D.hour) AS total_hour,SUM(D.minute) AS total_minute,SUM(D.pay_scale) As total_payment,IF(A.payment_status = 1, 'Success','Pending') AS payment_status,A.payment from tab_jobs A LEFT JOIN tab_skills B ON A.category=B.id LEFT JOIN tab_users C ON A.user_id=C.user_id LEFT JOIN tab_log D ON D.job_id=A.job_id where A.job_type=1 GROUP BY A.job_id DESC";

            var sql1 = "Select A.*,IF(A.visibility = 1, 'Active','Expire') As job_visibility,IF(A.isCompleted = 1,'Running', 'Completed') As job_status, B.id As skill_id,B.skill,C.first_name,C.last_name,C.role_id,C.profile_pic,C.company_name,SUM(D.hour) AS total_hour,SUM(D.minute) AS total_minute,SUM(D.pay_scale) As total_payment,IF(A.payment_status = 1, 'Success','Pending') AS payment_status,A.payment from tab_jobs A LEFT JOIN tab_skills B ON A.category=B.id LEFT JOIN tab_users C ON A.user_id=C.user_id LEFT JOIN tab_approve_seeker D ON D.job_id=A.job_id where A.job_type=1 GROUP BY A.job_id DESC";

            mysql.connection.query(sql1, (err, job) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (job.length == 0) {
                    res.json({ status: 500, msg: "No jobs found." })
                } else {
                    // res.json({ status: 200, msg: "Data found successfully.", data: job })
                    async.forEachOf(job, (item, index) => {
                        var job_id = item.job_id;
                        // mysql.connection.query('SELECT A.job_id,A.user_id,B.first_name,B.last_name,B.profile_pic,SUM(A.hour) AS total_hour,SUM(A.minute) AS total_minute,SUM(A.pay_scale) AS total_payment FROM tab_log A LEFT JOIN tab_users B ON B.user_id=A.user_id WHERE A.job_id =? GROUP BY A.user_id', [job_id], (err, result) => {
                        mysql.connection.query('SELECT A.job_id,A.seeker_id,B.first_name,B.last_name,B.profile_pic,SUM(A.hour) AS total_hour,SUM(A.minute) AS total_minute,SUM(A.pay_scale) AS total_payment, SUM(A.approval_hour) AS approval_hour, SUM(A.approval_min) AS approval_min, SUM(A.approval_payment) AS approval_payment FROM tab_approve_seeker A LEFT JOIN tab_users B ON B.user_id=A.seeker_id WHERE A.job_id =? GROUP BY A.seeker_id', [job_id], (err, result) => {
                            if (err) {
                                // res.json({ status: 500, msg: "Internal server error." })
                                console.log("Internal server error.")
                            } else {
                                var seeker = [];
                                for (var i = 0; i < result.length; i++) {
                                    seeker.push(result[i].first_name + " " + result[i].last_name + " - " + result[i].total_hour + "hr" + result[i].total_minute + "min")
                                }

                                item['seeker'] = seeker;
                                array.push(item);
                            }
                        })
                    })

                    new Promise(resolve => {
                        setTimeout(() => {
                            resolve(array);
                        }, 1000);
                    }).then((response) => {
                        res.json({ status: 200, msg: "Data found successfully.", data: response })
                    }).catch((error) => {
                        res.json({ status: 500, msg: "Error found" })
                    })
                }
            })
        }
    })
}


//===================== Delete job Admin ================================


const delete_job = async(req, res) => {

    const { job_id } = req.body;
    var user_id = req.decoded.user_id;

    await removeJobPosts();

    function removeJobPosts() {

        mysql.connection.query('Select * from tab_users where role_id=? And user_id=?', [3, user_id], (err, user) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (user.length == 0) {
                res.json({ status: 500, msg: "You are not authorized." })
            } else {
                mysql.connection.query('delete from tab_jobs where job_id =?', [job_id], (err, result) => {
                    if (err) {
                        res.json({ status: 500, msg: "Internal server error." })
                    } else {
                        res.json({ status: 200, msg: "Job post has been deleted successfully." })
                    }
                })
            }
        })
    }
}

//========================= API for skills with their category (admin panel)====================

const skill_category = async(req, res) => {

    var array = [];

    mysql.connection.query("select A.id,A.skill,A.parent_id,A.created_at,IF(A.status = 1 , 'checked','') As status from tab_skills A where A.parent_id=0", (err, skill) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (skill.length == 0) {
            res.json({ status: 500, msg: "No data found." })
        } else {
            async.forEachOf(skill, (item, index) => {
                mysql.connection.query('select * from tab_skills where parent_id=?', [item.id], (err, list) => {
                    if (err) {
                        console.log("Error found.")
                    } else if (list.length == 0) {
                        console.log("No data found.")
                        item['subskill'] = '';
                        array.push(item);
                    } else {
                        var category = [];
                        for (var i = 0; i < list.length; i++) {
                            category.push(list[i].skill)
                        }
                        item['subskill'] = category;
                        array.push(item);
                    }
                })
            })
            new Promise(resolve => {
                setTimeout(() => {
                    resolve(array);
                }, 1000);
            }).then((response) => {
                res.json({ status: 200, msg: "Data found successfully.", data: response })
            }).catch((error) => {
                res.json({ status: 500, msg: "Error found" })
            })
        }
    })
}


//================================== API for skill category(Admin panel) ================

const category_skill = async(req, res) => {

    var array = [];
    var obj;
    mysql.connection.query('select * from tab_skills where parent_id=0', (err, skill) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (skill.length == 0) {
            res.json({ status: 500, msg: "No data found." })
        } else {

            obj = {
                "skill": "Other"
            };

            skill[''] = obj;
            array.push(skill);
            res.json({ status: 200, msg: "Successfully found data.", data: array })
        }
    })
}


//========================= sub category skill(admin) ==========================

const sub_category_skill = async(req, res) => {

    var array = [];
    mysql.connection.query("SELECT A.id,A.skill,A.parent_id,A.created_at,IF(A.status =1, 'checked','') As status FROM `tab_skills` A WHERE A.parent_id !=0 Order by A.id desc", (err, list) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (list.length == 0) {
            res.json({ status: 500, msg: "No data found." })
        } else {
            async.forEachOf(list, (item, index) => {
                mysql.connection.query('select * from `tab_skills` where id=?', [item.parent_id], (err, result) => {
                    if (err) {
                        console.log("Error found.")
                    } else if (result.length == 0) {
                        console.log("No data found")
                    } else {
                        item['category'] = result[0].skill
                        array.push(item);
                    }
                })
            })

            new Promise(resolve => {
                setTimeout(() => {
                    resolve(array);
                }, 1000);
            }).then((response) => {
                res.json({ status: 200, msg: "Data found successfully.", data: response })
            }).catch((error) => {
                res.json({ status: 500, msg: "Error found" })
            })
        }
    })
}

//=========================== add sub category Admin) ===========================

const add_sub_category = async(req, res) => {

    var sub_category = req.body.sub_category;
    var category_id = req.body.category_id;

    var name = sub_category.toUpperCase() || sub_category.toLowerCase() || sub_category;

    mysql.connection.query('select * from tab_skills where skill=? And parent_id=?', [name, category_id], (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (result.length > 0) {
            res.json({ status: 500, msg: "Already exists subcategory." })
        } else {
            mysql.connection.query('Insert into tab_skills set skill=?,parent_id=?', [sub_category, category_id], (err, insertData) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else {
                    res.json({ status: 200, msg: "Successfully added subcategory." })
                }
            })
        }
    })
}


//===================== API for update skill subcategory(admin) ==========================

const update_subcategory = async(req, res) => {

    const { id, sub_category } = req.body;

    mysql.connection.query('update tab_skills set skill=? where id=?', [sub_category, id], (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else {
            res.json({ status: 200, msg: "Successfully updated." })
        }
    })
}

//====================== update skill category (admin penel) =============


const update_skill_category = async(req, res) => {

    var category_id = req.body.category_id;
    var skill_name = req.body.skill_name;

    var name = skill_name.toUpperCase() || skill_name.toLowerCase() || skill_name


    await addSkill();

    function addSkill() {
        if (!skill_name) {
            res.json({ status: 422, msg: "Skill name is required." })
        } else {
            mysql.connection.query('select * from tab_skills where skill=?', [name], (err, skill) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })

                } else if (skill.length == 0) {
                    mysql.connection.query('update tab_skills set skill=? where id=?', [name, category_id], (err, result) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else {
                            res.json({ status: 200, msg: "Successfully updated." })
                        }
                    })
                } else if (skill.length > 0) {

                    if (skill[0].id == category_id && skill[0].skill == name && skill[0].parent_id == 0) {
                        res.json({ status: 200, msg: "Successfully updated." })
                    } else {
                        res.json({ status: 500, msg: "Already exist categoty." })
                    }
                }
            })
        }
    }
}


//=====================Api for change status(active/deactive skill category/subcategory)====================

const update_skill_status = async(req, res) => {

    const { id, status } = req.body;
    //status  0 --> Deactive , 1--> Active

    mysql.connection.query('Update tab_skills set status=? where id=?', [status, id], (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else {
            res.json({ status: 200, msg: "Successfully change status" })
        }
    })
}

//============================ Show invoive details(Admin panel) ========================

const invoice_detail = async(req, res) => {

    var admin_id = req.decoded.user_id;

    mysql.connection.query('select * from tab_users where user_id=? And role_id=?', [admin_id, 3], (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 500, msg: "You are not authorized." })
        } else {
            var sql = "SELECT A.*,B.first_name,B.last_name,B.profile_pic,SUM(C.hour) AS total_hour,SUM(C.minute) AS total_minute,SUM(C.pay_scale) payment,COUNT(C.id) As total_seeker FROM `tab_invoice` A LEFT JOIN tab_users B ON B.user_id=A.user_id LEFT JOIN tab_approve_seeker C ON C.job_id= A.job_id GROUP BY C.job_id Order By A.id DESC"
            mysql.connection.query(sql, (err, list) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (list.length == 0) {
                    res.json({ status: 500, msg: "No data found." })
                } else {
                    res.json({ status: 200, msg: "Data found successfully.", data: list })
                }
            })
        }
    })
}


//=====================API for update admin profile =====================

const update_admin_profile = async(req, res) => {

    var admin_id = req.decoded.user_id;

    const { first_name, last_name } = req.body;

    mysql.connection.query('select * from tab_users where user_id=? And role_id=?', [admin_id, 3], (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 500, msg: "You are not authorized." })
        } else {
            mysql.connection.query("Update tab_users set first_name=?,last_name=? where user_id=?", [first_name, last_name, admin_id], (err, update_data) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else {
                    res.json({ status: 200, msg: "Successfully updated." })
                }
            })
        }
    })
}


//========================= API for invoice permision to provider =================

const invoice_permit = async(req, res) => {

    mysql.connection.query('update tab_users set invoice_permit=? where user_id=?', [req.body.status, req.body.user_id], (err, update_data) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else {
            res.json({ status: 200, msg: "Successfully checked invoice permit" });
        }
    })
}


//========================= API for invoice permision to provider =================

const verifyAccount = async(req, res) => {

    mysql.connection.query('update tab_users set verify_account=? where user_id=?', [req.body.status, req.body.user_id], (err, update_data) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else {
            res.json({ status: 200, msg: "Successfully verify account" });
        }
    })
}

//======================= API for select Seeker(admin) ===================

const seekers = (req, res) => {

    var sql = "SELECT user_id AS id, CONCAT(first_name , ' ' , last_name ) AS itemName,CONCAT(first_name , ' ' , last_name ) AS name FROM `tab_users` WHERE role_id=2";
    var admin_id = req.decoded.user_id;

    mysql.connection.query('select * from tab_users where user_id=? And role_id=?', [admin_id, 3], (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 500, msg: "You are not authorized." })
        } else {
            mysql.connection.query(sql, (err, list) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (list.length == 0) {
                    res.json({ status: 500, msg: "No seeker founded." })
                } else {
                    res.json({ status: 200, msg: "Data found successfully.", data: list })
                }
            })
        }
    })
}


//======================= API for select provider(admin) ===================

const providers = (req, res) => {
    var sql = "SELECT user_id AS id, CONCAT(first_name , ' ' , last_name ) AS itemName,CONCAT(first_name , ' ' , last_name ) AS name FROM `tab_users` WHERE role_id=1";
    var admin_id = req.decoded.user_id;
    mysql.connection.query('select * from tab_users where user_id=? And role_id=?', [admin_id, 3], (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 500, msg: "You are not authorized." })
        } else {
            mysql.connection.query(sql, (err, list) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (list.length == 0) {
                    res.json({ status: 500, msg: "No seeker founded." })
                } else {
                    res.json({ status: 200, msg: "Data found successfully.", data: list })
                }
            })
        }
    })
}

//=========================APi for send notifications(Admin) ===================================

const send_notification = async(req, res) => {

    const { title, message, user_array } = req.body;
    // console.log("req.body ===>", req.body);
    if (user_array.length == 0) {
        res.json({ status: 500, msg: "Atleast one user is required." })
    } else {

        var admin_id = req.decoded.user_id;
        mysql.connection.query('select * from tab_users where user_id=? And role_id=?', [admin_id, 3], (err, user) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (user.length == 0) {
                res.json({ status: 500, msg: "You are not authorized." })
            } else {

                for (var i = 0; i < user_array.length; i++) {
                    mysql.connection.query('select * from tab_users where user_id=?', [user_array[i].id], (err, user) => {
                        if (err) {
                            console.log("Internal server error.")
                        } else if (user.length == 0) {
                            console.log("User not found.")
                        } else {
                            var device_token = user[0].device_token;
                            var userId = user[0].user_id;
                            var RoleId = user[0].role_id;
                            var Id = admin_id.toString();

                            var data = { //data 
                                "sender_id": Id, //seeker provider user id
                                "receiver_id": userId.toString(),
                                "role_id": RoleId.toString(),
                                "isCompleted": "1"
                            }
                            common_function.send_push_notification(device_token, title, message, data);
                            mysql.connection.query('Insert into tab_notification set sender_id=?,user_id=?,title=?,message=?,status=?', [admin_id, user[0].user_id, title, message, 2], (err, save_notification) => {
                                if (err) {
                                    console.log("Error found while save notification")
                                } else {
                                    console.log("Successfully save notification");
                                }
                            })
                        }
                    })
                }
                res.json({ status: 200, msg: "Successfully sent notification." })
            }
        })
    }
}


//=========================APi for send notifications(Admin) ===================================

const send_email = async(req, res) => {

    const { title, message, user_array } = req.body;
    console.log("req.body ===>", req.body);
    if (user_array.length == 0) {
        res.json({ status: 500, msg: "Atleast one user is required." })
    } else {
        var admin_id = req.decoded.user_id;
        mysql.connection.query('select * from tab_users where user_id=? And role_id=?', [admin_id, 3], (err, user) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (user.length == 0) {
                res.json({ status: 500, msg: "You are not authorized." })
            } else {
                for (var i = 0; i < user_array.length; i++) {
                    mysql.connection.query('select * from tab_users where user_id=?', [user_array[i].id], (err, user) => {
                        if (err) {
                            console.log("Internal server error.")
                        } else if (user.length == 0) {
                            console.log("User not found.")
                        } else {
                            var email = user[0].email;
                            console.log("email ===>", email);
                            let msg = `<p>${message}</p>`
                            msg += '<div><p>Sincerely,</p><br><p>Rock Staffing Team</p></div>'
                            common_function.sendEmail(email, title, message, msg); //send message on registerd email address
                        }
                    })
                }
                res.json({ status: 200, msg: "Successfully sent email." })
            }
        })
    }
}

//=============================== API for add users =====================================

const add_user = async(req, res) => {
    const { first_name, last_name, email, password, role } = req.body;
    mysql.connection.query('select * from tab_users where email =?', [email], (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length > 0) {
            res.json({ status: 500, msg: "Email already exist." })
        } else {
            const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
            var code = common_function.getCode();
            var profile_pic = "https://img2.pngio.com/united-states-avatar-organization-information-png-512x512px-user-avatar-png-820_512.jpg";
            mysql.connection.query('insert into tab_users SET first_name =?,last_name =?,email =?, password =?,role_id =?,verification_code=?,profile_pic=?', [first_name, last_name, email, hash, role, code, profile_pic], (err, save_data) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", err: err })
                } else {
                    var link = `http://178.62.83.145:2000/api/v1/verifyLink/${save_data.insertId}/${code}`;
                    let msg = '<div>Dear ' + first_name + ' ' + last_name + ',';
                    msg += '<p>Thank you for downloading the ReadyStaff job app. We hope you have a great experience and recommend us to your friends and family.</p><br></div>';
                    msg += '<div><p>Please verify your Email by given below link.</p></div>';
                    msg += `${link}`;
                    msg += '<div><p>Sincerely,</p><br><p>Rock Staffing Team</p></div>'
                    common_function.sendEmail(email, 'Rock staffing : Verify Email', 'Rock staffing', msg); //send message on registerd email address
                }
                res.json({ status: 200, msg: "Successfully register." })
            })
        }
    })
}


//============================ API for show notification(Admin) =========================

const show_notification = async(req, res) => {

    // var sql = "SELECT A.id,A.sender_id,A.user_id , CONCAT(B.first_name , ' ' , B.last_name ) AS reciever_name ,A.message,A.title,A.created_date FROM `tab_notification` A LEFT JOIN tab_users B ON A.user_id=B.user_id WHERE A.sender_id =? ORDER BY A.`id` DESC"

    var sql = "SELECT A.id,A.sender_id,A.user_id ,C.role, CONCAT(B.first_name , ' ' , B.last_name ) AS reciever_name ,A.message,A.title,A.created_date FROM `tab_notification` A LEFT JOIN tab_users B ON A.user_id=B.user_id LEFT JOIN tab_roles C ON C.role_id=B.role_id WHERE A.sender_id =? ORDER BY A.`id` DESC"

    var admin_id = req.decoded.user_id;
    mysql.connection.query('select * from tab_users where user_id=? And role_id=?', [admin_id, 3], (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 500, msg: "You are not authorized." })
        } else {
            mysql.connection.query(sql, [admin_id], (err, list) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (list.length == 0) {
                    res.json({ status: 500, msg: "No data found." })
                } else {
                    res.json({ status: 200, msg: "Data founded.", data: list })
                }
            })
        }
    })
}

//============================== Generate invoice =====================================

const generate_invoice = async(req, res) => {

    // const provider_id = req.decoded.user_id;

    const { job_id, provider_id } = req.body;

    var sql = 'SELECT A.*,B.first_name,B.last_name,C.name,C.addressline1,C.addressline2,C.city,C.state,C.zipcode,C.zone FROM `tab_jobs` A LEFT JOIN tab_users B ON B.user_id = A.user_id LEFT JOIN tab_address C ON C.id=A.address WHERE A.job_id=? AND A.user_id=?'

    mysql.connection.query(sql, [job_id, provider_id], (err, job) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (job.length == 0) {
            res.json({ status: 500, msg: "No data found." })
        } else {
            var sql2 = 'SELECT SUM(pay_scale) As total_payment FROM `tab_log` WHERE job_id=? ORDER BY job_id'
            mysql.connection.query(sql2, [job_id], (err, total_pay_scale) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else {
                    var sql1 = 'SELECT A.job_id,A.user_id,B.first_name,B.last_name,B.profile_pic,SUM(A.hour) AS total_hour,SUM(A.minute) AS total_minute ,SUM(A.pay_scale) AS total_payment FROM tab_log A LEFT JOIN tab_users B ON B.user_id=A.user_id WHERE A.job_id =? GROUP BY A.user_id'
                    mysql.connection.query(sql1, [job_id], (err, time_log) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else if (time_log.length == 0) {
                            res.json({ status: 500, msg: "No data found." })
                        } else {
                            res.json({ status: 200, msg: "Successfully founded data.", total_pay_scale: total_pay_scale, job: job, data: time_log })
                        }
                    })
                }
            })
        }
    })
}


//======================================== API for start job (clock In) ============================

const start_clock_in = async(req, res) => {

    const { job_id } = req.body;
    const user_id = req.decoded.user_id;
    // console.log("clock in ====>");

    // console.log("req.body ====>", req.body);

    // check job is running or not

    // mysql.connection.query('select * from tab_jobs where job_id=?', [job_id], (err, result) => {
    //     if (err) {
    //         res.json({ status: 500, msg: "Internal server error." })
    //     }
    //     else if (result.length == 0) {
    //         res.json({ status: 500, msg: "No job founded.", data: [] })
    //     }
    //     else if (result[0].isCompleted == 0) {
    //         res.json({ status: 500, msg: "This job is closed.", data: [] })
    //     }
    //     else {
    // //     }
    // // })
    var sql = "select A.job_id,A.user_id,A.isCompleted, E.device_token As provider_device_token ,C.skill,A.location,A.lat,A.lng,A.job_title,A.job_type,A.hourly_rate,A.start_date,B.first_name,B.last_name,B.device_token,B.role_id,D.user_id as seeker_id,D.first_name as seeker_first_name,D.last_name as seeker_last_name,D.device_token as seeker_device_token from tab_jobs A Left join tab_users B ON B.user_id=A.user_id LEFT JOIN tab_skills C ON C.id=A.category LEFT JOIN tab_users D ON D.user_id=? LEFT JOIN tab_users E ON E.user_id=A.user_id where A.job_id =?"

    mysql.connection.query(sql, [user_id, job_id], (err, job) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error" })
        } else if (job.length == 0) {
            res.json({ status: 500, msg: "No job found" })
        } else if (job[0].isCompleted == 0) {
            res.json({ status: 500, msg: "This job is closed.", data: [] })
        } else {
            // 19 NOv 2020
            // start job (status = 2) for progress bar
            var query = 'update tab_users set progress_bar_status=?,progress_bar_job_id=? where user_id=?';
            mysql.connection.query(query, [2, job_id, user_id], (err, update_progress_bar) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else {
                    console.log("Query ===>", query);

                    var title = `${job[0].seeker_first_name} ${job[0].seeker_last_name} has started doing ${job[0].job_title} job.`
                    var text = `${job[0].job_title}`;

                    var userId = job[0].user_id;
                    var RoleId = job[0].role_id;

                    var data = { //data
                        // "job_id": job_id.toString(), //job_id
                        // "sender_id": job[0].seeker_id, //seeker userid
                        // "receiver_id": userId.toString(),
                        // "role_id": RoleId.toString(),
                        "isCompleted": "1"
                    }

                    console.log("job ===>", job);

                    common_function.send_push_notification(job[0].provider_device_token, title, text, data);

                    var start_date = new Date();
                    // start_date = start_date.toISOString();

                    // var end_date = new Date();
                    // end_date = date.toISOString();

                    mysql.connection.query('INSERT into tab_clock_in_clock_out set user_id=?,job_id=?,isStart=?,start_date=?', [user_id, job_id, 1, start_date], (err, start_clock_in) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", err: err })
                        } else {
                            mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,status=?', [job_id, job[0].user_id, title, job[0].lat, job[0].lng, job[0].job_type, 2], (err, save_notification) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error.", err: err })
                                } else {
                                    var query = 'update tab_users set progress_bar_status=?,progress_bar_job_id=? where user_id=?';
                                    mysql.connection.query(query, [2, job_id, job[0].user_id], (err, update_progress_bar) => {
                                            if (err) {
                                                res.json({ status: 500, msg: "Internal server error." })
                                            } else {
                                                res.json({ status: 200, msg: "Successfully start the job." })

                                            }
                                        })
                                        // res.json({ status: 200, msg: "Successfully start the job." })
                                }
                            })
                        }
                    })
                }
            })
        }
    })

    // }
    // })
}

//================================= API for view provider or seeker profile =====================

const view_profile = async(req, res) => {

    const { token } = req.decoded.user_id;
    const userid = req.body.userid;

    mysql.connection.query('select * from tab_users where user_id =?', [userid], (err, user) => {

        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 500, msg: "No user found." })
        } else {
            res.json({ status: 200, msg: "Data found successfully.", data: user })
        }
    })
}

//============================== API for get url (contactus and about us) ==========================

const get_url = async(req, res) => {
    const { user_id } = req.decoded.user_id;
    mysql.connection.query('select * from tab_url', (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (result.length == 0) {
            res.json({ status: 500, msg: "No url founds." })
        } else {
            res.json({ status: 200, msg: "Successfully founded urls.", data: result })
        }
    })
}

//============================ API for update contact us url ==========================

const update_url = async(req, res) => {

    const { contactus_url, aboutus_url, id } = req.body;
    const user_id = req.decoded.user_id;

    if (contactus_url) {
        mysql.connection.query('update tab_url set contactus=? where id=?', [contactus_url, id], (err, updated) => {
            if (err) {
                res.json({ status: 500, msg: "Error found while update url." })
            } else {
                res.json({ status: 200, msg: "Successfully updated." })
            }
        })
    } else if (aboutus_url) {
        mysql.connection.query('update tab_url set aboutus=? where id=?', [aboutus_url, id], (err, updated) => {
            if (err) {
                res.json({ status: 500, msg: "Error found while update url." })
            } else {
                res.json({ status: 200, msg: "Successfully updated." })
            }
        })
    } else {
        res.json({ status: 500, msg: "URL is required." })
    }
}



//=================================== API for provider_jobs(provider jobs calender) =============================


const job_calender = async(req, res) => {

    var user_id = req.decoded.user_id;

    var sql = "SELECT A.user_id, A.job_id,A.job_title,A.job_type,A.start_date,A.start_time,A.end_date,A.end_time,B.skill,C.first_name,C.last_name FROM tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category LEFT JOIN tab_users C ON C.user_id=A.user_id WHERE A.user_id=?"

    mysql.connection.query(sql, [user_id], (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (result.length == 0) {
            res.json({ status: 500, msg: "No calender job founds." })
        } else {

            var array = [];
            async.forEachOf(result, (item, index) => {
                var format_date = moment(item.start_date, 'MM/DD/YYYY').add(0, 'day')
                var obj = {
                    "user_id": item.user_id,
                    "job_id": item.job_id,
                    "job_title": item.job_title,
                    "job_type": item.job_type,
                    "start_date": item.start_date,
                    "format_start_date": moment(item.start_date, 'MM/DD/YYYY').add(0, 'day'),
                    "start_time": item.start_time,
                    "end_date": item.end_date,
                    "format_end_date": moment(item.end_date, 'MM/DD/YYYY').add(0, 'day'),
                    "end_time": item.end_time,
                    "skill": item.skill,
                    "first_name": item.first_name,
                    "last_name": item.last_name,
                    "created_at": format_date
                };
                array.push(obj);
            })
            new Promise((resolve) => {
                setTimeout(() => {
                    resolve(array)
                }, 1000)
            }).then((response) => {
                res.json({ status: 200, msg: "Successfully founded job calender.", data: response })
            }).catch((error) => {
                res.json({ status: 500, msg: "Something went wrong.", error: error })
            })

            // res.json({ status: 200, msg: "Successfully data founded.", data: result });
        }
    })
}

//============================== API for job calender (seeker) =================================

const seeker_job_calender1 = async(req, res) => {
    var seeker_id = req.decoded.user_id;

    var sql = 'SELECT * FROM `tab_approve_seeker` WHERE seeker_id=?'
        // var sql = "SELECT *,FORMAT(DATE(created_at),'MM/dd/yyyy') AS date FROM tab_approve_seeker WHERE seeker_id=?"
    mysql.connection.query(sql, [seeker_id], (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (result.length == 0) {
            res.json({ status: 500, msg: "No job calender founded.", data: [] })
        } else {
            var array = [];
            async.forEachOf(result, (item, index) => {
                // 20 Nov 2020
                var d = new Date(item.created_at);
                var datestring = ("0" + (d.getMonth() + 1)).slice(-2) + "/" + ("0" + d.getDate()).slice(-2) + "/" + d.getFullYear();
                mysql.connection.query('select * from tab_jobs where job_id=?', [item.job_id], (err, job) => {
                    if (err) {
                        console.log('Error found while get job details.');
                    } else if (job.length == 0) {
                        console.log('No job details.');
                    } else {
                        var obj = {
                            "id": item.id,
                            "job_id": item.job_id,
                            "provider_id": item.provider_id,
                            "seeker_id": item.seeker_id,
                            "hour": item.hour,
                            "approval_hour": item.approval_hour,
                            "approval_min": item.approval_min,
                            "approval_payment": item.approval_payment,
                            "minute": item.minute,
                            "pay_scale": item.pay_scale,
                            "day": item.day,
                            "created_at": item.created_at,
                            "start_date": datestring,
                            "format_start_date": moment(job[0].start_date, 'MM/DD/YYYY').add(0, 'day'),
                            "format_end_date": moment(job[0].end_date, 'MM/DD/YYYY').add(0, 'day')
                        };
                        array.push(obj);
                    }
                })
            })

            new Promise((resolve) => {
                setTimeout(() => {
                    resolve(array)
                }, 1000)
            }).then((response) => {
                res.json({ status: 200, msg: "Successfully founded job calender.", data: response })
            }).catch((error) => {
                res.json({ status: 500, msg: "Something went wrong.", error: error })
            })
        }
    })
}







const seeker_job_calender = async(req, res) => {
    var seeker_id = req.decoded.user_id;

    var sql = 'SELECT * FROM `tab_booking` WHERE seeker_id=?'
    mysql.connection.query(sql, [seeker_id], (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (result.length == 0) {
            res.json({ status: 500, msg: "No job calender founded.", data: [] })
        } else {
            var array = [];
            async.forEachOf(result, (item, index) => {
                // 20 Nov 2020
                var d = new Date(item.created_at);
                var datestring = ("0" + (d.getMonth() + 1)).slice(-2) + "/" + ("0" + d.getDate()).slice(-2) + "/" + d.getFullYear();
                mysql.connection.query('select * from tab_jobs where job_id=?', [item.job_id], (err, job) => {
                    if (err) {
                        console.log('Error found while get job details.');
                    } else if (job.length == 0) {
                        console.log('No job details.');
                    } else {
                        var obj = {
                            "id": item.id,
                            "job_id": item.job_id,
                            "provider_id": item.provider_id,
                            "seeker_id": item.seeker_id,
                            // "hour": item.hour,
                            // "approval_hour": item.approval_hour,
                            // "approval_min": item.approval_min,
                            // "approval_payment": item.approval_payment,
                            // "minute": item.minute,
                            // "pay_scale": item.pay_scale,
                            // "day": item.day,
                            "created_at": item.created_at,
                            "start_date": datestring,
                            "format_start_date": moment(job[0].start_date, 'MM/DD/YYYY').add(0, 'day'),
                            "format_end_date": moment(job[0].end_date, 'MM/DD/YYYY').add(0, 'day')
                        };
                        array.push(obj);
                    }
                })
            })

            new Promise((resolve) => {
                setTimeout(() => {
                    resolve(array)
                }, 1000)
            }).then((response) => {
                res.json({ status: 200, msg: "Successfully founded job calender.", data: response })
            }).catch((error) => {
                res.json({ status: 500, msg: "Something went wrong.", error: error })
            })
        }
    })
}




//================================== Send invoice ever weekend on monday at 09:00 AM ===========================

// cron.schedule('0 9 * * Monday', function() {
//     // cron.schedule('*/2 * * * *', () => {
//     var sql = "SELECT A.*,B.first_name,B.last_name,B.device_token,B.email,C.name,C.addressline1,C.addressline2,C.city,C.state,C.zipcode,C.zone,D.skill FROM tab_jobs A LEFT JOIN tab_users B ON A.user_id = B.user_id LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN tab_skills D ON D.id=A.category WHERE A.isCompleted =0 and A.isInvoiceGenerate=0";
//     mysql.connection.query(sql, (err, job) => {
//         if (err) {
//             console.log("Error found while get job details")
//         } else if (job.length == 0) {
//             console.log("No job founded.")
//         } else {
//             async.forEachOf(job, (item, index) => {
//                 var sql1 = 'SELECT tab_approve_seeker.job_id,tab_approve_seeker.seeker_id,tab_users.first_name,tab_users.last_name, SUM(tab_approve_seeker.hour) AS total_hour,SUM(tab_approve_seeker.approval_hour) AS total_approval_hour,SUM(tab_approve_seeker.minute) AS total_min,SUM(tab_approve_seeker.approval_min) AS total_approval_min,SUM(tab_approve_seeker.pay_scale) AS total_payment, SUM(tab_approve_seeker.approval_payment) AS total_approval_payment FROM `tab_approve_seeker` LEFT JOIN tab_users ON tab_approve_seeker.seeker_id=tab_users.user_id WHERE tab_approve_seeker.job_id=? GROUP BY tab_approve_seeker.job_id,tab_approve_seeker.seeker_id'
//                 mysql.connection.query(sql1, [item.job_id], (err, seeker_list) => {
//                     if (err) {
//                         console.log("Error found while job seeker found.")
//                     } else if (seeker_list.length == 0) {
//                         console.log("No seeker founded");
//                     } else {
//                         var sql2 = "SELECT job_id, ROUND(SUM(pay_scale),2) AS total_payscale,ROUND(SUM(approval_payment),2) AS total_approval_payement FROM `tab_approve_seeker` WHERE job_id=?  GROUP BY job_id"
//                         mysql.connection.query(sql2, [item.job_id], (err, total_earning) => {
//                             if (err) {
//                                 console.log("Error found while calculate total earning.")
//                             } else if (total_earning.length == 0) {
//                                 console.log("No earning founded.")
//                             } else {
//                                 var data = {
//                                         total_pay_scale: total_earning,
//                                         job: job,
//                                         data: seeker_list
//                                     }
//                                     // console.log("data ====>", data);
//                                 ejs.toHTML('/var/www/html/projects/rockstaffing/templates/index.ejs', data).then(function(html) {
//                                     var options = { format: 'Letter' };
//                                     var output = '/var/www/html/projects/rockstaffing/invoice/pdf_' + moment().format('YYYYMMDDHHmmSS') + '.pdf'
//                                         // console.log("Html ====>", html)
//                                     pdf.toPDF(html, options, output).then(function(response) {
//                                         console.log("PDF file successfully written ===>", response);
//                                         // common_function.sendEmail(email, 'Rock staffing : Verify Email', 'Rock staffing', msg); //send message on registerd email address

//                                         var file = fs.readFileSync(response.filename).toString("base64");

//                                         var attachment = [{
//                                             content: file,
//                                             filename: 'invoice.pdf',
//                                             type: "application/pdf",
//                                             disposition: "attachment"
//                                         }];

//                                         common_function.sendEmailWithAttachment('tom@rockstaffing.com', 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);
//                                         common_function.sendEmailWithAttachment(job[0].email, 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);

//                                         //update invoiceGenerate=1 when create invoice
//                                         mysql.connection.query('Update tab_jobs set isInvoiceGenerate=? where job_id=?', [1, item.job_id], (err, update_status) => {
//                                             if (err) {
//                                                 console.log("Error found while update status of invoice generate.")
//                                             } else {
//                                                 console.log("Successfully update the invoice status.")
//                                             }
//                                         })
//                                     }, function(error) {
//                                         console.error(error);
//                                     });
//                                 }, function(error) {
//                                     console.error(error);
//                                 });
//                             }
//                         })
//                     }
//                 })
//             })
//         }
//     })
// });



// cron.schedule('*/1 * * * *', () => {
//     var sql = "SELECT A.*,B.first_name,B.last_name,B.device_token,B.email,C.name,C.addressline1,C.addressline2,C.city,C.state,C.zipcode,C.zone,D.skill,(SELECT price from tab_markup_price) As markup_price FROM tab_jobs A LEFT JOIN tab_users B ON A.user_id = B.user_id LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN tab_skills D ON D.id=A.category WHERE A.isCompleted =0 and A.isInvoiceGenerate=0";
//     mysql.connection.query(sql, (err, job) => {
//         if (err) {
//             console.log("Error found while get job details")
//         } else if (job.length == 0) {
//             console.log("No job founded.")
//         } else {
//             async.forEachOf(job, (item, index) => {
//                 var sql1 = 'SELECT tab_approve_seeker.job_id,tab_approve_seeker.seeker_id,tab_users.first_name,tab_users.last_name, SUM(tab_approve_seeker.hour) AS total_hour,SUM(tab_approve_seeker.approval_hour) AS total_approval_hour,SUM(tab_approve_seeker.minute) AS total_min,SUM(tab_approve_seeker.approval_min) AS total_approval_min,SUM(tab_approve_seeker.pay_scale) AS total_payment, SUM(tab_approve_seeker.approval_payment) AS total_approval_payment FROM `tab_approve_seeker` LEFT JOIN tab_users ON tab_approve_seeker.seeker_id=tab_users.user_id WHERE tab_approve_seeker.job_id=? GROUP BY tab_approve_seeker.job_id,tab_approve_seeker.seeker_id'
//                 mysql.connection.query(sql1, [item.job_id], (err, seeker_list) => {
//                     if (err) {
//                         console.log("Error found while job seeker found.")
//                     } else if (seeker_list.length == 0) {
//                         console.log("No seeker founded");
//                     } else {
//                         var array = [];
//                         async.forEachOf(seeker_list, (d, i) => {
//                             var hour = parseFloat(d.total_approval_hour) + parseFloat(((d.total_approval_min) / 60))
//                             var round_hr = Math.round((hour + Number.EPSILON) * 100) / 100
//                             var obj;
//                             var total_amount = 0;
//                             if (round_hr >= 40) {
//                                 obj = {
//                                     job_id: d.job_id,
//                                     seeker_id: d.seeker_id,
//                                     seeker_name: d.first_name + " " + d.last_name,
//                                     regular_hour: 40,
//                                     regular_rate: item.hourly_rate,
//                                     regular_amount: 40 * (item.hourly_rate),
//                                     ot_hour: Math.round(((round_hr - 40) + Number.EPSILON) * 100) / 100, //(round_hr - 40),
//                                     ot_rate: item.markup_price, //rate ot
//                                     ot_amount: Math.round((((round_hr - 40) * (item.markup_price)) + Number.EPSILON) * 100) / 100, // ((round_hr - 40) * (item.markup_price)),
//                                     amount: Math.round((((40 * (item.hourly_rate)) + ((round_hr - 40) * (item.markup_price))) + Number.EPSILON) * 100) / 100, //((40 * (item.hourly_rate)) + ((round_hr - 40) * (item.markup_price)))
//                                 }
//                                 total_amount += Math.round((((40 * (item.hourly_rate)) + ((round_hr - 40) * (item.markup_price))) + Number.EPSILON) * 100) / 100 //(40 * (item.hourly_rate)) + ((round_hr - 40) * (item.markup_price));
//                                 array.push(obj);
//                             } else {
//                                 obj = {
//                                     job_id: d.job_id,
//                                     seeker_id: d.seeker_id,
//                                     seeker_name: d.first_name + " " + d.last_name,
//                                     regular_hour: round_hr,
//                                     regular_rate: item.hourly_rate,
//                                     regular_amount: round_hr * (item.hourly_rate),
//                                     ot_hour: 0,
//                                     ot_rate: 0, //rate ot
//                                     ot_amount: 0,
//                                     amount: round_hr * (item.hourly_rate)
//                                 }
//                                 total_amount += (round_hr * (item.hourly_rate))
//                                 array.push(obj);
//                             }
//                         })

//                         new Promise((resolve) => {
//                             setTimeout(() => {
//                                 resolve(array);
//                             }, 1000)
//                         }).then((response) => {

//                             var regular_hour = response.reduce(function(cnt, o) { return cnt + o.regular_hour; }, 0);
//                             var ot_hour = response.reduce(function(cnt, o) { return cnt + o.ot_hour; }, 0);

//                             var data = {
//                                 total_hour: [{
//                                     total_hour: Math.round(((regular_hour + ot_hour) + Number.EPSILON) * 100) / 100
//                                 }],
//                                 total_pay_scale: [{
//                                     total_pay_scale: response.reduce(function(cnt, o) { return cnt + o.amount; }, 0)
//                                 }],
//                                 job: job,
//                                 data: response
//                             }
//                             console.log("data ====>", data);

//                             ejs.toHTML('/var/www/html/projects/rockstaffing/templates/index.ejs', data).then(function(html) {
//                                 var options = { format: 'Letter' };
//                                 var output = '/var/www/html/projects/rockstaffing/uploads/invoice/pdf_' + moment().format('YYYYMMDDHHmmSS') + '.pdf'

//                                 pdf.toPDF(html, options, output).then(function(response) {
//                                     console.log("PDF file successfully written ===>", response);
//                                     var file = fs.readFileSync(response.filename).toString("base64");

//                                     var attachment = [{
//                                         content: file,
//                                         filename: 'invoice.pdf',
//                                         type: "application/pdf",
//                                         disposition: "attachment"
//                                     }];

//                                     // common_function.sendEmailWithAttachment('tom@rockstaffing.com', 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);
//                                     // common_function.sendEmailWithAttachment(job[0].email, 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);
//                                     common_function.sendEmailWithAttachment('singhak671@gmail.com', 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);

//                                     // update invoiceGenerate=1 when create invoice
//                                     mysql.connection.query('Update tab_jobs set isInvoiceGenerate=? where job_id=?', [1, item.job_id], (err, update_status) => {
//                                         if (err) {
//                                             console.log("Error found while update status of invoice generate.")
//                                         } else {
//                                             // console.log("Successfully update the invoice status.")
//                                             mysql.connection.query('update tab_invoice set invoice=? where job_id=?', [`http://178.62.83.145:2000/uploads/invoice/pdf_${moment().format('YYYYMMDDHHmmSS') + '.pdf'}`, item.job_id], (err, upadte_invoice_pdf) => {
//                                                 if (err) {
//                                                     console.log("Error while update the invoice url.")
//                                                 } else {
//                                                     console.log("Successfully update the invoice status.")
//                                                 }
//                                             })
//                                         }
//                                     })
//                                 }, function(error) {
//                                     console.error(error);
//                                 });
//                             }, function(error) {
//                                 console.error(error);
//                             });

//                         }).catch((error) => {
//                             console.log("Something went wrong.")
//                         })
//                     }
//                 })
//             })
//         }
//     })
// });






cron.schedule('*/1 * * * *', () => {
    var sql = "SELECT A.*,B.first_name,B.last_name,B.device_token,B.email,C.name,C.addressline1,C.addressline2,C.city,C.state,C.zipcode,C.zone,D.skill,(SELECT price from tab_markup_price) As markup_price FROM tab_jobs A LEFT JOIN tab_users B ON A.user_id = B.user_id LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN tab_skills D ON D.id=A.category WHERE A.isCompleted =0 and A.isInvoiceGenerate=0";
    mysql.connection.query(sql, (err, job) => {
        if (err) {
            console.log("Error found while get job details")
        } else if (job.length == 0) {
            console.log("No job founded.")
        } else {
            async.forEachOf(job, (item, index) => {
                var sql1 = 'SELECT tab_approve_seeker.job_id,tab_approve_seeker.seeker_id,tab_users.first_name,tab_users.last_name, SUM(tab_approve_seeker.hour) AS total_hour,SUM(tab_approve_seeker.approval_hour) AS total_approval_hour,SUM(tab_approve_seeker.minute) AS total_min,SUM(tab_approve_seeker.approval_min) AS total_approval_min,SUM(tab_approve_seeker.pay_scale) AS total_payment, SUM(tab_approve_seeker.approval_payment) AS total_approval_payment FROM `tab_approve_seeker` LEFT JOIN tab_users ON tab_approve_seeker.seeker_id=tab_users.user_id WHERE tab_approve_seeker.job_id=? GROUP BY tab_approve_seeker.job_id,tab_approve_seeker.seeker_id'
                mysql.connection.query(sql1, [item.job_id], (err, seeker_list) => {
                    if (err) {
                        console.log("Error found while job seeker found.")
                    } else if (seeker_list.length == 0) {
                        console.log("No seeker founded");
                    } else {
                        var array = [];
                        async.forEachOf(seeker_list, (d, i) => {
                            var hour = parseFloat(d.total_approval_hour) + parseFloat(((d.total_approval_min) / 60))
                            var round_hr = Math.round((hour + Number.EPSILON) * 100) / 100
                            var obj;
                            var total_amount = 0;
                            if (round_hr >= 40) {
                                obj = {
                                    job_id: d.job_id,
                                    seeker_id: d.seeker_id,
                                    seeker_name: d.first_name + " " + d.last_name,
                                    regular_hour: 40,
                                    regular_rate: item.hourly_rate,
                                    regular_amount: 40 * (item.hourly_rate),
                                    ot_hour: Math.round(((round_hr - 40) + Number.EPSILON) * 100) / 100, //(round_hr - 40),
                                    ot_rate: item.markup_price, //rate ot
                                    ot_amount: Math.round((((round_hr - 40) * (item.markup_price)) + Number.EPSILON) * 100) / 100, // ((round_hr - 40) * (item.markup_price)),
                                    amount: Math.round((((40 * (item.hourly_rate)) + ((round_hr - 40) * (item.markup_price))) + Number.EPSILON) * 100) / 100, //((40 * (item.hourly_rate)) + ((round_hr - 40) * (item.markup_price)))
                                }
                                total_amount += Math.round((((40 * (item.hourly_rate)) + ((round_hr - 40) * (item.markup_price))) + Number.EPSILON) * 100) / 100 //(40 * (item.hourly_rate)) + ((round_hr - 40) * (item.markup_price));
                                array.push(obj);
                            } else {
                                obj = {
                                    job_id: d.job_id,
                                    seeker_id: d.seeker_id,
                                    seeker_name: d.first_name + " " + d.last_name,
                                    regular_hour: round_hr,
                                    regular_rate: item.hourly_rate,
                                    regular_amount: round_hr * (item.hourly_rate),
                                    ot_hour: 0,
                                    ot_rate: 0, //rate ot
                                    ot_amount: 0,
                                    amount: round_hr * (item.hourly_rate)
                                }
                                total_amount += (round_hr * (item.hourly_rate))
                                array.push(obj);
                            }
                        })

                        new Promise((resolve) => {
                            setTimeout(() => {
                                resolve(array);
                            }, 1000)
                        }).then((response) => {

                            var regular_hour = response.reduce(function(cnt, o) { return cnt + o.regular_hour; }, 0);
                            var ot_hour = response.reduce(function(cnt, o) { return cnt + o.ot_hour; }, 0);

                            // var data = {
                            //     total_hour: [{
                            //         total_hour: Math.round(((regular_hour + ot_hour) + Number.EPSILON) * 100) / 100
                            //     }],
                            //     total_pay_scale: [{
                            //         total_pay_scale: response.reduce(function(cnt, o) { return cnt + o.amount; }, 0)
                            //     }],
                            //     job: job,
                            //     data: response
                            // }
                            // console.log("data ====>", data);

                            const html = fs.readFileSync('./templates/index.html', 'utf8');
                            const options = {
                                format: "A3",
                                orientation: "portrait",
                                border: "10mm",
                            }
                            const jobDetails = {
                                jobTitle: job[0].job_title,
                                jobProvider: job[0].first_name + " " + job[0].last_name,
                                jobLocation: job[0].name + "," + job[0].addressline1 + "," + job[0].addressline2 + "," + job[0].city + "," + job[0].state + "," + job[0].zipcode,
                                startDate: job[0].start_date,
                                endDate: job[0].end_date
                            }

                            let subTotal = 0.0;
                            let totalTime = 0.0;

                            const employeesData = [];

                            response.forEach(e => {
                                const employee = {
                                    employeeName: e.seeker_name,
                                    regularHour: e.regular_hour,
                                    regularRate: e.regular_rate,
                                    regularAmount: e.regular_amount,
                                    otHour: e.ot_hour,
                                    otRate: e.ot_rate,
                                    otAmount: e.ot_amount,
                                    amount: e.amount
                                };
                                employeesData.push(employee);
                            });

                            const headerData = {
                                date: moment(new Date()).format('DD/ MM/ YYYY'),
                                invoiceNo: cryptoRandomString({ length: 6 }),
                                totalTime: totalTime + Math.round(((regular_hour + ot_hour) + Number.EPSILON) * 100) / 100,
                                amount: subTotal + response.reduce(function(cnt, o) { return cnt + o.amount; }, 0)
                            };

                            const document = {
                                html: html,
                                data: {
                                    headerData: headerData,
                                    jobDetails: jobDetails,
                                    employeesData: employeesData,
                                    subTotal: subTotal + response.reduce(function(cnt, o) { return cnt + o.amount; }, 0)
                                },
                                path: './uploads/invoice/pdf_' + moment().format('YYYYMMDDHHmmSS') + '.pdf'
                            };

                            pdf.create(document, options)
                                .then(res => {
                                    console.log("invoice generated ==>", res)
                                    var file = fs.readFileSync(res.filename).toString("base64");

                                    var attachment = [{
                                        content: file,
                                        filename: 'invoice.pdf',
                                        type: "application/pdf",
                                        disposition: "attachment"
                                    }];

                                    // common_function.sendEmailWithAttachment('tom@rockstaffing.com', 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);
                                    // common_function.sendEmailWithAttachment(job[0].email, 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);

                                    common_function.sendEmailWithAttachment('singhak671@gmail.com', 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);
                                    // update invoiceGenerate=1 when create invoice
                                    mysql.connection.query('Update tab_jobs set isInvoiceGenerate=? where job_id=?', [1, item.job_id], (err, update_status) => {
                                        if (err) {
                                            console.log("Error found while update status of invoice generate.")
                                        } else {
                                            // console.log("Successfully update the invoice status.")
                                            mysql.connection.query('update tab_invoice set invoice=?,invoice_number=? where job_id=?', [`http://178.62.83.145:2000/uploads/invoice/pdf_${moment().format('YYYYMMDDHHmmSS') + '.pdf'}`, cryptoRandomString({ length: 6 }), item.job_id], (err, upadte_invoice_pdf) => {
                                                if (err) {
                                                    console.log("Error while update the invoice url.")
                                                } else {
                                                    console.log("Successfully update the invoice status.")
                                                }
                                            })
                                        }
                                    })
                                })
                                .catch(error => {
                                    console.error("error found while generate invoice", error)
                                });
                        }).catch((error) => {
                            console.log("Something went wrong.")
                        })
                    }
                })
            })
        }
    })
});





//================================== get job details(on calender) ===================================

const job_detail_calender = async(req, res) => {

    const { job_id } = req.body;
    const user_id = req.decoded.user_id;
    try {
        await getJobDetailsOnCalender();
    } catch (error) {
        res.json({ status: 500, msg: "Something went wrong." })
    }

    function getJobDetailsOnCalender() {
        mysql.connection.query('select * from tab_users where user_id=?', [user_id], (err, user) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (user.length == 0) {
                res.json({ status: 500, msg: "User not found." })
            } else if (user[0].role_id == 1) {
                // mysql.connection.query('SELECT A.job_id,A.job_title,A.start_date,A.end_date,A.start_time,A.end_time,A.location,B.first_name,B.last_name,A.created_at,C.skill FROM `tab_jobs` A LEFT JOIN tab_users B ON A.user_id=B.user_id LEFT JOIN tab_skills C ON C.id=A.category WHERE A.job_id =?', [job_id], (err, job) => {
                var sql = "SELECT A.job_id,A.job_title,A.start_date,A.end_date,A.start_time,A.end_time,A.location,B.first_name,B.last_name,A.created_at,C.skill,D.name,D.addressline1,D.addressline2,D.city,D.state,D.zipcode,D.zone FROM `tab_jobs` A LEFT JOIN tab_users B ON A.user_id=B.user_id LEFT JOIN tab_skills C ON C.id=A.category LEFT JOIN tab_address D ON D.id=A.address WHERE A.job_id =?"
                mysql.connection.query(sql, [job_id], (err, job) => {
                    if (err) {
                        res.json({ status: 500, msg: "Internal server error." })
                    } else if (job.length == 0) {
                        res.json({ status: 500, msg: "No job founded.", data: [] })
                    } else {
                        var array = [];
                        mysql.connection.query('SELECT A.job_id,A.seeker_id,B.first_name,B.last_name FROM `tab_approve_seeker` A LEFT JOIN tab_users B ON A.seeker_id=B.user_id WHERE A.job_id=?', [job_id], (err, seeker_list) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error." })
                            } else if (seeker_list.length == 0) {
                                res.json({ status: 500, msg: "No seeker founded.", data: [] })
                            } else {
                                async.forEach(seeker_list, (item, index) => {
                                    array.push(`${item.first_name + "" + item.last_name}`)
                                })
                            }
                        })

                        new Promise((resolve) => {
                            setTimeout(() => {
                                resolve(array);
                            }, 1000)
                        }).then((response) => {
                            var obj = {
                                job_id: job[0].job_id,
                                job_title: job[0].job_title,
                                start_date: job[0].start_date,
                                end_date: job[0].end_date,
                                start_time: job[0].start_time,
                                end_time: job[0].end_time,
                                location: job[0].name + ", " + job[0].addressline1 + "," + job[0].addressline2 + ", " + job[0].city + ", " + job[0].state,
                                provider_name: job[0].first_name + " " + job[0].last_name,
                                seeker_list: response,
                                created_at: job[0].created_at,
                                skill: job[0].skill
                            }
                            res.json({ status: 200, msg: "Successfully data found.", data: obj })
                        }).catch((error) => {
                            res.json({ status: 500, msg: "Something went wrong." })
                        })
                    }
                })
            } else if (user[0].role_id == 2) {
                // mysql.connection.query("SELECT A.job_id,A.job_title,A.start_date,A.end_date,A.start_time,A.end_time,A.location,CONCAT(B.first_name, ' ', B.last_name) As provider_name , A.created_at,C.skill FROM `tab_jobs` A LEFT JOIN tab_users B ON A.user_id=B.user_id LEFT JOIN tab_skills C ON C.id=A.category WHERE A.job_id =?", [job_id], (err, job) => {
                mysql.connection.query("SELECT A.job_id,A.job_title,A.start_date,A.end_date,A.start_time,A.end_time,B.first_name,B.last_name,CONCAT(B.first_name, '', B.last_name) As provider_name , A.created_at,C.skill,CONCAT(D.name,', ',D.addressline1,', ',D.addressline2,', ',D.city,', ',D.state,', ',D.zipcode) as location FROM `tab_jobs` A LEFT JOIN tab_users B ON A.user_id=B.user_id LEFT JOIN tab_skills C ON C.id=A.category LEFT JOIN tab_address D ON D.id=A.address WHERE A.job_id =?", [job_id], (err, job) => {
                    if (err) {
                        res.json({ status: 500, msg: "Internal server error." })
                    } else if (job.length == 0) {
                        res.json({ status: 500, msg: "No job founded.", data: [] })
                    } else {
                        res.json({ status: 200, msg: "Successfully data found.", data: job[0] })
                    }
                })
            }
        })
    }
}

//================================= API for job finished ==========================

const job_finished = async(req, res) => {

    const { job_id } = req.body;
    var user_id = req.decoded.user_id;

    // complete job (status =3) for progress bar

    mysql.connection.query('update tab_users set progress_bar_status=?,progress_bar_job_id=? where user_id=?', [3, job_id, user_id], (err, update_progress_bar) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else {
            mysql.connection.query('Update tab_jobs set isCompleted=? where job_id=?', [0, job_id], (err, job_compl) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else {
                    res.json({ status: 200, msg: "Successfully completed job." })
                }
            })
        }
    })
}

//=============================== API for check job provider progress bar ========================

const check_progress_bar_status = async(req, res) => {

    var user_id = req.decoded.user_id;

    mysql.connection.query('select user_id,first_name,last_name,progress_bar_status,progress_bar_job_id	from tab_users where user_id=?', [user_id], (err, user) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (user.length == 0) {
            res.json({ status: 500, msg: "No user found.", data: [] })
        } else {
            res.json({ status: 200, msg: "Data found.", data: user })
        }
    })
}

//================================ API for update progress bar ================================

const update_progress_bar = (req, res) => {

    const { job_id, status } = req.body;
    var user_id = req.decoded.user_id;

    mysql.connection.query('update tab_users set progress_bar_status=?,progress_bar_job_id=? where user_id=?', [status, job_id, user_id], (err, updated) => {
        if (err) {
            res.json({ status: 200, msg: "Internal server error." })
        } else {
            res.json({ status: 200, msg: "Successfully updated progress bar" })
        }
    })
}


//========================== API for get markup price (OT) admin ===========================

const get_markup_price = async(req, res) => {

    mysql.connection.query('select * from tab_markup_price ', (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (result.length == 0) {
            res.json({ status: 500, msg: "No price founded." })
        } else {
            res.json({ status: 200, msg: "Price found.", data: result })
        }
    })
}

//============================ API for edit markup price (admin) ===============================

const edit_markup_price = async(req, res) => {

    const { id, price } = req.body;

    mysql.connection.query('update tab_markup_price set price=? where id=?', [price, id], (err, update_price) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else {
            res.json({ status: 200, msg: "Successfully updated price." })
        }
    })
}

//============================= API for testing 

const testing = async(req, res) => {

    var array = [{
            "job_id": 700,
            "seeker_id": 349,
            "first_name": "Sam",
            "last_name": "Blake",
            "total_hour": 8,
            "total_approval_hour": 50,
            "total_min": 4,
            "total_approval_min": 4,
            "total_payment": 80.67,
            "total_approval_payment": 80.67
        },
        {
            "job_id": 700,
            "seeker_id": 350,
            "first_name": "J",
            "last_name": "Blake",
            "total_hour": 12,
            "total_approval_hour": 12,
            "total_min": 16,
            "total_approval_min": 16,
            "total_payment": 122.67,
            "total_approval_payment": 122.67
        }
    ];

    var new_array = [];
    async.forEachOf(array, (item, index) => {
        var hour = (((item.total_approval_hour) * 60) + (item.total_approval_min)) / 60
        if (hour > 40) {

        }
    })
}

//============================== API for show previous jobs(job seeker) =================================

const previous_job = async(req, res) => {

    // const { user_id } = req.body;
    var user_id = req.decoded.user_id;

    var sql = "SELECT A.job_id,A.seeker_id,A.hour,A.approval_hour,A.minute,A.approval_min,A.pay_scale,A.approval_payment,CONCAT(D.first_name,' ',D.last_name) AS provider_name,D.profile_pic As provider_profile_pic,  B.job_title,B.hourly_rate,B.start_date,B.end_date,B.start_time,B.end_time,B.no_of_opening,B.payment_status,B.isCompleted,CONCAT(C.name,',',C.addressline1,',',C.addressline2,',',C.city,',',C.state,',',C.zipcode) AS address FROM `tab_approve_seeker` A LEFT JOIN tab_jobs B ON A.job_id=B.job_id LEFT JOIN tab_address C ON C.id=B.address LEFT JOIN tab_users D ON D.user_id=B.user_id WHERE A.seeker_id=? ORDER BY A.id DESC"

    mysql.connection.query(sql, [user_id], (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error" })
        } else if (result.length == 0) {
            res.json({ status: 500, msg: "No job founded.", data: [] })
        } else {
            var array = [];
            async.forEachOf(result, (item, index) => {
                var hour = parseFloat(item.approval_hour) + parseFloat(((item.approval_min) / 60))
                var round_hr = Math.round((hour + Number.EPSILON) * 100) / 100
                var obj = {
                    job_id: item.job_id,
                    seeker_id: item.seeker_id,
                    time_spent: round_hr + "Hr",
                    hour: item.hour,
                    approval_hour: item.approval_hour,
                    minute: item.minute,
                    approval_min: item.approval_min,
                    pay_scale: item.pay_scale,
                    approval_payment: item.approval_payment + "$",
                    provider_name: item.provider_name,
                    provider_profile_pic: item.provider_profile_pic,
                    job_title: item.job_title,
                    hourly_rate: item.hourly_rate + "$/Hr",
                    start_date: item.start_date,
                    end_date: item.end_date,
                    start_time: item.start_time,
                    end_time: item.end_time,
                    no_of_opening: item.no_of_opening,
                    payment_status: item.payment_status,
                    isCompleted: item.isCompleted,
                    address: item.address
                }
                array.push(obj);
            })

            new Promise((resolve) => {
                setTimeout(() => {
                    resolve(array);
                }, 1000)
            }).then((response) => {
                res.json({ status: 200, msg: "Successfully founded.", data: response })
            }).catch((error) => {
                res.json({ status: 500, msg: "Something went wrong." })
            })

        }
    })
}

//=============================== API for previous job (job provider) ===========================

const provider_previous_job = async(req, res) => {

    // const { user_id } = req.body;
    var user_id = req.decoded.user_id;


    var sql = "SELECT A.job_id,A.provider_id,SUM(A.hour) AS hour,SUM(A.approval_hour) As approval_hour,SUM(A.minute) AS minute,SUM(A.approval_min) AS approval_min,SUM(A.pay_scale) AS pay_scale,SUM(A.approval_payment) AS approval_payment,B.job_title,B.no_of_opening,B.hourly_rate,B.start_date,B.end_date,B.start_time,B.end_time,B.payment_status,B.isCompleted, CONCAT(C.name,',',C.addressline1,',',C.addressline2,',',C.city,',',C.state,',',C.zipcode) AS address FROM `tab_approve_seeker` A LEFT JOIN tab_jobs B ON B.job_id=A.job_id LEFT JOIN tab_address C ON C.id=B.address WHERE A.provider_id=? GROUP BY A.provider_id,A.job_id"

    mysql.connection.query(sql, [user_id], (err, result) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error" })
        } else if (result.length == 0) {
            res.json({ status: 500, msg: "No job founded.", data: [] })
        } else {
            var array = [];
            async.forEachOf(result, (item, index) => {
                var hour = parseFloat(item.approval_hour) + parseFloat(((item.approval_min) / 60))
                var round_hr = Math.round((hour + Number.EPSILON) * 100) / 100

                var obj = {
                    job_id: item.job_id,
                    provider_id: item.provider_id,
                    time_spent: round_hr + "Hr",
                    hour: item.hour,
                    approval_hour: item.approval_hour,
                    minute: item.minute,
                    approval_min: item.approval_min,
                    pay_scale: item.pay_scale,
                    approval_payment: item.approval_payment + "$",
                    job_title: item.job_title,
                    no_of_opening: item.no_of_opening,
                    hourly_rate: item.hourly_rate + "$/Hr",
                    start_date: item.start_date,
                    end_date: item.end_date,
                    start_time: item.start_time,
                    end_time: item.end_time,
                    payment_status: item.payment_status,
                    isCompleted: item.isCompleted
                }
                array.push(obj);
            })

            new Promise((resolve) => {
                setTimeout(() => {
                    resolve(array);
                }, 1000)
            }).then((response) => {
                res.json({ status: 200, msg: "Successfully founded.", data: response })
            }).catch((error) => {
                res.json({ status: 500, msg: "Something went wrong." })
            })
        }
    })
}

//==================================== API for job details on previous job (provider) ===================

const job_detail_on_previous_job = async(req, res) => {

    const { job_id } = req.body;
    var user_id = req.decoded.user_id;

    mysql.connection.query("select A.job_id,A.user_id,A.job_title,A.start_date,A.end_date,B.skill,CONCAT(C.name,', ',C.addressline1,', ',C.addressline2,', ',C.city,', ',C.state,', ',C.zipcode) AS address from tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category LEFT JOIN tab_address C ON C.id=A.address where A.job_id=? AND A.user_id=?", [job_id, user_id], (err, job) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error" })
        } else if (job.length == 0) {
            res.json({ status: 500, msg: "No job founded.", data: [] })
        } else {
            mysql.connection.query("SELECT A.*,CONCAT(B.first_name,' ',B.last_name) AS seeker_name,B.profile_pic FROM `tab_approve_seeker` A LEFT JOIN tab_users B ON B.user_id=A.seeker_id WHERE A.job_id=? GROUP BY A.seeker_id", [job_id], (err, seeker_list) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error" })
                } else if (seeker_list.length == 0) {
                    res.json({ status: 500, msg: "No data found.", data: [] })
                } else {
                    var array = [];
                    async.forEachOf(seeker_list, (item, index) => {
                        // var hour = parseFloat(item.approval_hour) + parseFloat(((item.approval_min) / 60))
                        // var round_hr = Math.round((hour + Number.EPSILON) * 100) / 100
                        // var obj = { seeker_name: item.seeker_name,seeker_profile_pic:item.profile_pic,total_hour: round_hr + "Hr" };
                        var obj = { seeker_name: item.seeker_name, seeker_profile_pic: item.profile_pic, total_hour: item.approval_hour + "Hr " + item.approval_min + "Min", pay_scale: item.pay_scale, approval_payment: item.approval_payment };

                        array.push(obj);
                    })

                    new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(array);
                        }, 1000)
                    }).then((response) => {
                        var result = {
                            job_id: job[0].job_id,
                            user_id: job[0].user_id,
                            job_title: job[0].job_title,
                            start_date: job[0].start_date,
                            end_date: job[0].end_date,
                            category: job[0].skill,
                            address: job[0].address,
                            seekers: response
                        };
                        res.json({ status: 200, msg: "Successfully data founded.", data: result })
                    }).catch((error) => {
                        res.json({ status: 500, msg: "Something went wrong" })
                    })
                }
            })
        }
    })
}



// ================================= CRON job for notify 5 minute before start (seeker)==================================
// cron.schedule('*/2 * * * *', () => {

cron.schedule('*/1 * * * *', () => {

    var sql = 'Select A.*,B.role_id from tab_jobs A LEFT JOIN tab_users B ON B.user_id=A.user_id where A.isCompleted=? and A.isSeekerNotify=?';
    mysql.connection.query(sql, [1, 0], (err, job) => {
        if (err) {
            console.log("Error found while find jobs.")
        } else if (job.length == 0) {
            console.log("No job found.")
        } else {
            async.forEachOf(job, (item, index) => {
                var format_date = moment(item.start_date, 'MM/DD/YYYY').add(0, 'day').format('YYYY-MM-DD')
                var today = moment().format('YYYY-MM-DD');

                var date1 = moment(format_date).startOf('day');
                var date2 = moment(today).startOf('day');

                if (date1.isSame(date2)) { // if date is same => true
                    // const number = moment(item.start_time, ["h:mm A"]).format("HH:mm");


                    var date = new Date();
                    var date_format = date.toDateString();
                    var new_date = new Date(`${date_format}, ${item.start_time}`);
                    console.log("new_date ===>", new_date);
                    var subtract_date = moment(new_date).subtract(5, "minutes").toDate()
                    console.log("subtract_date ===>", subtract_date);
                    console.log("date ====>", date);

                    var now_date = new Date();

                    var p1 = moment(now_date).add(5, "hours").toDate()
                    var p2 = moment(p1).add(30, "minutes").toDate()

                    console.log("p2 =====>", p2);

                    // if (p2 == subtract_date || p2 > subtract_date) {
                    if (p2 == subtract_date) {
                        console.log("condition true ====>");
                        var sql1 = "SELECT A.job_id,A.seeker_id,B.first_name,B.last_name,B.device_token,B.device_type FROM `tab_booking` A LEFT JOIN tab_users B ON A.seeker_id=B.user_id WHERE A.job_id=?"
                        mysql.connection.query(sql1, [item.job_id], (err, seeker_list) => {
                            if (err) {
                                console.log("Error found while seeker list found.")
                            } else if (seeker_list.length == 0) {
                                console.log("No seeker founded.")
                            } else {
                                async.forEachOf(seeker_list, (d, i) => {
                                    var title = `Your job ${item.job_title} is starting after 5 minutes.`;
                                    var text = `${item.job_title}`;
                                    var recieverId = d.user_id;
                                    var senderId = item.user_id;
                                    var RoleId = d.role_id;
                                    var JOB = (item.job_id).toString();

                                    var data = { //data
                                        // "job_id": JOB, //job_id
                                        "sender_id": senderId.toString(), //seeker id
                                        // "receiver_id": recieverId.toString(), // provider id
                                        // "role_id": RoleId.toString(),
                                        "isCompleted": "1"
                                    }

                                    console.log("datatta ====>", data)
                                    common_function.send_push_notification(d.device_token, title, text, data);
                                    mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,status=?', [item.job_id, d.user_id, title, item.lat, item.lng, item.job_type, 2], (err, save_notification) => {
                                        if (err) {
                                            console.log('Error found in save notification.')
                                        } else {
                                            console.log("Successfully sent notification to the seeker to start the job before 5 minutes.")
                                        }
                                    })
                                })
                            }
                        })
                    } else {
                        console.log("No seeker notified1.")
                    }

                } else {
                    console.log("No seeker notified2.")
                }
            })
        }
    })
})

// ================================= CRON job for notify 5 minute end the job (seeker)==================================
// cron.schedule('*/2 * * * *', () => {

cron.schedule('*/1 * * * *', () => {
    var sql = 'Select A.*,B.role_id from tab_jobs A LEFT JOIN tab_users B ON B.user_id=A.user_id where A.isCompleted=? and A.isSeekerNotify=?';
    mysql.connection.query(sql, [1, 0], (err, job) => {
        if (err) {
            console.log("Error found while find jobs.")
        } else if (job.length == 0) {
            console.log("No job found.")
        } else {
            async.forEachOf(job, (item, index) => {
                var format_date = moment(item.end_date, 'MM/DD/YYYY').add(0, 'day').format('YYYY-MM-DD')
                var today = moment().format('YYYY-MM-DD');

                var date1 = moment(format_date).startOf('day');
                var date2 = moment(today).startOf('day');

                if (date1.isSame(date2)) { // if date is same => true
                    // const number = moment(item.start_time, ["h:mm A"]).format("HH:mm");

                    var date = new Date();
                    var date_format = date.toDateString();
                    var new_date = new Date(`${date_format}, ${item.end_time}`);
                    console.log("new_date ===>", new_date);
                    var subtract_date = moment(new_date).subtract(5, "minutes").toDate()
                    console.log("subtract_date ===>", subtract_date);
                    console.log("date ====>", date);

                    var now_date = new Date();
                    var p1 = moment(now_date).add(5, "hours").toDate()
                    var p2 = moment(p1).add(30, "minutes").toDate()

                    console.log("p2 =====>", p2);

                    // if (now_date == subtract_date) {
                    if (p2 == subtract_date) {

                        var sql1 = "SELECT A.job_id,A.seeker_id,B.first_name,B.last_name,B.device_token,B.device_type FROM `tab_booking` A LEFT JOIN tab_users B ON A.seeker_id=B.user_id WHERE A.job_id=?"
                        mysql.connection.query(sql1, [item.job_id], (err, seeker_list) => {
                            if (err) {
                                console.log("Error found while seeker list found.")
                            } else if (seeker_list.length == 0) {
                                console.log("No seeker founded.")
                            } else {
                                async.forEachOf(seeker_list, (d, i) => {
                                    var title = `Your job ${item.job_title} is end after 5 minutes.`;
                                    var text = `${item.job_title}`;
                                    // var recieverId = d.user_id;
                                    var senderId = item.user_id;
                                    var RoleId = d.role_id;
                                    // var JOB = (item.job_id).toString();
                                    var data = { //data
                                        // "job_id": JOB, //job_id
                                        "sender_id": senderId.toString(), //seeker id
                                        // "receiver_id": recieverId.toString(), // provider id
                                        // "role_id": RoleId.toString(),
                                        "isCompleted": "1"
                                    }
                                    console.log("datatta ====>", data)
                                    common_function.send_push_notification(d.device_token, title, text, data);
                                    mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,status=?', [item.job_id, d.user_id, title, item.lat, item.lng, item.job_type, 2], (err, save_notification) => {
                                        if (err) {
                                            console.log('Error found in save notification.')
                                        } else {
                                            console.log("Successfully sent notification to the seeker to start the job before 5 minutes.")
                                        }
                                    })
                                })
                            }
                        })
                    } else {
                        console.log("No seeker notified1.")
                    }
                } else {
                    console.log("No seeker notified2.")
                }
            })
        }
    })
})

//===================== API for payment via invoice ==============================

// const create_invoice = async(req, res) => {

//     // const { user_id, job_id } = req.body;
//     const { job_id } = req.body;

//     var user_id = req.decoded.user_id; // provider id

//     // mysql.connection.query('insert into tab_invoice set job_id=?,user_id=?,amount=?', [job_id, user_id, amount], (err, save) => {
//     //     if (err) {
//     //         res.json({ status: 500, msg: "Internal server error.", err: err })
//     //     } else {
//     //         // res.json({ status: 200, msg: "Successfully approved." })
//     //         // res.json({ status: 200, msg: "Successfully charge created" })

//     //         // 28 July  
//     //         mysql.connection.query('update tab_users set payment_status=? where user_id=?', [1, user_id], (err, updated) => {
//     //             if (err) {
//     //                 res.json({ status: 500, msg: "Internal server error.", err: err })
//     //             } else {


//     // var sql = "SELECT A.*,B.first_name,B.last_name,B.device_token,B.email,C.name,C.addressline1,C.addressline2,C.city,C.state,C.zipcode,C.zone,D.skill,(SELECT price from tab_markup_price) As markup_price FROM tab_jobs A LEFT JOIN tab_users B ON A.user_id = B.user_id LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN tab_skills D ON D.id=A.category WHERE A.job_id=? and A.user_id=? and A.isInvoiceGenerate=?";
//     var sql = "SELECT A.*,B.first_name,B.last_name,B.device_token,B.email,C.name,C.addressline1,C.addressline2,C.city,C.state,C.zipcode,C.zone,D.skill,(SELECT price from tab_markup_price) As markup_price FROM tab_jobs A LEFT JOIN tab_users B ON A.user_id = B.user_id LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN tab_skills D ON D.id=A.category WHERE A.job_id=? and A.user_id=?";

//     console.log("sql ===>", sql);

//     mysql.connection.query(sql, [job_id, user_id], (err, job) => {
//         if (err) {
//             // console.log("Error found while get job details")
//             res.json({ status: 500, msg: "Internal server error." })
//         } else if (job.length == 0) {
//             // console.log("No job founded.")
//             res.json({ status: 500, msg: "No job founded." })
//         } else {
//             // async.forEachOf(job, (item, index) => {
//             var sql1 = 'SELECT tab_approve_seeker.job_id,tab_approve_seeker.seeker_id,tab_users.first_name,tab_users.last_name, SUM(tab_approve_seeker.hour) AS total_hour,SUM(tab_approve_seeker.approval_hour) AS total_approval_hour,SUM(tab_approve_seeker.minute) AS total_min,SUM(tab_approve_seeker.approval_min) AS total_approval_min,SUM(tab_approve_seeker.pay_scale) AS total_payment, SUM(tab_approve_seeker.approval_payment) AS total_approval_payment FROM `tab_approve_seeker` LEFT JOIN tab_users ON tab_approve_seeker.seeker_id=tab_users.user_id WHERE tab_approve_seeker.job_id=? GROUP BY tab_approve_seeker.job_id,tab_approve_seeker.seeker_id'
//             mysql.connection.query(sql1, [job_id], (err, seeker_list) => {
//                     if (err) {
//                         // console.log("Error found while job seeker found.")
//                         res.json({ status: 500, msg: "Internal server error.", err2: err })
//                     } else if (seeker_list.length == 0) {
//                         // console.log("No seeker founded");
//                         res.json({ status: 500, msg: "No seeker founded." })
//                     } else {
//                         var array = [];
//                         async.forEachOf(seeker_list, (d, i) => {
//                             var hour = parseFloat(d.total_approval_hour) + parseFloat(((d.total_approval_min) / 60))
//                             var round_hr = Math.round((hour + Number.EPSILON) * 100) / 100
//                             var obj;
//                             var total_amount = 0;
//                             if (round_hr >= 40) {
//                                 obj = {
//                                     job_id: d.job_id,
//                                     seeker_id: d.seeker_id,
//                                     seeker_name: d.first_name + " " + d.last_name,
//                                     regular_hour: 40,
//                                     regular_rate: job[0].hourly_rate,
//                                     regular_amount: 40 * (job[0].hourly_rate),
//                                     ot_hour: Math.round(((round_hr - 40) + Number.EPSILON) * 100) / 100, //(round_hr - 40),
//                                     ot_rate: job[0].markup_price, //rate ot
//                                     ot_amount: Math.round((((round_hr - 40) * (job[0].markup_price)) + Number.EPSILON) * 100) / 100, // ((round_hr - 40) * (item.markup_price)),
//                                     amount: Math.round((((40 * (job[0].hourly_rate)) + ((round_hr - 40) * (job[0].markup_price))) + Number.EPSILON) * 100) / 100, //((40 * (item.hourly_rate)) + ((round_hr - 40) * (item.markup_price)))
//                                 }
//                                 total_amount += Math.round((((40 * (job[0].hourly_rate)) + ((round_hr - 40) * (job[0].markup_price))) + Number.EPSILON) * 100) / 100 //(40 * (item.hourly_rate)) + ((round_hr - 40) * (item.markup_price));
//                                 array.push(obj);
//                             } else {
//                                 obj = {
//                                     job_id: d.job_id,
//                                     seeker_id: d.seeker_id,
//                                     seeker_name: d.first_name + " " + d.last_name,
//                                     regular_hour: round_hr,
//                                     regular_rate: job[0].hourly_rate,
//                                     regular_amount: round_hr * (job[0].hourly_rate),
//                                     ot_hour: 0,
//                                     ot_rate: 0, //rate ot
//                                     ot_amount: 0,
//                                     amount: round_hr * (job[0].hourly_rate)
//                                 }
//                                 total_amount += (round_hr * (job[0].hourly_rate))
//                                 array.push(obj);
//                             }
//                         })

//                         new Promise((resolve) => {
//                             setTimeout(() => {
//                                 resolve(array);
//                             }, 1000)
//                         }).then((response) => {

//                             var regular_hour = response.reduce(function(cnt, o) { return cnt + o.regular_hour; }, 0);
//                             var ot_hour = response.reduce(function(cnt, o) { return cnt + o.ot_hour; }, 0);

//                             var data = {
//                                 total_hour: [{
//                                     total_hour: Math.round(((regular_hour + ot_hour) + Number.EPSILON) * 100) / 100
//                                 }],
//                                 total_pay_scale: [{
//                                     total_pay_scale: response.reduce(function(cnt, o) { return cnt + o.amount; }, 0)
//                                 }],
//                                 job: job,
//                                 data: response
//                             }
//                             console.log("data ====>", data);
//                             var ammountt = response.reduce(function(cnt, o) { return cnt + o.amount; }, 0);

//                             ejs.toHTML('/var/www/html/projects/rockstaffing/templates/index.ejs', data).then(function(html) {
//                                 var options = { format: 'Letter' };
//                                 var output = '/var/www/html/projects/rockstaffing/uploads/invoice/pdf_' + moment().format('YYYYMMDDHHmmSS') + '.pdf'

//                                 pdf.toPDF(html, options, output).then(function(response) {
//                                     console.log("PDF file successfully written ===>", response);
//                                     var file = fs.readFileSync(response.filename).toString("base64");
//                                     // console.log("file ===>", file);
//                                     var attachment = [{
//                                         content: file,
//                                         filename: 'invoice.pdf',
//                                         type: "application/pdf",
//                                         disposition: "attachment"
//                                     }];

//                                     // common_function.sendEmailWithAttachment('tom@rockstaffing.com', 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);
//                                     // common_function.sendEmailWithAttachment(job[0].email, 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);
//                                     common_function.sendEmailWithAttachment('singhak671@gmail.com', 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);

//                                     // update invoiceGenerate=1 when create invoice
//                                     mysql.connection.query('Update tab_jobs set isInvoiceGenerate=? where job_id=?', [1, job_id], (err, update_status) => {
//                                         if (err) {
//                                             // console.log("Error found while update status of invoice generate.")
//                                             res.json({ status: 500, msg: "Error found while update invoice generate." })
//                                         } else {
//                                             // console.log("Successfully update the invoice status.")
//                                             // res.json({ status: 200, msg: "Successfully generated the invoice." })

//                                             mysql.connection.query('insert into tab_invoice set job_id=?,user_id=?,amount=?,payment_type=?,invoice=?', [job_id, user_id, ammountt, 2, 'http://178.62.83.145:2000/uploads/invoice/' + 'pdf_' + moment().format('YYYYMMDDHHmmSS') + '.pdf'], (err, save) => {
//                                                 if (err) {
//                                                     res.json({ status: 500, msg: "Internal server error.", err: err })
//                                                 } else {
//                                                     // res.json({ status: 200, msg: "Successfully approved." })
//                                                     // res.json({ status: 200, msg: "Successfully charge created" })
//                                                     // 28 July  
//                                                     mysql.connection.query('update tab_users set payment_status=?,payment_type=? where user_id=?', [0, 2, user_id], (err, updated) => {
//                                                         if (err) {
//                                                             res.json({ status: 500, msg: "Internal server error.", err: err })
//                                                         } else {
//                                                             res.json({ status: 200, msg: "Successfully generated the invoice.", file: 'pdf_' + moment().format('YYYYMMDDHHmmSS') + '.pdf' })
//                                                         }
//                                                     })
//                                                 }
//                                             })
//                                         }
//                                     })
//                                 }, function(error) {
//                                     // console.error(error);
//                                     res.json({ status: 500, msg: "Something went wrong." })
//                                 });
//                             }, function(error) {
//                                 // console.error(error);
//                                 res.json({ status: 500, msg: "Opps! something went wrong.", err3: error })
//                             });

//                         }).catch((error) => {
//                             // console.log("Something went wrong.")
//                             res.json({ status: 500, msg: "Opps! something went wrong.", err4: error })

//                         })
//                     }
//                 })
//                 // })
//         }
//     })
// }



const create_invoice = async(req, res) => {

    // const { user_id, job_id } = req.body;
    const { job_id } = req.body;

    var user_id = req.decoded.user_id; // provider id
    var sql = "SELECT A.*,B.first_name,B.last_name,B.device_token,B.email,C.name,C.addressline1,C.addressline2,C.city,C.state,C.zipcode,C.zone,D.skill,(SELECT price from tab_markup_price) As markup_price FROM tab_jobs A LEFT JOIN tab_users B ON A.user_id = B.user_id LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN tab_skills D ON D.id=A.category WHERE A.job_id=? and A.user_id=?";

    mysql.connection.query(sql, [job_id, user_id], (err, job) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (job.length == 0) {
            res.json({ status: 500, msg: "No job founded." })
        } else {
            var sql1 = 'SELECT tab_approve_seeker.job_id,tab_approve_seeker.seeker_id,tab_users.first_name,tab_users.last_name, SUM(tab_approve_seeker.hour) AS total_hour,SUM(tab_approve_seeker.approval_hour) AS total_approval_hour,SUM(tab_approve_seeker.minute) AS total_min,SUM(tab_approve_seeker.approval_min) AS total_approval_min,SUM(tab_approve_seeker.pay_scale) AS total_payment, SUM(tab_approve_seeker.approval_payment) AS total_approval_payment FROM `tab_approve_seeker` LEFT JOIN tab_users ON tab_approve_seeker.seeker_id=tab_users.user_id WHERE tab_approve_seeker.job_id=? GROUP BY tab_approve_seeker.job_id,tab_approve_seeker.seeker_id'
            mysql.connection.query(sql1, [job_id], (err, seeker_list) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", err2: err })
                } else if (seeker_list.length == 0) {
                    res.json({ status: 500, msg: "No seeker founded." })
                } else {
                    var array = [];
                    async.forEachOf(seeker_list, (d, i) => {
                        var hour = parseFloat(d.total_approval_hour) + parseFloat(((d.total_approval_min) / 60))
                        var round_hr = Math.round((hour + Number.EPSILON) * 100) / 100
                        var obj;
                        var total_amount = 0;
                        if (round_hr >= 40) {
                            obj = {
                                job_id: d.job_id,
                                seeker_id: d.seeker_id,
                                seeker_name: d.first_name + " " + d.last_name,
                                regular_hour: 40,
                                regular_rate: job[0].hourly_rate,
                                regular_amount: 40 * (job[0].hourly_rate),
                                ot_hour: Math.round(((round_hr - 40) + Number.EPSILON) * 100) / 100, //(round_hr - 40),
                                ot_rate: job[0].markup_price, //rate ot
                                ot_amount: Math.round((((round_hr - 40) * (job[0].markup_price)) + Number.EPSILON) * 100) / 100, // ((round_hr - 40) * (item.markup_price)),
                                amount: Math.round((((40 * (job[0].hourly_rate)) + ((round_hr - 40) * (job[0].markup_price))) + Number.EPSILON) * 100) / 100, //((40 * (item.hourly_rate)) + ((round_hr - 40) * (item.markup_price)))
                            }
                            total_amount += Math.round((((40 * (job[0].hourly_rate)) + ((round_hr - 40) * (job[0].markup_price))) + Number.EPSILON) * 100) / 100 //(40 * (item.hourly_rate)) + ((round_hr - 40) * (item.markup_price));
                            array.push(obj);
                        } else {
                            obj = {
                                job_id: d.job_id,
                                seeker_id: d.seeker_id,
                                seeker_name: d.first_name + " " + d.last_name,
                                regular_hour: round_hr,
                                regular_rate: job[0].hourly_rate,
                                regular_amount: round_hr * (job[0].hourly_rate),
                                ot_hour: 0,
                                ot_rate: 0, //rate ot
                                ot_amount: 0,
                                amount: round_hr * (job[0].hourly_rate)
                            }
                            total_amount += (round_hr * (job[0].hourly_rate))
                            array.push(obj);
                        }
                    })

                    new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(array);
                        }, 1000)
                    }).then((response) => {

                        var regular_hour = response.reduce(function(cnt, o) { return cnt + o.regular_hour; }, 0);
                        var ot_hour = response.reduce(function(cnt, o) { return cnt + o.ot_hour; }, 0);
                        const html = fs.readFileSync('./templates/index.html', 'utf8');
                        const options = {
                            format: "A3",
                            orientation: "portrait",
                            border: "10mm",
                        }
                        const jobDetails = {
                            jobTitle: job[0].job_title,
                            jobProvider: job[0].first_name + " " + job[0].last_name,
                            jobLocation: job[0].name + "," + job[0].addressline1 + "," + job[0].addressline2 + "," + job[0].city + "," + job[0].state + "," + job[0].zipcode,
                            startDate: job[0].start_date,
                            endDate: job[0].end_date
                        }

                        let subTotal = 0.0;
                        let totalTime = 0.0;

                        const employeesData = [];

                        response.forEach(e => {
                            const employee = {
                                employeeName: e.seeker_name,
                                regularHour: e.regular_hour,
                                regularRate: e.regular_rate,
                                regularAmount: e.regular_amount,
                                otHour: e.ot_hour,
                                otRate: e.ot_rate,
                                otAmount: e.ot_amount,
                                amount: e.amount
                            };
                            employeesData.push(employee);
                        });

                        const headerData = {
                            date: moment(new Date()).format('DD/ MM/ YYYY'),
                            invoiceNo: cryptoRandomString({ length: 6 }),
                            totalTime: totalTime + Math.round(((regular_hour + ot_hour) + Number.EPSILON) * 100) / 100,
                            amount: subTotal + response.reduce(function(cnt, o) { return cnt + o.amount; }, 0)
                        };

                        const document = {
                            html: html,
                            data: {
                                headerData: headerData,
                                jobDetails: jobDetails,
                                employeesData: employeesData,
                                subTotal: subTotal + response.reduce(function(cnt, o) { return cnt + o.amount; }, 0)
                            },
                            path: './uploads/invoice/pdf_' + moment().format('YYYYMMDDHHmmSS') + '.pdf'
                        };
                        var ammountt = response.reduce(function(cnt, o) { return cnt + o.amount; }, 0);

                        pdf.create(document, options)
                            .then(pdf_generate => {
                                console.log("invoice generated ==>", pdf_generate)
                                var file = fs.readFileSync(pdf_generate.filename).toString("base64");
                                var attachment = [{
                                    content: file,
                                    filename: 'invoice.pdf',
                                    type: "application/pdf",
                                    disposition: "attachment"
                                }];
                                // common_function.sendEmailWithAttachment('tom@rockstaffing.com', 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);
                                // common_function.sendEmailWithAttachment(job[0].email, 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);
                                common_function.sendEmailWithAttachment('singhak671@gmail.com', 'Rock staffing : Invoive attachment', 'Rock staffing', attachment);

                                // update invoiceGenerate=1 when create invoice
                                mysql.connection.query('Update tab_jobs set isInvoiceGenerate=? where job_id=?', [1, job_id], (err, update_status) => {
                                    if (err) {
                                        res.json({ status: 500, msg: "Error found while update invoice generate." })
                                    } else {
                                        mysql.connection.query('insert into tab_invoice set job_id=?,user_id=?,amount=?,payment_type=?,invoice=?,invoice_number=?', [job_id, user_id, ammountt, 2, 'http://178.62.83.145:2000/uploads/invoice/' + 'pdf_' + moment().format('YYYYMMDDHHmmSS') + '.pdf', cryptoRandomString({ length: 6 })], (err, save) => {
                                            if (err) {
                                                res.json({ status: 500, msg: "Internal server error.", err: err })
                                            } else {
                                                mysql.connection.query('update tab_users set payment_status=?,payment_type=? where user_id=?', [0, 2, user_id], (err, updated) => {
                                                    if (err) {
                                                        res.json({ status: 500, msg: "Internal server error.", err: err })
                                                    } else {
                                                        res.json({ status: 200, msg: "Successfully generated the invoice.", file: 'pdf_' + moment().format('YYYYMMDDHHmmSS') + '.pdf' })
                                                    }
                                                })
                                            }
                                        })
                                    }
                                })
                            }).catch(error => {
                                console.error("error found while generate invoice", error)
                            })
                    }).catch((error) => {
                        // console.log("Something went wrong.")
                        res.json({ status: 500, msg: "Opps! something went wrong.", err4: error })
                        console.log("Opps! something went wrong. ==>", error)
                    })
                }
            })
        }
    })
}


//================================= API for delete job before starting ============================

const delete_job_before_start = async(req, res) => {

    const { job_id } = req.body;
    const user_id = req.decoded.user_id;
    var sql = "select * from tab_log where job_id=?";
    mysql.connection.query(sql, [job_id], (err, time_logged_list) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (time_logged_list.length > 0) {
            mysql.connection.query('Update tab_jobs set isCompleted=?,visibility=? where job_id=? AND user_id=?', [0, 0, job_id, user_id], (err, delete_job) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else {
                    // complete job (status =3) for progress bar
                    mysql.connection.query('update tab_users set progress_bar_status=?,progress_bar_job_id=? where user_id=?', [0, job_id, user_id], (err, update_progress_bar) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else {
                            mysql.connection.query('select * from tab_booking where job_id=?', [job_id], (err, booking_list) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error." })
                                } else if (booking_list.length == 0) {
                                    res.json({ status: 500, msg: "No booking found." })
                                } else {
                                    async.forEachOf(booking_list, (item, index) => {
                                        mysql.connection.query('update tab_users set progress_bar_status=?,progress_bar_job_id=? where user_id=?', [0, job_id, item.seeker_id], (err, update_progress_bar) => {
                                            if (err) {
                                                console.log("Internal server error.")
                                            } else {
                                                console.log("Updated.")
                                            }
                                        })
                                    })
                                }
                            })
                            res.json({ status: 200, msg: "Successfully your job has been completed." })
                        }
                    })
                }
            })
        } else {
            var sql1 = "select * from tab_clock_in_clock_out where job_id=?";
            mysql.connection.query(sql1, [job_id], (err, check_clock_in) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (check_clock_in.length > 0) {
                    mysql.connection.query('Update tab_jobs set isCompleted=?,visibility=? where job_id=? AND user_id=?', [0, 0, job_id, user_id], (err, delete_job) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else {
                            // complete job (status =3) for progress bar
                            mysql.connection.query('update tab_users set progress_bar_status=?,progress_bar_job_id=? where user_id=?', [0, job_id, user_id], (err, update_progress_bar) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error." })
                                } else {
                                    mysql.connection.query('select * from tab_booking where job_id=?', [job_id], (err, booking_list) => {
                                        if (err) {
                                            res.json({ status: 500, msg: "Internal server error." })
                                        } else if (booking_list.length == 0) {
                                            res.json({ status: 500, msg: "No booking found." })
                                        } else {
                                            async.forEachOf(booking_list, (item, index) => {
                                                mysql.connection.query('update tab_users set progress_bar_status=?,progress_bar_job_id=? where user_id=?', [0, job_id, item.seeker_id], (err, update_progress_bar) => {
                                                    if (err) {
                                                        console.log("Internal server error.")
                                                    } else {
                                                        console.log("Updated.")
                                                    }
                                                })
                                            })
                                        }
                                    })
                                    res.json({ status: 200, msg: "Successfully your job has been completed." })
                                }
                            })
                        }
                    })
                } else {
                    res.json({ status: 500, msg: "You can't complete this job." })
                }
            })
        }
    })
}

module.exports = {
    signup,
    login,
    forget_password,
    get_profile,
    long_term_job,
    add_address,
    add_job_category,
    job_category_list,
    save_work_now,
    add_equipment,
    equipments,
    add_skill,
    skills,
    get_wok_now_job,
    get_long_term_job,
    job_lists,
    update_profile,
    upload,
    add_quiz,
    quiz_response,
    quiz_list,
    delete_job_post,
    update_background_check,
    update_drugtest_check,
    category,
    sub_category,
    quiz_score,
    address_lists,
    change_password,
    logout,
    notification_lists,
    contact_us,
    apply_job,
    repost_work_post_job,
    filter_job,
    profile,
    update_distance,
    change_status,
    repost_long_term_job,
    find_no_people,
    find_no_people_manual,
    get_location,
    job_detail,
    update_device_token,
    select_seeker,
    confirm_booking,
    find_people,
    global_search,
    save_rating,
    verifyLink,
    log_start,
    check_approval,
    delete_notification,
    clear_notification,
    notification_remove,
    provider_update_profile,
    create_payment,
    log_list,
    notification_count,
    update_notification_status,
    get_distance,
    update_work_location,
    job_application_status,
    job_journey_date,
    job_journey,
    job_completion,
    complete_job,
    change_seeker,
    approve_seeker,
    show_seeker_rating,
    find_no_people_long_term_job,
    users,
    jobs,
    recent_users,
    change_status_automatic,
    seeker_list,
    provider_list,
    upadte_seeker_profile,
    upadte_provider_profile,
    delete_user,
    replace_seeker,
    save_step,
    long_term_job_list,
    work_now_job_list,
    delete_job,
    skill_category,
    category_skill,
    sub_category_skill,
    add_sub_category,
    update_subcategory,
    update_skill_category,
    update_skill_status,
    invoice_detail,
    update_admin_profile,
    invoice_permit,
    seekers,
    providers,
    send_notification,
    show_notification,
    send_email,
    add_user,
    verifyAccount,
    rate_now,
    generate_invoice,
    start_clock_in,
    view_profile,
    get_url,
    update_url,
    job_calender,
    seeker_earning,
    seeker_job_calender,
    job_detail_calender,
    check_running_job,
    job_finished,
    check_progress_bar_status,
    update_progress_bar,
    get_markup_price,
    edit_markup_price,
    previous_job,
    provider_previous_job,
    job_detail_on_previous_job,
    testing,
    create_invoice,
    delete_job_before_start
}
