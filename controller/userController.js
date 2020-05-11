const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config')();
const mysql = require('../database/db');
const common_function = require('../common_function/function');
const multer = require('multer');
const path = require('path');
var cron = require('node-cron');
// var Distance = require('geo-distance');
const geolib = require('geolib');
const url = 'http://178.62.83.145:2000/api/v1';

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

    const { first_name, last_name, email, company_name, password, confirm_password, category_id, category_name, skill_id, skills, ssn, dob, role_id } = req.body;

    await userRegistration();


    /* Function for register 
       job seeker or provider

    */

    const host = req.hostname;
    var url = req.protocol + "://" + host + ":2000" + "/";

    function userRegistration() {

        var filePath = '';
        var mimetype = '';

        if (req.file == undefined) {
            filePath = '1585744787763-check.png';
            mimetype = 'image/png';
        } else {
            filePath = req.file.path;
            mimetype = req.file.mimetype;
        }

        if (password != confirm_password) {
            res.json({ status: 409, msg: "Password and Confirm password does'nt match." })
        } else {

            var role = '';
            var isCompleteProfile = '';

            if (role_id == 1) { // 1=> job provider and 2 => job seeker and 3 => admin

                role = 1;
                isCompleteProfile = 1;

            } else if (role_id == 2) {
                role = 2;
                isCompleteProfile = 0;

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

                    mysql.connection.query('insert into tab_users SET first_name =?,last_name =?,email =?,company_name=?, password =?, skill_id = ?,skills=?,category_id=?,category_name=?, ssn =?, dob=?,role_id =?,isCompleteProfile=?,profile_pic =?,verification_code=?',

                        [first_name, last_name, email, company_name, hash, skill_id, skills, category_id, category_name, ssn, dob, role, isCompleteProfile, url + filePath, code], (err, save_data) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error.", err: err })
                            } else {

                                var link = `http://178.62.83.145:2000/api/v1/verifyLink/${save_data.insertId}/${code}`;

                                let msg = '<div>Dear ' + first_name + ' ' + last_name + ',';
                                msg += '<p>Thank you for joining Rock Staff family. We hope you have a great experience and recommend us to your friends and family.</p><br></div>';
                                msg += '<div><p>Please verify your Email by given below link.</p></div>';
                                msg += `${link}`;
                                msg += '<div><p>Sincerely,</p><br><p>Rock Staffing Team</p></div>'
                                common_function.sendEmail(email, 'Rock staffing : Verify Email', 'Rock staffing', msg); //send message on registerd email address
                                res.json({ status: 200, msg: "Successfully register." })
                            }
                        })
                }
            })
        }
    }
}



//----------------------------------------------- API for login Job provider / seeker ------------------------------------------------------

