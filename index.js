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
var nav_bar = `<nav class="navbar navbar-dark bg-dark navbar-expand-md">
<a class = "navbar-brand" href = "/home">
    <span class = "navbar-brand-label">
        OpenSourceBooks
    </span>
</a>

<div class="collapse navbar-collapse">
    <ul class="nav navbar-nav mr-auto" id="main-nav">
      
      <li class="nav-item mr-4"><a class="nav-link" href="./reviews">My Reviews</a></li>
      <li class="nav-item mr-4"><a class="nav-link" href="./friends">My Friends</a></li>
      <li class="nav-item mr-4"><a class="nav-link" href="./recommendations">My Recommendations</a></li>
      <li class="nav-item mr-4"><a class="nav-link" href="./books">Browse Books</a></li>
    </ul>

</div>   
</nav>`;

var open_sessions = {};
 
// set up ejs view engine 
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
 
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname , '../public')));

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
                console.log(error);
                resolve();
            }

            else { 
                sql_response = result;
                resolve();
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

  var hash = crypto.createHash('sha256');
  var data = hash.update(password, 'utf-8');

  //Creating the hash in the required format
  var gen_hash = data.digest('hex');
  console.log(gen_hash.length);

  // Check if the user already exists. FIXME: Get the query output.
  var user_check_query = `SELECT COUNT(*) AS U FROM Users WHERE Username = "` + uname + `";`;
  sql_response = undefined;

  await runQuerySafe(user_check_query, req, res);

  var user_ct = sql_response[sql_response.length - 1]['U'];
  
  // If no user, create one
  if (user_ct === 0) {
    if (disp_name === "") disp_name = uname;
    var insert_user_query = `INSERT INTO Users(Username, DisplayName, PasswordHash) VALUES ('` + uname + '\',\'' + disp_name + '\',\'' + gen_hash + '\');'

    await runQuerySafe(insert_user_query, req, res);

    // Alert created account
    res.send(`<script>alert("New account created!");</script>`);
    
  } else {
      var password_query = `SELECT COUNT(*) AS U FROM Users WHERE Username = "` + uname + `" AND PasswordHash = '` + gen_hash + `';`;

      sql_response = undefined;

      await runQuerySafe(password_query, req, res);

      var user_ct = sql_response[sql_response.length - 1]['U'];

      if (user_ct === 0) {
          // Reload the login page
          req.method = 'get';
          res.redirect('/');
      }
      
  }

  // Save the session id to keep the user logged in even after redirect
  console.log(req.sessionID);
  open_sessions[req.sessionID] = uname;

  // Redirect to homepage.
  req.method = 'get';
  res.redirect('/home');

});

app.get('/home', async function(req, res) {
    res.send('You Made It! Welcome user ' + open_sessions[req.sessionID]);
});

app.get('/friends', async function(req, res) {
    req.user;

    res.render('index', { title: 'Login' });
    var query = "SELECT * FROM Friends WHERE WantsRecs = '" + req.user + "';";
    await runQuerySafe(query, req, res);

    var table = convertTable(sql_response, "");
    var html = createPage(nav_bar, "My Friends", "", table);
    res.render(html);
    //console.log(sql_response);
    // res.json() // send JSON to user
    //runQuerySafe('SELECT * FROM Books LIMIT 10', req, res);
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