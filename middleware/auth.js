var jwt = require('jsonwebtoken');
var config = require('../config/config')();

const auth = {
    'verifyToken': (req, res, next) => {
        var token = req.body.token || req.query.token || req.headers['x-access-token'];
        if (token) {

            // verifies secret and checks exp
            jwt.verify(token, config.secret_key, function(err, decoded) {
                if (err) { //failed verification.
                    return res.json({ "status": 404, "message": "Invalid Token", "error_code": 998 });
                }
                console.log('token verified....')
                req.decoded = decoded;
                next(); //no error, proceed
            });
        } else {
            // forbidden without token
            return res.status(403).send({
                "status": 403,
                "message": "Token is require",
                "error_code": 999
            });
        }
    }
}
module.exports = auth;