const login = async(req, res) => {

    const { email, password, role_id, lat, long, device_type, device_token } = req.body;

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
            }

            mysql.connection.query('select * from tab_users where email =? and role_id =?', [email, role], (err, user) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else if (user.length == 0) {
                    res.json({ status: 409, msg: "You entered wrong Email ID." })
                } else {
                    var match = bcrypt.compareSync(password, user[0].password);
                    if (match == true) {

                        var token = jwt.sign({
                            user_id: user[0].user_id,
                            email: user[0].email
                        }, config.secret_key, { expiresIn: 86400 })

                        mysql.connection.query('Update tab_users set token =?,lat=?,lng=?,device_type=?,device_token=? where user_id =?', [token, lat, long, device_type, device_token, user[0].user_id], (err, update_token) => {
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
                                    "skill_id": user[0].skill_id,
                                    "skills": user[0].skills,
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
                                    "token": token
                                }
                                res.json({ status: 200, msg: "Successfully login.", data: obj })
                            }
                        })
                    } else {
                        res.json({ status: 400, msg: "You entered wrong password." })
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
                            res.json({ status: 500, msg: "Internal server    error." })
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

    // const { req.decoded } = req.body;
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
                    res.json({ status: 200, msg: "User found successfully.", data: user[0] })

                    // mysql.connection.query('select * from tab_skills ', (err, list) => {
                    //     if (err) {
                    //         res.json({ status: 200, msg: "User found successfully.", data: user[0] })
                    //     } else {
                    //         res.json({ status: 200, msg: "User found successfully.", data: user[0], skill: list })
                    //     }
                    // })
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
                mysql.connection.query('select * from tab_users where role_id=2 and isCompleteProfile=1 and skill_id=?', [category], (err, user_list) => {
                    if (err) {
                        console.log("Notification is not sent")
                    } else {
                        for (var i = 0; i < user_list.length; i++) {

                            var ttl = 'New job posts.'; //title
                            var text = `${title}.`; //body
                            var data = { //data
                                job_id: save_job.insertId, //job_id
                                sender_id: user_id, //seeker provider user id
                                receiver_id: user_list[i].user_id,
                                lat: lat,
                                long: long
                            }

                            common_function.send_push_notification(user_list[i].device_token, ttl, text, data);

                            mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?', [save_job.insertId, user_list[i].user_id, text, lat, long, 0, user_list[i].distance], (err, save_notification) => {
                                if (err) {
                                    console.log('Error found in save notification.')
                                } else {
                                    console.log('Save Notifications into DB.')
                                }
                            })
                        }
                    }
                })
                res.json({ status: 200, msg: "Successfully save long term job." })
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

        mysql.connection.query('Insert into tab_jobs set user_id =?, category =?, location =?,lat =?,lng =?, job_title =?,job_type =?,start_date =?, end_date =?,start_time =?,end_time =?, equipment =?, hourly_rate =?,worker_selection =?,address =?,no_of_opening =?', [user_id, category, location, lat, long, title, 1, start_date, end_date, start_time, end_time, equipment, hourly_rate, worker_selection, address, no_of_opening], (err, save_job) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error.", err: err })
            } else {
                mysql.connection.query('select * from tab_users where role_id=2 and isCompleteProfile=1 and skill_id=?', [category], (err, user_list) => {
                    if (err) {
                        console.log("Error found.")
                    }
                    //  else if (user_list.length == 0) {
                    //     console.log("No seeker found.")
                    //         // res.json({ status: 404, msg: " " })
                    // } 
                    else {
                        for (var i = 0; i < user_list.length; i++) {

                            var ttl = 'New job posts.'; //title
                            var text = `${title}.`; //body
                            var data = { //data
                                job_id: save_job.insertId, //job_id
                                sender_id: user_id, //seeker provider user id
                                receiver_id: user_list[i].user_id,
                                lat: lat,
                                long: long
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

                            console.log('job location', job);
                            console.log('user location', user_list[i].user_id, user)


                            var distance = geolib.getDistance(job, user);
                            var d = distance / 1000;
                            console.log('diffrence', d)


                            if (d <= Number(user_list[i].distance)) {

                                common_function.send_push_notification(user_list[i].device_token, ttl, text, data);

                                mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?', [save_job.insertId, user_list[i].user_id, text, lat, long, 1, user_list[i].distance], (err, save_notification) => {
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
    }
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

    const { skill_name } = req.body;

    await addSkill();

    function addSkill() {

        if (!skill_name) {
            res.json({ status: 422, msg: "Skill name is required." })
        } else {
            mysql.connection.query('Insert into tab_skills set skill =?', [skill_name], (err, save_skill) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error." })
                } else {
                    res.json({ status: 200, msg: "Successfully added skill." })
                }
            })
        }
    }
}

//----------------------------------------------------- API for get skill lists --------------------------------------------------------

const skills = async(req, res) => {

    await skillLists();

    function skillLists() {

        // var sql = "SELECT Cat.id as supercat_id, Cat.skill as supercat, Subcat.id as subcate_id, Subcat.skill as subcate FROM tab_skills AS Cat LEFT JOIN tab_skills AS Subcat ON (Cat.id=Subcat.parent_id) WHERE Cat.parent_id=0"

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

        //   var sql = "SELECT job_id,tab_jobs.user_id, category, location,lat,lng,job_title,job_type,posted_date,hourly_rate,address,start_date,end_date,start_time,end_time,equipment,worker_selection,no_of_opening,visibility,created_at, name,addressline1,addressline2,city,state,zipcode,zone FROM `tab_jobs`, `tab_address` WHERE tab_jobs.address = tab_address.id and tab_jobs.job_type=1 and visibility =1 Order by tab_jobs.job_id DESC";

        //  var sql = "SELECT job_id,tab_jobs.user_id, category, location,lat,lng,job_title,job_type,posted_date,hourly_rate,address,start_date,end_date,start_time,end_time,equipment,worker_selection,no_of_opening,visibility,tab_jobs.created_at, name,addressline1,addressline2,city,state,zipcode,zone, tab_users.profile_pic FROM `tab_jobs`, `tab_address`, `tab_users` WHERE tab_jobs.address = tab_address.id and tab_jobs.job_type=1 and visibility =1 and tab_jobs.user_id= tab_users.user_id Order by tab_jobs.job_id DESC"

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

        //   var sql = "SELECT job_id,tab_jobs.user_id, category, location,lat,lng,job_title,job_type,posted_date,hourly_rate,address,start_date,end_date,start_time,end_time,equipment,worker_selection,no_of_opening,visibility,created_at, name,addressline1,addressline2,city,state,zipcode,zone FROM `tab_jobs`, `tab_address` WHERE tab_jobs.address = tab_address.id and tab_jobs.job_type=0 and visibility =1 Order by tab_jobs.job_id DESC";

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

        // var sql = "SELECT job_id, category, location,lat,lng,job_title,job_type,posted_date,hourly_rate,address,start_date,end_date,start_time,end_time,equipment,worker_selection,no_of_opening,visibility,name,addressline1,addressline2,city,state,zipcode,zone FROM `tab_jobs`, `tab_address` WHERE tab_jobs.address = tab_address.id";

        // var sql = "SELECT job_id,tab_jobs.user_id, category, location,tab_jobs.lat,tab_jobs.lng,job_title,job_type,posted_date,hourly_rate,address,start_date,end_date,start_time,end_time,equipment,worker_selection,no_of_opening,visibility,tab_jobs.created_at, name,addressline1,addressline2,city,state,zipcode,zone,tab_users.profile_pic FROM `tab_jobs`, `tab_address`,`tab_users` WHERE tab_jobs.address = tab_address.id and tab_jobs.job_type=? and tab_jobs.user_id =? and tab_jobs.user_id=tab_users.user_id  Order by tab_jobs.job_id DESC";

        var sql = 'SELECT A.*,B.name,B.addressline1,B.addressline2,B.city,B.state,B.zipcode,B.zone,C.profile_pic,D.skill AS sub_category,E.skill AS category FROM tab_jobs A LEFT JOIN tab_address B ON B.id=A.address LEFT JOIN tab_users C ON C.user_id = A.user_id LEFT JOIN tab_skills D ON D.id=A.category LEFT JOIN tab_skills E ON E.id = D.parent_id WHERE A.user_id =? AND A.job_type=? ORDER BY job_id DESC'
            // if (job_type && user_id) {
        mysql.connection.query(sql, [user_id, job_type], (err, result) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error.", err: err })
            } else if (result.length == 0) {
                res.json({ status: 404, msg: "No data found.", data: result })
            } else {
                res.json({ status: 200, msg: "Data found successfully.", data: result })
            }
        })

        // } else {

        //     var sql1 = "SELECT job_id,tab_jobs.user_id, category, location,lat,lng,job_title,job_type,posted_date,hourly_rate,address,start_date,end_date,start_time,end_time,equipment,worker_selection,no_of_opening,visibility,created_at, name,addressline1,addressline2,city,state,zipcode,zone FROM `tab_jobs`, `tab_address` WHERE tab_jobs.address = tab_address.id AND tab_jobs.job_type=? and visibility =? Order by tab_jobs.job_id DESC"

        //     mysql.connection.query(sql1, [job_type, 1], (err, result) => {
        //         if (err) {
        //             res.json({ status: 500, msg: "Internal server error." })
        //         } else if (result.length == 0) {
        //             res.json({ status: 404, msg: "No data found.", data: result })
        //         } else {
        //             res.json({ status: 200, msg: "Data found successfully.", data: result })
        //         }
        //     })

        // }

    }
}


//====================================== API for update profile ============================================================

const update_profile = async(req, res) => {

    const { user_id, first_name, last_name, email, distance, background_check, category_id, category_name, skill_id, skill, drug_test, company_name } = req.body;
    // var user_id = req.decoded.user_id;

    const host = req.hostname;
    var url = req.protocol + "://" + host + ":2000" + "/";

    await updateProfile();

    function updateProfile() {

        var filePath = '';
        var mimetype = '';
        var new_email = '';

        if (req.file == undefined) {

            mysql.connection.query('select * from tab_users where email =?', [email], (err, user) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", error1: err })
                } else if (user.length == 0) {

                    new_email = email;


                    mysql.connection.query('update tab_users set first_name =?, last_name =?, email =?, distance =?, background_check =?,drug_test =?,profile_pic =?, type =?,company_name =?,skill_id =?,skills=?,category_id=?,category_name=? where user_id =?', [first_name, last_name, new_email, distance, background_check, drug_test, user[0].profile_pic, user[0].mimetype, company_name, skill_id, skill, category_id, category_name, user_id], (err, update) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", error2: err })
                        } else {
                            res.json({ status: 200, msg: "Successfully updated profile." })
                        }
                    })

                } else {
                    if (user[0].user_id == user_id) {
                        new_email = user[0].email;

                        mysql.connection.query('update tab_users set first_name =?, last_name =?, email =?, distance =?, background_check =?,drug_test =?,profile_pic =?, type =?,company_name=?,skill_id=?,skills=?,category_id=?,category_name=? where user_id =?', [first_name, last_name, new_email, distance, background_check, drug_test, user[0].profile_pic, user[0].mimetype, company_name, skill_id, skill, category_id, category_name, user_id], (err, update) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error.", error3: err })
                            } else {
                                res.json({ status: 200, msg: "Successfully updated profile." })
                            }
                        })
                    } else {
                        res.json({ status: 409, msg: "Email already exists." })
                    }
                }
            })
        } else {
            filePath = req.file.path;
            mimetype = req.file.mimetype;

            mysql.connection.query('select * from tab_users where email =?', [email], (err, user) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", error1: err })
                } else if (user.length == 0) {

                    new_email = email;

                    mysql.connection.query('update tab_users set first_name =?, last_name =?, email =?, distance =?, background_check =?,drug_test =?,profile_pic =?, type =?,company_name =?,skill_id=?,skills=?,category_id=?,category_name=? where user_id =?', [first_name, last_name, new_email, distance, background_check, drug_test, url + filePath, mimetype, company_name, skill_id, skill, category_id, category_name, user_id], (err, update) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", error2: err })
                        } else {
                            res.json({ status: 200, msg: "Successfully updated profile." })
                        }
                    })

                } else {
                    if (user[0].user_id == user_id) {
                        new_email = user[0].email;

                        mysql.connection.query('update tab_users set first_name =?, last_name =?, email =?, distance =?, background_check =?,drug_test =?,profile_pic =?, type =?,company_name=?,skill_id=?,skills=?,category_id=?,category_name=? where user_id =?', [first_name, last_name, new_email, distance, background_check, drug_test, url + filePath, mimetype, company_name, skill_id, skill, category_id, category_name, user_id], (err, update) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error.", error3: err })
                            } else {
                                res.json({ status: 200, msg: "Successfully updated profile." })
                            }
                        })
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
                res.json({ status: 200, msg: "Job post has been deleted successfully." })
            }
        })
    }
}

