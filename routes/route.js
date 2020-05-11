const router = require('express').Router();
const userController = require('../controller/userController');
const middleware = require('../middleware/auth');


router.post('/register', userController.upload.single('file'), userController.signup);
router.post('/login', userController.login);
router.post('/forget_password', userController.forget_password);
router.post('/get_profile', middleware.verifyToken, userController.get_profile);
router.post('/add_job_category', userController.add_job_category);
router.post('/long_term_job', middleware.verifyToken, userController.long_term_job);
router.get('/job_category_list', userController.job_category_list);
router.post('/add_address', middleware.verifyToken, userController.add_address);
router.post('/add_work_now', middleware.verifyToken, userController.save_work_now);
router.post('/add_equipment', userController.add_equipment);
router.get('/equipments', userController.equipments);
router.post('/add_skill', userController.add_skill);
router.get('/skills', userController.skills);
router.post('/get_wok_now_job', middleware.verifyToken, userController.get_wok_now_job);
router.post('/get_long_term_job', middleware.verifyToken, userController.get_long_term_job);
router.post('/job_lists', middleware.verifyToken, userController.job_lists);
router.post('/update_profile', userController.upload.single('file'), userController.update_profile);
router.post('/add_quiz', userController.add_quiz);
router.post('/save_quiz_response', middleware.verifyToken, userController.quiz_response);
router.get('/quiz_list', userController.quiz_list);
router.post('/delete_job_post', middleware.verifyToken, userController.delete_job_post);
router.post('/update_status', userController.update_status);
router.get('/category', userController.category);
router.post('/sub_category', userController.sub_category);
router.post('/quiz_score', middleware.verifyToken, userController.quiz_score);
router.post('/address_lists', middleware.verifyToken, userController.address_lists);
router.post('/change_password', middleware.verifyToken, userController.change_password);
router.post('/logout', middleware.verifyToken, userController.logout);
router.post('/notification_lists', middleware.verifyToken, userController.notification_lists);
router.post('/contact_us', userController.contact_us);
router.post('/apply_job', middleware.verifyToken, userController.apply_job);
router.post('/repost_work_post_job', middleware.verifyToken, userController.repost_work_post_job);
router.post('/filter_job', middleware.verifyToken, userController.filter_job);
router.post('/update_distance', middleware.verifyToken, userController.update_distance);
router.post('/change_status', middleware.verifyToken, userController.change_status);
router.post('/repost_long_term_job', middleware.verifyToken, userController.repost_long_term_job);
router.post('/find_no_people', middleware.verifyToken, userController.find_no_people);
router.post('/get_location', middleware.verifyToken, userController.get_location);
router.post('/job_detail', middleware.verifyToken, userController.job_detail);
router.post('/update_device_token', middleware.verifyToken, userController.update_device_token);
router.post('/select_seeker', middleware.verifyToken, userController.select_seeker);
router.post('/confirm_booking', middleware.verifyToken, userController.confirm_booking);
router.post('/find_people', middleware.verifyToken, userController.find_people);
router.post('/global_search', middleware.verifyToken, userController.global_search);
router.post('/save_rating', middleware.verifyToken, userController.save_rating);
router.get('/verifyLink/:user_id/:code', userController.verifyLink);






router.post('/profile', userController.profile);



module.exports = router;