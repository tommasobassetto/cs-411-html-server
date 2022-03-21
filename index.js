var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var bodyParser = require('body-parser');
var flash = require('express-flash');
var session = require('express-session');
var mysql = require('mysql2');

// Used for hashing passwords
var crypto = require('crypto');
var hash = crypto.createHash('sha512');

var app = express();
//var http = require('http').Server(app);
//var port = 80;

//http.listen(port, function() {
//    console.log("Listening on port 80.");
//});

var connection = mysql.createConnection({
    host: '34.135.132.110',
    user: 'root',
    password: 'test123',
    database: 'cs_411_test'
});

connection.connect;

var sql_response = undefined;
 
// set up ejs view engine 
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
 
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(__dirname + '../public'));

app.use(session({ 
    secret: '123456catr',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 }
}))

app.use(flash());
 
// GET home page, respond by rendering index.ejs
app.get('/', function(req, res) {
        res.render('index', { title: 'Login' });
        // res.json() // send JSON to user
        //runQuerySafe('SELECT * FROM Books LIMIT 10', req, res);
});

function runQuerySafe (q, req, res) {
    return new Promise(resolve => {
        connection.query(q, function (error, result) {
            if (error) {
                res.send('Database error occurred'); 
                sql_response = "ERR";
                resolve();
            }

            else { 
                res.send(result);
                sql_response = result;
                resolve()
            }
    });
    });

}

// this code is executed when a user clicks the form submit button
// Note: making functions async allows force wait for SQL server reply (await)
app.post('/login', async function(req, res, next) {
  var uname = req.body.uname;
  var disp_name = req.body.disp_name; 
  var password = req.body.password;

  var data = hash.update(password, 'utf-8');

  //Creating the hash in the required format
  var gen_hash = data.digest('hex');

  // Check if the user already exists. FIXME: Get the query output.
  var user_check_query = `SELECT COUNT(*) AS U FROM Users WHERE Username = "` + uname + `";`;
  sql_response = undefined;

  await runQuerySafe(user_check_query, req, res);

  var user_ct = sql_response[sql_response.length - 1]['U'];
  
  // If no user, create one
  if (user_ct === 0) {
    var insert_user_query = `INSERT INTO Users(Username, DisplayName, PasswordHash) VALUES (` + uname + ',' + disp_name + ',' + gen_hash + ');'

    // FIXME: Alert created account
  } else {
      var password_query = `SELECT COUNT(*) AS U FROM Users WHERE Username = "` + uname + `" AND PasswordHash = '` + gen_hash + `';`;

      await runQuerySafe(user_check_query, req, res);

      var user_ct = sql_response[sql_response.length - 1]['U'];

      if (user_ct === 0) {
          // FIXME Alert invalid password then reload the page
      }
  }

  // FIXME: Save the session somehow (keep user logged in despite redirect)

  // Redirect to homepage (FIXME). 307 means internal redirect
  res.writeHead(307, { Location: './home' });

});
 

app.get('/test', function(request, response){
    connection.query('select * from Books LIMIT 5', function(error, results){
        if ( error ){
            response.status(400).send('Error in database operation');
        } else {
            response.send(results);
        }
    });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});
 
// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
 
  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
 
// port must be set to 3000 because incoming http requests are routed from port 80 to port 8$
app.listen(80, function () {
    console.log('Node app is running on port 80');
});
 
module.exports = app;