//================================================== API for update drug test and background check =======================================

const update_status = async(req, res) => {

    const { drug_test, background_check, user_id } = req.body;

    await updateDrugtestAndBackgroundCheck();

    function updateDrugtestAndBackgroundCheck() {

        mysql.connection.query('update tab_users set drug_test =?, background_check =? where user_id =?', [drug_test, background_check, user_id], (err, result) => {
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

    mysql.connection.query('select * from tab_skills where parent_id=0', (err, result) => {

        if (err) {
            res.json({ status: 500, msg: "Internal server error." })
        } else if (result.length == 0) {
            res.json({ status: 404, msg: "No data found." })
        } else {
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

    // const { user_id } = req.body;
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

    // const { user_id } = req.body;
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
    // console.log('user_id ==>', user_id);

    mysql.connection.query('select * from tab_notification where user_id =? Order By id Desc', [user_id], (err, list) => {
        if (err) {
            // reject("Internal server error.")
            res.json({ status: 500, msg: "Internal server error." })
        } else if (list.length == 0) {
            // resolve("No data found.")
            res.json({ status: 404, msg: "No data found." })

        } else {
            // resolve("Notification lists founded.")
            res.json({ status: 200, msg: "Notifications founded.", data: list, count: list.length })

        }
    })

    // new Promise((resolve, reject) => {

    //     mysql.connection.query('select * from tab_notification where user_id =?', [user_id], (err, list) => {
    //         if (err) {
    //             reject("Internal server error.")
    //         } else if (list.length == 0) {
    //             resolve("No data found.")
    //         } else {
    //             resolve("Notification lists founded.")
    //         }
    //     })
    // }).then((result) => {
    //     res.json({ status: 200, msg: result, data: list })
    // }).catch((error) => {
    //     res.json({ status: 400, msg: error })
    // })
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
                    res.json({ status: 404, msg: "No job founded." })
                } else {

                    mysql.connection.query('select * from tab_users where user_id=? and isCompleteProfile=1', [user_id], (err, user) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else if (user.length == 0) {
                            res.json({ status: 404, msg: "No user founded." })
                        } else {

                            mysql.connection.query('insert into tab_job_apply set user_id =? , job_id =?', [user_id, job_id], (err, result) => {
                                if (err) {
                                    res.json({ status: 500, msg: "Internal server error.", err: err })
                                } else {

                                    var title = `${user[0].first_name} ${user[0].last_name} applied for this ${job[0].job_title} job post.`;
                                    var text = `${job[0].skill}`;
                                    var data = { //data
                                        job_id: job_id, //job_id
                                        sender_id: job[0].user_id, //seeker provider user id
                                        receiver_id: user_id // provider id
                                    }
                                    common_function.send_push_notification(user[0].device_token, title, text, data);

                                    mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?', [job_id, user[0].user_id, title, job[0].lat, job[0].lng, 0, user[0].distance], (err, save_notification) => {
                                        if (err) {
                                            console.log('Error found in save notification.')
                                        } else {
                                            res.json({ status: 200, msg: "Successfully applied job." })

                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            })

            // if (req.body.status == "1") { // 1 Apply jobs or accept job for long term
            // mysql.connection.query('insert into tab_job_apply set user_id =? , job_id =?', [user_id, job_id], (err, result) => {
            //     if (err) {
            //         res.json({ status: 500, msg: "Internal server error.", err: err })
            //     } else {
            //         res.json({ status: 200, msg: "Successfully applied job." })
            //     }
            // })
            // } else if (req.body.status == "2") { // 2 for decline

            //     mysql.connection.query('delete from tab_notification where id=?', [req.body.notification_id], (err, delete_notification) => {
            //         if (err) {
            //             res.json({ status: 500, msg: "Internal server error.", err: err })
            //         } else {
            //             res.json({ status: 200, msg: "Successfully Deleted Notification." })
            //         }
            //     })

            // }
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
            sql = `SELECT A.*,D.apply_status,E.profile_pic, B.skill, B.parent_id, C.name, C.addressline1, C.addressline2, C.city, C.state, C.zipcode, C.zone FROM tab_jobs A  LEFT JOIN tab_job_apply D ON A.job_id = D.job_id AND D.user_id=? LEFT JOIN tab_users E ON E.user_id = A.user_id LEFT JOIN tab_skills B ON A.category = B.id LEFT JOIN tab_address C ON C.id = A.address WHERE B.skill LIKE '%${skill}%' AND visibility = 1 AND A.job_type =? ORDER BY ${sequence} `
                // console.log('keyword is blank ====>', sql);
        } else if (skill == '') {
            sql = `SELECT A.*,D.apply_status,E.profile_pic, B.skill, B.parent_id, C.name, C.addressline1, C.addressline2, C.city, C.state, C.zipcode, C.zone FROM tab_jobs A  LEFT JOIN tab_job_apply D ON A.job_id = D.job_id AND D.user_id=? LEFT JOIN tab_users E ON E.user_id = A.user_id LEFT JOIN tab_skills B ON A.category = B.id LEFT JOIN tab_address C ON C.id = A.address WHERE  A.job_title LIKE '%${keyword}%' AND visibility = 1 AND A.job_type =? ORDER BY ${sequence} `
                // console.log('skill is blank===>', sql)
        } else {
            sql = `SELECT A.*,D.apply_status,E.profile_pic, B.skill, B.parent_id, C.name, C.addressline1, C.addressline2, C.city, C.state, C.zipcode, C.zone FROM tab_jobs A  LEFT JOIN tab_job_apply D ON A.job_id = D.job_id AND D.user_id=? LEFT JOIN tab_users E ON E.user_id = A.user_id LEFT JOIN tab_skills B ON A.category = B.id LEFT JOIN tab_address C ON C.id = A.address WHERE B.skill LIKE '%${skill}%' OR A.job_title LIKE '%${keyword}%' AND visibility = 1 AND A.job_type =? ORDER BY ${sequence} `
                // console.log('skill and keyword is blank ===>', sql)

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

    // var token = req.body.token;

    // console.log('token ==>', req.body.token)
    // var data = verifyToken(token);
    // console.log('data ==>', req.decoded)


    console.log('' + Distance('50 km').human_readable('customary'));

    // https://www.latlong.net/place/oslo-norway-14195.html: Oslo, Norway, Latitude and longitude coordinates are: 59.911491, 10.757933
    var Oslo = {
        lat: 59.914,
        lon: 10.752
    };
    var Berlin = {
        lat: 52.523,
        lon: 13.412
    };
    var OsloToBerlin = Distance.between(Oslo, Berlin);

    console.log('OsloToBerlin ==>', OsloToBerlin)
    console.log('' + OsloToBerlin.human_readable());

    var distance = geolib.getDistance(Oslo, Berlin);


    console.log("geolib distance =====>", distance / 1000)



    const { job_id, user_id, skill_id } = req.body

}


// =========================================== API for Update distance  =================================================

const update_distance = async(req, res) => {

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

//========================================= APi for change status(accept/decline jobs)=============================

const change_status = async(req, res) => {
    const { job_id, notification_id, status } = req.body;

    var user_id = req.decoded.user_id; //job seeker user id

    await changeStatus();

    function changeStatus() {


        if (status == "1") { //accept

            mysql.connection.query('insert into tab_job_apply set user_id =? , job_id =?', [user_id, job_id], (err, result) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", err: err })
                } else {
                    mysql.connection.query('delete from tab_notification where id=?', [notification_id], (err, delete_notification) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", err: err })
                        } else {

                            // SELECT A.id, A.job_id, B.user_id, C.first_name, C.last_name, C.role_id, C.profile_pic, C.device_type, C.device_token FROM tab_job_apply A
                            // LEFT JOIN tab_jobs B ON B.job_id = A.job_id
                            // LEFT JOIN tab_users C ON C.user_id = B.user_id
                            // WHERE A.job_id = 86 AND A.user_id = 55
                            // var sql ='SELECT A.id, A.job_id, B.user_id, C.first_name, C.last_name, C.role_id, C.profile_pic, C.device_type, C.device_token FROM tab_job_apply A LEFT JOIN tab_jobs B ON B.job_id = A.job_id LEFT JOIN tab_users C ON C.user_id = B.user_id WHERE A.job_id = 86 AND A.user_id = 55';
                            //   var sql = 'SELECT A.id, A.job_id, B.user_id, C.first_name, C.last_name, C.role_id, C.profile_pic, C.device_type, C.device_token FROM tab_job_apply A LEFT JOIN tab_jobs B ON B.job_id = A.job_id LEFT JOIN tab_users C ON C.user_id = B.user_id WHERE A.job_id =? AND A.user_id =?'
                            var sql = 'SELECT A.id,D.first_name,D.last_name,D.profile_pic, A.job_id, B.user_id,B.job_title,C.role_id, C.device_type, C.device_token FROM tab_job_apply A LEFT JOIN tab_jobs B ON B.job_id = A.job_id LEFT JOIN tab_users C ON C.user_id = B.user_id LEFT JOIN tab_users D ON D.user_id=A.user_id WHERE A.job_id =? AND A.user_id =?'
                                //   mysql.connection.query(sql,[job_id,user_id], (err, user) => {
                                //     if (err) {
                                //         res.json({ status: 500, msg: "Internal server error.", err: err })
                                //     }
                                //     else {

                            //         var ttl = `user[0].first_name+''+ user[0].last_name + '' + has been accept the job.`;    //title
                            //         var text = `user[0].job_title.`; //body
                            //         var data = { //data
                            //             job_id: save_job.insertId, //job_id
                            //             sender_id: user_id, //seeker provider user id
                            //             receiver_id: user_list[0].user_id,
                            //             lat: lat,
                            //             long: long
                            //         }

                            //         common_function.send_push_notification(user_list[0].device_token, ttl, text, '');

                            // mysql.connection.query('insert into tab_notification set ')
                            res.json({ status: 200, msg: "Successfully Accepted job." })

                            //     }
                            // })
                        }
                    })
                }
            })
        } else if (status == "2") { //reject
            mysql.connection.query('delete from tab_notification where id=?', [notification_id], (err, delete_notification) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", err: err })
                } else {
                    res.json({ status: 200, msg: "Successfully Deleted Notification." })
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
                console.log("diffDays===>", diffDays)

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
            mysql.connection.query('select * from tab_jobs where job_id=? and user_id=? and job_type=0 and visibility=0', [job_id, user_id], (err, old_job) => {
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
                                    mysql.connection.query('select * from tab_users where role_id=2 and isCompleteProfile=1', (err, user_list) => {
                                        if (err) {
                                            console.log("Notification is not sent")
                                        } else {
                                            for (var i = 0; i < user_list.length; i++) {

                                                var ttl = 'New job posts.'; //title
                                                var text = `${job_title}.`; //body
                                                var data = { //data
                                                    job_id: save_new_job.insertId, //job_id
                                                    sender_id: user_id, //seeker provider user id
                                                    receiver_id: user_list[i].user_id,
                                                    lat: old_job[0].lat,
                                                    long: old_job[0].lng
                                                }

                                                common_function.send_push_notification(user_list[i].device_token, ttl, text, data);

                                                mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?', [save_new_job.insertId, user_list[i].user_id, text, old_job[0].lat, old_job[0].lng, 0, user_list[i].distance], (err, save_notification) => {
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

    if (!job_id || !user_id) {
        res.json({ status: 422, msg: "UserId and JobId both are required." })
    } else {
        mysql.connection.query('select * from tab_jobs where job_id=? and user_id=? and job_type=1 and visibility=0', [job_id, user_id], (err, old_job) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (old_job.length == 0) {
                res.json({ status: 500, msg: "No data found." })
            } else {

                var obj = [old_job[0].user_id, old_job[0].category, old_job[0].location, old_job[0].lat, old_job[0].lng, job_title, 1, start_date, end_date, start_time, end_time, old_job[0].equipment, old_job[0].worker_selection, old_job[0].hourly_rate, old_job[0].address, old_job[0].no_of_opening, 1];

                mysql.connection.query('Insert into tab_jobs set user_id=?,category=?,location=?,lat=?,lng=?,job_title=?,job_type=?,start_date=?,end_date=?,start_time=?,end_time=?,equipment=?,worker_selection=?,hourly_rate=?,address=?,no_of_opening=?,visibility=?', obj, (err, save_new_job) => {
                    if (err) {
                        res.json({ status: 500, msg: "Internal server error." })
                    } else {
                        mysql.connection.query('delete from tab_jobs where job_id=?', [job_id], (err, delete_old_job_post) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error." })
                            } else {
                                mysql.connection.query('select * from tab_users where role_id=2 and isCompleteProfile=1', (err, user_list) => {
                                    if (err) {
                                        console.log("Error found.")
                                    } else if (user_list.length == 0) {
                                        console.log("No seeker found.")
                                    } else {
                                        for (var i = 0; i < user_list.length; i++) {

                                            var ttl = 'New job posts.'; //title
                                            var text = `${job_title}.`; //body
                                            var data = { //data
                                                job_id: save_new_job.insertId, //job_id
                                                sender_id: user_id, //seeker provider user id
                                                receiver_id: user_list[i].user_id,
                                                lat: old_job[0].lat,
                                                long: old_job[0].lng
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

                                                mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?', [save_new_job.insertId, user_list[i].user_id, text, old_job[0].lat, old_job[0].lng, 1, user_list[i].distance], (err, save_notification) => {
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

//====================================== API for find number of peoples ========================================
const find_no_people = async(req, res) => {

    var user_id = req.decoded.user_id; // job provider id

    if (!user_id) {
        res.json({ status: 422, msg: "UserId is required." })
    } else {

        // var sql1 = "SELECT A.*,B.skill,C.skill As category FROM tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category LEFT JOIN tab_skills C ON C.id=B.parent_id WHERE A.job_id=?";

        var sql1 = "SELECT A.*,B.skill,C.skill As category, D.name,D.addressline1,D.addressline2,D.city,D.state,D.zipcode,D.zone FROM tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category LEFT JOIN tab_skills C ON C.id=B.parent_id LEFT JOIN tab_address D ON D.id=A.address WHERE A.job_id=?"
        mysql.connection.query(sql1, [req.body.job_id], (err, job_detail) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server error.", err1: err })
                } else if (job_detail.length == 0) {
                    res.json({ status: 200, msg: "Successfully found number of people who accepeted this job.", data: list, job_detail: job_detail })
                } else {
                    // res.json({ status: 200, msg: "Successfully found number of people who accepeted this job.", data: list, job_detail: job_detail })

                    var sql = "SELECT A.*,B.first_name,B.last_name,B.profile_pic FROM tab_job_apply A LEFT JOIN tab_users B ON A.user_id=B.user_id WHERE A.job_id=?";

                    // var sql = "SELECT A.*,B.first_name,B.last_name,B.profile_pic,D.name,D.addressline1,D.addressline2,D.city,D.state,D.zipcode,D.zone FROM tab_job_apply A LEFT JOIN tab_users B ON A.user_id=B.user_id LEFT JOIN tab_jobs C ON C.job_id=A.job_id LEFT JOIN tab_address D ON D.id=C.address WHERE A.job_id=?"

                    mysql.connection.query(sql, [req.body.job_id], (err, list) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error.", err2: err })
                        } else if (list.length == 0) {
                            res.json({ status: 200, msg: "No Seeker's found.", data: list, job_detail: job_detail })
                        } else {
                            res.json({ status: 200, msg: "Successfully found number of people who accepeted this job.", data: list, job_detail: job_detail })
                        }
                    })

                }
            })
            // var sql = "SELECT A.*,B.first_name,B.last_name,B.profile_pic FROM `tab_job_apply`A LEFT JOIN tab_users B ON A.user_id=B.user_id WHERE A.job_id=?";

        // mysql.connection.query(sql, [req.body.job_id], (err, list) => {
        //     if (err) {
        //         res.json({ status: 500, msg: "Internal server error." })
        //     } else if (list.length == 0) {
        //         res.json({ status: 404, msg: "No data found." })
        //     } else {
        //         var sql1 = "SELECT A.*,B.skill FROM tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category WHERE A.job_id=?";

        //         mysql.connection.query(sql1, [req.body.job_id], (err, job_detail) => {
        //             if (err) {
        //                 res.json({ status: 500, msg: "Internal server error." })
        //             } else if (job_detail.length == 0) {
        //                 res.json({ status: 200, msg: "Successfully found number of people who accepeted this job.", data: list, job_detail: job_detail })
        //             } else {
        //                 res.json({ status: 200, msg: "Successfully found number of people who accepeted this job.", data: list, job_detail: job_detail })
        //             }
        //         })
        //     }
        // })
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

    mysql.connection.query('SELECT A.*,B.skill,C.name,C.addressline1,C.addressline2,C.city,C.state,C.zipcode,C.zone FROM `tab_jobs` A LEFT JOIN tab_skills B ON B.id= A.category LEFT JOIN tab_address C ON	C.id = A.address WHERE A.job_id=?', [job_id], (err, list) => {
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

//================================ Cron job for expire work now jobs =============================================


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


                console.log('start date and day===>', job_list[i].job_id, date1, day1, date1.getDay());
                console.log('end date and day===>', job_list[i].job_id, date2, day2, date2.getDay());
                console.log('today date and day===>', getDate, today, date4.getDay());


                // var date1 = new Date(posted_date);
                // var today = new Date();


                // var date2 = new Date(getDate);
                var diffDays = parseInt((date2 - date1) / (1000 * 60 * 60 * 24)); //gives day difference 
                console.log("diffDays===>", diffDays)

                // console.log('days list ==>',)

                var visibility = '';


                if (day2 == 'Sunday') {
                    visibility = 0;
                } else {

                }


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

//=========================================== API for accept/reject job =======================================

const select_seeker = async(req, res) => {

    var user_id = req.decoded.user_id;
    console.log("user_id ==>", user_id)
    var status = req.body.status; //status = 1 (accept) ,  0 => Reject
    var job_id = req.body.job_id;
    var seeker_id = req.body.seeker_id;
    var title = '';
    var text = '';
    var message = '';

    var sql = 'Select A.*,B.skill from tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category Where A.job_id=? AND A.user_id=?'

    await selectSeekers();

    function selectSeekers() {

        mysql.connection.query(sql, [job_id, user_id], (err, job) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (job.length == 0) {
                res.json({ status: 404, msg: "No data found." })
            } else {

                if (status == "1") { //accept

                    title = `Provider has been accepted for ${job[0].job_title} job post.`;
                    text = `${job[0].skill}`;
                    message = 'Accepted';
                } else { // Reject

                    title = `Provider has been rejected for ${job[0].job_title} job post.`;
                    text = `${job[0].skill}`;
                    message = 'Rejected';
                }

                mysql.connection.query('select * from tab_users where user_id=?', [seeker_id], (err, seeker) => {
                    if (err) {
                        res.json({ status: 500, msg: "Internal server error." })
                    } else if (seeker.length == 0) {
                        res.json({ status: 404, msg: "No seeker found." })
                    } else {
                        common_function.send_push_notification(seeker[0].device_token, title, text, '');

                        mysql.connection.query('Insert into tab_notification set job_id=?, user_id=?,message=?,job_type=1', [job_id, seeker_id, title], (err, save_notification) => {
                            if (err) {
                                res.json({ status: 500, msg: "Internal server error." })
                            } else {
                                res.json({ status: 200, msg: `Provider has been ${message}  this job.` })
                            }
                        })
                    }
                })
            }
        })
    }
}

//=========================================== Confirmed booking ================================================

const confirm_booking = async(req, res) => {

    const { job_id, seeker_id } = req.body;

    var provider_id = req.decoded.user_id;

    console.log('provider id ==>', provider_id);


    var arr = seeker_id.split(',');

    console.log('seeker array ==>', arr);


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
                                        mysql.connection.query('select A.*,B.skill from tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category where A.job_id=?', [job_id], (err, job) => {
                                            if (err) {
                                                console.log('Unbale to find an user.')
                                            } else if (job.length == 0) {
                                                console.log('No job founded.')
                                            } else {

                                                var title = `Prvider has been approved your request for ${job[0].job_title}.`;
                                                var text = `${job[0].skill}`;

                                                common_function.send_push_notification(user[0].device_token, title, text, '');

                                                mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?', [job_id, user[0].user_id, title, job[0].lat, job[0].lng, job[0].job_type, user[0].distance], (err, save_notification) => {
                                                    if (err) {
                                                        console.log('Error found in save notification.')
                                                    } else {
                                                        console.log('Save Notifications into DB.')
                                                    }
                                                })

                                            }
                                        })

                                    }
                                })
                                // console.log('Booking saved.')
                        }
                    })
                }
                res.json({ status: 200, msg: "Successfully booking saved." })
            }
        })
    }
}


//======================================== Find people ==========================================================

const find_people = async(req, res) => {

    const { job_id } = req.body;
    var provider_id = req.decoded.user_id;

    var lat = '';
    var lng = '';

    mysql.connection.query('select A.*,B.skill from tab_jobs A LEFT JOIN tab_skills B ON B.id=A.category where A.job_id =? and A.user_id=?', [job_id, provider_id], (err, job) => {
        if (err) {
            res.json({ status: 500, msg: "Internal server eror." })
        } else if (job.length == 0) {
            res.json({ status: 404, msg: "No job founded." })
        } else {

            console.log("job 1 ==========>", job[0]);

            lat = job[0].lat;
            lng = job[0].lng;

            var skill = job[0].category;

            var title = `${job[0].job_title}`;
            var text = `${job[0].skill}`;

            //   var data = '';

            mysql.connection.query('select * from tab_users where role_id=2 and isCompleteProfile=1 and  skill_id=?', [skill], (err, user_list) => {
                if (err) {
                    res.json({ status: 500, msg: "Internal server eror." })
                } else if (user_list.length == 0) {
                    res.json({ status: 404, msg: "No seeker founded." })
                } else {
                    mysql.connection.query('select * from tab_job_apply where job_id=?', [job_id], (err, applicant) => {
                        if (err) {
                            res.json({ status: 500, msg: "Internal server error." })
                        } else if (applicant.length == 0) {

                            for (var i = 0; i < user_list.length; i++) {

                                var data = { //data
                                    job_id: job_id, //job_id
                                    sender_id: provider_id, //seeker provider user id
                                    receiver_id: user_list[i].user_id,
                                    lat: lat,
                                    long: lng
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

                                    mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?', [job_id, user_list[i].user_id, text, lat, lng, 1, user_list[i].distance], (err, save_notification) => {
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
                            // console.log("job lat long===>", job);

                            for (var i = 0; i < user_list.length; i++) {
                                for (var j = 0; j < applicant.length; j++) {

                                    if (user_list[i].user_id == applicant[j].user_id && job_id == applicant[j] == job_id) {
                                        console.log('Seeker Already applied', user_list[i].user_id)
                                    } else {

                                        // console.log("job===>", job[0]);
                                        var data = { //data
                                            job_id: job_id, //job_id
                                            sender_id: provider_id, //seeker provider user id
                                            receiver_id: user_list[i].user_id,
                                            lat: lat,
                                            long: lng
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

                                            mysql.connection.query('Insert into tab_notification set job_id =?,user_id =?,message=?,lat=?,lng=?,job_type=?,distance=?', [job_id, user_list[i].user_id, text, lat, lng, 1, user_list[i].distance], (err, save_notification) => {
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
                            }
                            res.json({ status: 200, msg: "Successfully sent for find resouces." })
                        }
                    })
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

        var sql = `SELECT A.*,D.apply_status,E.profile_pic, B.skill,F.skill AS category, B.parent_id, C.name, C.addressline1, C.addressline2, C.city, C.state, C.zipcode, C.zone FROM tab_jobs A  LEFT JOIN tab_job_apply D ON A.job_id = D.job_id AND D.user_id=? LEFT JOIN tab_users E ON E.user_id = A.user_id LEFT JOIN tab_skills B ON A.category = B.id LEFT JOIN tab_address C ON C.id = A.address LEFT JOIN tab_skills F ON F.id = B.parent_id WHERE B.skill LIKE '%${search}%' OR A.job_title LIKE '%${search}%' AND visibility = 1`;

        mysql.connection.query(sql, [user_id], (err, list) => {
            if (err) {
                res.json({ status: 500, msg: "Internal server error." })
            } else if (list.length == 0) {
                res.json({ status: 404, msg: "No data found." })
            } else {
                res.json({ status: 200, msg: "Successfully found jobs.", data: list })
            }
        })
    }
}

//========================================= API for submit user's rating ==========================================

const save_rating = (req, res) => {

    const { seeker_id, rating } = req.body;

    mysql.connection.query('Insert into tab_rating set user_id=?, rating=?', [seeker_id, rating], (err, save) => {
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
                // res.json({ status: 400, msg: "Link has been expired." })

                // res.sendFile(__dirname + './dir/linkExpire.html')
                res.sendFile('/var/www/html/projects/rockstaffing/dir/linkExpire.html')


            } else if (user[0].isEmailVerify == '1') {
                // res.json({ status: 400, msg: "Your email is Already verified." })
                res.sendFile('/var/www/html/projects/rockstaffing/dir/alreadyVerify.html')

            } else {
                mysql.connection.query('update tab_users set isEmailVerify=? where user_id=?', [1, user_id], (err, verifyEmail) => {
                    if (err) {
                        res.json({ status: 500, msg: "Internal server error." })
                    } else {
                        // res.json({ status: 400, msg: "Successfully verified your email." })
                        // res.sendFile(__dirname + './dir/verifyLink.html')
                        res.sendFile('/var/www/html/projects/rockstaffing/dir/verifyLink.html')

                    }
                })
            }
        })
    }
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
    update_status,
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
    get_location,
    job_detail,
    update_device_token,
    select_seeker,
    confirm_booking,
    find_people,
    global_search,
    save_rating,
    verifyLink
}