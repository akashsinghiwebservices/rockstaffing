const router = require('express').Router();
const userController = require('../controller/userController');
const middleware = require('../middleware/auth');


router.post('/register', userController.signup);
router.post('/login', userController.login);
router.post('/forget_password', userController.forget_password);
router.post('/get_profile', middleware.verifyToken, userController.get_profile);
router.post('/add_job_category', userController.add_job_category);
router.post('/long_term_job', middleware.verifyToken, userController.long_term_job);
router.get('/job_category_list', userController.job_category_list);
router.post('/add_address', middleware.verifyToken, userController.add_address);
router.post('/add_work_now', middleware.verifyToken, userController.save_work_now);
router.post('/add_equipment', userController.add_equipment);
router.post('/equipments', userController.equipments);
router.post('/add_skill', userController.add_skill);
router.post('/skills', userController.skills);
router.post('/get_wok_now_job', middleware.verifyToken, userController.get_wok_now_job);
router.post('/get_long_term_job', middleware.verifyToken, userController.get_long_term_job);
router.post('/job_lists', middleware.verifyToken, userController.job_lists);
router.post('/update_profile', userController.update_profile);
router.post('/provider_update_profile', userController.provider_update_profile);
router.post('/add_quiz', userController.add_quiz);
router.post('/save_quiz_response', middleware.verifyToken, userController.quiz_response);
router.get('/quiz_list', userController.quiz_list);
router.post('/delete_job_post', middleware.verifyToken, userController.delete_job_post);
router.post('/update_background_check', userController.update_background_check);
router.post('/update_drugtest_check', userController.update_drugtest_check);
router.post('/category', userController.category);
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
router.post('/change_status_automatic', middleware.verifyToken, userController.change_status_automatic);
router.post('/repost_long_term_job', middleware.verifyToken, userController.repost_long_term_job);
router.post('/find_no_people', middleware.verifyToken, userController.find_no_people);
router.post('/get_location', middleware.verifyToken, userController.get_location);
router.post('/job_detail', middleware.verifyToken, userController.job_detail);
router.post('/update_device_token', middleware.verifyToken, userController.update_device_token);
router.post('/select_seeker', middleware.verifyToken, userController.select_seeker);
router.post('/confirm_booking', middleware.verifyToken, userController.confirm_booking);
router.post('/find_people', middleware.verifyToken, userController.find_people);
router.post('/find_no_people_manual', middleware.verifyToken, userController.find_no_people_manual);
router.post('/global_search', middleware.verifyToken, userController.global_search);
router.post('/save_rating', middleware.verifyToken, userController.save_rating);
router.post('/verifyLink/:user_id/:code', userController.verifyLink);
router.post('/check_approval', middleware.verifyToken, userController.check_approval);
router.post('/delete_notification', middleware.verifyToken, userController.delete_notification);
router.post('/clear_notification', middleware.verifyToken, userController.clear_notification);
router.post('/notification_remove', middleware.verifyToken, userController.notification_remove);
router.post('/log_start', middleware.verifyToken, userController.log_start);
router.post('/log_list', middleware.verifyToken, userController.log_list);
router.post('/notification_count', middleware.verifyToken, userController.notification_count);
router.post('/update_notification_status', middleware.verifyToken, userController.update_notification_status);
router.post('/get_distance', middleware.verifyToken, userController.get_distance);
router.post('/update_work_location', middleware.verifyToken, userController.update_work_location);
router.post('/job_application_status', middleware.verifyToken, userController.job_application_status);
router.post('/complete_job', middleware.verifyToken, userController.complete_job);
router.post('/job_completion', userController.job_completion);
router.post('/job_journey_date', userController.job_journey_date);
router.post('/create_payment', middleware.verifyToken, userController.create_payment);
router.post('/approve_seeker', middleware.verifyToken, userController.approve_seeker);
router.post('/change_seeker', userController.change_seeker);
router.post('/job_journey', userController.job_journey);
router.post('/show_seeker_rating', userController.show_seeker_rating);
router.post('/find_no_people_long_term_job', middleware.verifyToken, userController.find_no_people_long_term_job);
router.post('/users', middleware.verifyToken, userController.users);
router.post('/jobs', middleware.verifyToken, userController.jobs);
router.post('/recent_users', middleware.verifyToken, userController.recent_users);
router.post('/seeker_list', middleware.verifyToken, userController.seeker_list);
router.post('/provider_list', middleware.verifyToken, userController.provider_list);
router.post('/upadte_seeker_profile', middleware.verifyToken, userController.upadte_seeker_profile);
router.post('/upadte_provider_profile', middleware.verifyToken, userController.upadte_provider_profile);
router.post('/delete_user', middleware.verifyToken, userController.delete_user);
router.post('/replace_seeker', middleware.verifyToken, userController.replace_seeker);
router.post('/save_step', middleware.verifyToken, userController.save_step);
router.post('/long_term_job_list', middleware.verifyToken, userController.long_term_job_list);
router.post('/work_now_job_list', middleware.verifyToken, userController.work_now_job_list);
router.post('/delete_job', middleware.verifyToken, userController.delete_job);

router.post('/skill_category', userController.skill_category);
router.post('/category_skill', userController.category_skill);
router.post('/sub_category_skill', userController.sub_category_skill);
router.post('/add_sub_category', userController.add_sub_category);
router.post('/update_subcategory', userController.update_subcategory);
router.post('/update_skill_category', userController.update_skill_category);
router.post('/update_skill_status', userController.update_skill_status);
router.post('/invoice_detail', middleware.verifyToken, userController.invoice_detail);
router.post('/update_admin_profile', middleware.verifyToken, userController.update_admin_profile);


router.post('/providers', middleware.verifyToken, userController.providers);
router.post('/seekers', middleware.verifyToken, userController.seekers);
router.post('/send_notification', middleware.verifyToken, userController.send_notification);
router.post('/show_notification', middleware.verifyToken, userController.show_notification);
router.post('/send_email', middleware.verifyToken, userController.send_email);
router.post('/add_user', middleware.verifyToken, userController.add_user);

router.post('/verifyAccount', userController.verifyAccount);
router.post('/invoice_permit', userController.invoice_permit);

router.post('/rate_now', middleware.verifyToken, userController.rate_now);
router.post('/generate_invoice', middleware.verifyToken, userController.generate_invoice);


router.post('/start_clock_in', middleware.verifyToken, userController.start_clock_in);

router.post('/view_profile', middleware.verifyToken, userController.view_profile);
router.post('/get_url', middleware.verifyToken, userController.get_url);
router.post('/update_url', middleware.verifyToken, userController.update_url);
router.post('/job_calender', middleware.verifyToken, userController.job_calender);
router.post('/seeker_earning', middleware.verifyToken, userController.seeker_earning);
router.post('/seeker_job_calender', middleware.verifyToken, userController.seeker_job_calender);


router.post('/job_detail_calender', middleware.verifyToken, userController.job_detail_calender);
router.post('/check_running_job', middleware.verifyToken, userController.check_running_job);
router.post('/job_finished', middleware.verifyToken, userController.job_finished);
router.post('/check_progress_bar_status', middleware.verifyToken, userController.check_progress_bar_status);
router.post('/update_progress_bar', middleware.verifyToken, userController.update_progress_bar);
router.post('/get_markup_price', userController.get_markup_price);
router.post('/edit_markup_price', userController.edit_markup_price);
router.post('/previous_job', middleware.verifyToken, userController.previous_job);
router.post('/provider_previous_job', middleware.verifyToken, userController.provider_previous_job);
router.post('/job_detail_on_previous_job', middleware.verifyToken, userController.job_detail_on_previous_job);
router.post('/delete_job_before_start', middleware.verifyToken, userController.delete_job_before_start);



router.post('/create_invoice', middleware.verifyToken, userController.create_invoice);

router.post('/testing', userController.testing);





router.post('/profile', userController.profile);





module.exports = router;
