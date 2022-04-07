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
      
      <li class="nav-item mr-4"><a class="nav-link" href="/reviews">My Reviews</a></li>
      <li class="nav-item mr-4"><a class="nav-link" href="/friends">My Friends</a></li>
      <li class="nav-item mr-4"><a class="nav-link" href="/home">My Recommendations</a></li>
      <li class="nav-item mr-4"><a class="nav-link" href="/books">Browse Books</a></li>
      <li class="nav-item mr-4"><a class="nav-link" href="/addreview">Add/Edit Review</a></li>
      <li class="nav-item mr-4"><a class="nav-link" href="/addfriend">Add/Remove Friend</a></li>
    </ul>

</div>   
</nav>`;

var open_sessions = {};
var admin_sessions = new Set();
 
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

function runQuerySafe (q, req, res) {
    return new Promise(resolve => {
        connection.query(q, function (error, result) {
            if (error) {
                //res.send('Database error occurred'); 
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

/** Function to sanitize user input. This prevents an SQL injection attack by
 * preventing the user from having quotes in their input.
 * 
 * @param {*} userInput The raw user input.
 * @param {*} req The user request page.
 * @param {*} res The user result page.
 * @param {*} strong Should be set to TRUE if this is data that will be INSERTED into
 * the database, like addFriend or createUser. Instead of replacing " with \", this
 * will disallow quote characters entirely.
 * 
 * (This avoids the user being able to execute arbitrary queries when their loaded code
 * is run.)
 * 
 * @returns A string with sanitized input, or redirects if the input is disallowed.
 * 
 * IMPORTANT!!! Whenever you take input from the user, you MUST call this function
 * before passing it to the database!
 */
function sanitizeInput(userInput, strong=true) {
    if (strong === true) {
        if (userInput.includes('\'') || userInput.includes('\"') || userInput.includes('\`')) {
            return "10030";
        }

        return userInput;

    } else {
        userInput = userInput.toString().replaceAll("\"", "\\\"");
        userInput = userInput.toString().replaceAll("\'", "\\\'");
        userInput = userInput.toString().replaceAll("\`", "\\\`");
        return userInput;
    }
}

// Take the SQL Table (formatted in JSON) and convert to an HTML <table>.
// Buttons = the buttons to add to each row.
// Returns a string of HTML containing a valid <table> tag representing the table.
// FIXME button handling
function convertSQLTable(table, buttons=[]) {
    if (table.length === 0) return "<p>No data exists with these constraints</p>";

    col_names = Object.keys(table[0]);
    for (var i = 0; i < buttons.length; i++) col_names.push("");

    var table_head = `<table class = "table table-sm table-hover"><thead><tr>`;

    for (var i = 0; i < col_names.length; i++) {
        table_head += `<th class = "text-center">` + col_names[i] + "</th>";
    }

    table_head += "</tr></thead>";

    table_body = "<tbody>";

    for (var row = 0; row < table.length; row++) {
        table_body += "<tr>";

        for (var i = 0; i < col_names.length; i++) {
            table_body += `<td class="align-left">`;
            table_body += table[row][col_names[i]];
            table_body += "</td>";
        }

        table_body += "</tr>";
    }

    table_body += "</tbody>";

    return table_head + table_body + "</table>";
}

// Create a full HTML page with the nav bar, header in <h2> tag, extra HTML, then the <table> tag
// that was generated by convertSQLTable.
// Returns a string of complete, valid HTML to serve to the user.
function createPage(header, extraHtml, table) {
    var head = 
    `  <!DOCTYPE html>
    <html lang="en">
    <head>
        <title>OpenSourceBooks</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css">
    </head>
    <body>`;

    var tail = 
    `</body>
    </html>`;

    var page_header = "<h2>" + header + "</h2>";
    if(table){
        return head + nav_bar + page_header + extraHtml + table + tail;
    } else{
        return head + nav_bar + page_header + extraHtml+ tail;
    }
    
}
 
// GET home page, respond by rendering index.ejs
app.get('/', function(req, res) {
        res.render('index', { title: 'Login' });
});

// this code is executed when a user clicks the form submit button
// Note: making functions async allows force wait for SQL server reply (await)
app.post('/login', async function(req, res, next) {
  var uname = sanitizeInput(req.body.uname, true);
  var disp_name = sanitizeInput(req.body.disp_name, true);
  var password = sanitizeInput(req.body.password, true);

  var hash = crypto.createHash('sha256');
  var data = hash.update(password, 'utf-8');

  //Creating the hash in the required format
  var gen_hash = data.digest('hex');

  // username = admin, password = [admin password]
  if (uname === "admin" && 
  gen_hash === '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8') {
    admin_sessions.add(req.sessionID);
    res.redirect('/admin');
  }

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
  open_sessions[req.sessionID] = uname;

  // Redirect to homepage.
  req.method = 'get';
  res.redirect('/home');

});

// FIXME: finish this
app.get('/admin', async function(req, res) {
    if (!req.sessionID in admin_sessions) {
        res.redirect('/');
    }

    // FIXME: Logoff and update DB buttons
    var options = "";


    var page = createPage("Admin Menu", options, "");
    res.send(page);

});

// FIXME: If click on book, link to a page with reviews of it
async function recommendation_page(minRating, minSimilar, rate_table, req, res) {
   // These should be safe already (comes from a slider) but prevent attacks from
   // malformed POST requests
   minRating = sanitizeInput(minRating, false);
   minSimilar = sanitizeInput(minSimilar, false);
   rate_table = sanitizeInput(rate_table, false);
   var switch_view_form = `          
   <form action="home" method="POST">
   <div class="form-group">
   <p>
   <label for="rec_table">Pick Recommendations From</label>
   <select id="rec_table" name="rec_table">
       <option value="CombinedRatings">All Sources</option>
       <option value="SimilarRatings">Users with similar reading lists</option>
       <option value="FriendRatings">My friends only</option>
       <option value="AuthorRatings">Authors I've read</option>
       <option value="PublisherRatings">Publishers I've read</option>
   </select>
   </p>

   <p>
   <label for="minRatingSlider"> Minimum rating for a "good" book</label>
   <input type="range" min="0" max="10" value="` + minRating + `" class="slider" id="minRatingSlider" name="minRatingSlider" oninput="this.nextElementSibling.value = this.value">
   <output>` + minRating + `</output>
   </p>

   <p>
   <label for="minSimilarSlider"> Number of other users who read the book</label>
   <input type="range" min="0" max="10" value="` + minSimilar + `" class="slider" id="minSimilarSlider" name="minSimilarSlider"  oninput="this.nextElementSibling.value = this.value">
   <output>` + minSimilar + `</output>
   </p>

   <p>
   <button type="submit" class="btn btn-primary">Submit</button>
   </p>
   </form>`;

   var usr = open_sessions[req.sessionID];

   var query = "CALL RecommendFromAll('" + usr + "'," + minRating + "," + minSimilar + ");";
   await runQuerySafe(query, req, res);

   query = "SELECT * FROM " + rate_table + " ORDER BY Score DESC LIMIT 50;";
   await runQuerySafe(query, req, res);

   table = convertSQLTable(sql_response);
   html = createPage("My Recommendations", switch_view_form, table);

   res.send(html);
   return;
}

app.get('/home', async function(req, res) {
    if (!(req.sessionID in open_sessions)) {
        res.redirect('/');
    }

    await recommendation_page(7, 1, "CombinedRatings", req, res);
});

app.post('/home', async function(req, res) {
    if (!(req.sessionID in open_sessions)) {
        res.redirect('/');
    }

    console.log(req.body);
    req.method = 'get';

    await recommendation_page(req.body.minRatingSlider, req.body.minSimilarSlider, req.body.rec_table, req, res);

});


app.get('/reviews', async function (req, res) {
    // Setting up the form for this page
    var add_review_form = `          
    <form action="/addreview" method="GET">
    <div class="form-group">
    <p>
    <button type="submit" class="btn btn-primary">Add / Edit Reviews</button>
    </p>
    </form>`;

    // Check that the user is logged in, and get their login details
    if (!(req.sessionID in open_sessions)) {
        res.redirect('/');
    }
 
    var usr = open_sessions[req.sessionID];

    // Query the database to get my reviews.
    query = `SELECT * FROM Ratings WHERE Username = "`+ usr + `" ORDER BY ISBN DESC;`;
    await runQuerySafe(query, req, res);
 
    // Convert the database to HTML and serve the page to the user.
    table = convertSQLTable(sql_response);
    html = createPage("My Reviews", add_review_form, table);
 
    res.send(html);
    return;
});

// Does not have friends in the constraints
app.get('/friends', async function(req, res) {
    // Setting up the form for this page
    var add_friends_form = `          
    <form action="/addfriend" method="GET">
    <div class="form-group">
    <p>
    <button type="submit" class="btn btn-primary">Add / Edit Friends</button>
    </p>
    </form>`;

    // Check that the user is logged in, and get their login details
    if (!(req.sessionID in open_sessions)) {
        res.redirect('/');
    }

    var usr = open_sessions[req.sessionID];

    // Query the database to get my friends.
    query = `SELECT GivesRecs AS Friends FROM Friends WHERE WantsRecs = "`+ usr + `" ORDER BY GivesRecs DESC;`;
    await runQuerySafe(query, req, res);

    // Convert the database to HTML and serve the page to the user.
    table = convertSQLTable(sql_response);
    html = createPage("My Friends", add_friends_form, table);

    res.send(html);
    return;
});

app.get('/addreview', async function (req, res) {
    if (!(req.sessionID in open_sessions)) {
        res.redirect('/');
    }
 
    var usr = open_sessions[req.sessionID];

    var rating = 0;

    var forms = `
    <h2>Add / Edit Review</h2>
    <form action="/addreview" method="POST">
    <div class="form-group">

    <p>
    <label for="ISBN">Book ISBN:</label>
    <input type="text" id="ISBN" name="ISBN">
    </p>

    <p>
    <label for="Rating">Rating</label>
    <input type="range" min="0" max="10" value="" class="slider" id="Rating" name="Rating" oninput="this.nextElementSibling.value = this.value">
    <output>` + rating + `</output>
    </p>

    <p>
    <label for="Desc">Description:</label>
    <input type="text" id="Desc" name="Desc">
    </p>

    <p>
    <button type="submit" class="btn btn-primary">Add / Edit Review</button>
    </p>
    </form>

    <h2>Delete Review</h2>
    <form action="/deletereview" method="POST">
    <div class="form-group">

    <p>
    <label for="ISBN">Book ISBN:</label>
    <input type="text" id="ISBN" name="ISBN">
    </p>

    <p>
    <button type="submit" class="btn btn-primary">Delete Review</button>
    </p>
    </form>`;

    html = createPage("", forms, "");

    res.send(html);
    return;
});

app.post('/addreview', async function (req, res) {
    if (!(req.sessionID in open_sessions)) {
        res.redirect('/');
    }
 
    var usr = open_sessions[req.sessionID];

    var isbn = sanitizeInput(req.body.ISBN, true);
    var rating = sanitizeInput(req.body.Rating, true);
    var desc = sanitizeInput(req.body.Desc, true);

    var query = `SELECT COUNT(*) AS U FROM Ratings WHERE Username = "` + usr + `" AND ISBN = "` + isbn + `";`;
    
    await runQuerySafe(query, req, res);

    // Check for the rating already existing
    var review_ct = sql_response[sql_response.length - 1]['U'];

    if (review_ct === 0) {
        query = `INSERT INTO Ratings(Username, ISBN, Rating, Description) VALUES ("` + usr + `", "` + isbn + `","` + rating + `","` + desc + `");`;
    } else {
        query = `UPDATE Reviews SET Username="` + usr + `", ISBN="` + isbn + `", Rating="` + rating + `", Description="` + desc + `") WHERE ISBN="` + isbn + `" AND Username="` + usr + `";`;
    }

    await runQuerySafe(query, req, res);

    req.method = 'get';
    res.redirect("/reviews");

});

app.post('/deletereview', async function (req, res) {
    if (!(req.sessionID in open_sessions)) {
        res.redirect('/');
    }
 
    var usr = open_sessions[req.sessionID];

    var isbn = sanitizeInput(req.body.ISBN, true);

    var query = `DELETE FROM Ratings WHERE Username = "` + usr + `" AND ISBN = "` + isbn + `";`;

    await runQuerySafe(query, req, res);

    req.method = 'get';
    res.redirect("/reviews");
});

async function removeFriends(req,res,friendName=""){
    var switch_view_from=`<form action="/addfriend" method="POST">
    <div class="form-group">
 
    <p>
    <label for="friendName">Add by Name:</label>
    <input type="text" id="friendName" name="friendName">
    </p>
    <p>
    <button type="submit" class="btn btn-primary">Search</button>
    </p>
    </form>

    <form action="/removeFriend" method="POST">
    <div class="form-group">
    <p>
    <label for="RemoveFriendName">Remove by Name:</label>
    <input type="text" id="RemoveFriendName" name="RemoveFriendName">
    </p>
    <p>
    <button type="submit" class="btn btn-primary">Search</button>
    </p>
    </form>`;
    var switch_view_succeed_remove=`<form action="/addfriend" method="POST">
    <div class="form-group">
 
    <p>
    <label for="friendName">Add by Name:</label>
    <input type="text" id="friendName" name="friendName">
    </p>
    <p>
    <button type="submit" class="btn btn-primary">Search</button>
    </p>
    </form>

    <form action="/removeFriend" method="POST">
    <div class="form-group">
    <p>
    <label for="RemoveFriendName">Remove by Name:</label>
    <input type="text" id="RemoveFriendName" name="RemoveFriendName">
    </p>
    <p style="color:#FF0000";>Remove Succeed!</p>
    <p>
    <button type="submit" class="btn btn-primary">Search</button>
    </p>
    </form>`;
    friendName = sanitizeInput(friendName, true);

    var usr = open_sessions[req.sessionID];
    var friendExist = `SELECT count(*) as count FROM Friends WHERE GivesRecs="` + friendName + `";`;
    await runQuerySafe(friendExist, req, res);
    if(sql_response[sql_response.length - 1]['count']==0){
        html = createPage("Add/Remove Friend", switch_view_from);
        res.send(html);
    }else{
        var removeSQL=`DELETE FROM Friends WHERE GivesRecs="` + friendName + `";`;
        await runQuerySafe(removeSQL, req, res);
        var friendExist = `SELECT * FROM Friends WHERE WantsRecs="` + usr + `";`;
        await runQuerySafe(friendExist, req, res);
        table = convertSQLTable(sql_response);
        html = createPage("Add/Remove Friend", switch_view_succeed_remove, table);
        res.send(html);
    }

};

app.post('/removeFriend',async function(req,res,next) {
    if (!(req.sessionID in open_sessions)) {
        res.redirect('/');
    }
    var usr = open_sessions[req.sessionID];
    console.log('removing')

    req.method = 'get';
    removeFriends(req,res,req.body.RemoveFriendName);
});

//add a friend to My friend table
async function addFriends(req,res,friendName=""){
    var switch_view_from=`<form action="/addfriend" method="POST">
    <div class="form-group">
 
    <p>
    <label for="friendName">Add by Name:</label>
    <input type="text" id="friendName" name="friendName">
    </p>
    <p>
    <button type="submit" class="btn btn-primary">Search</button>
    </p>
    </form>

    <form action="/removeFriend" method="POST">
    <div class="form-group">
    <p>
    <label for="RemoveFriendName">Remove by Name:</label>
    <input type="text" id="RemoveFriendName" name="RemoveFriendName">
    </p>
    <p>
    <button type="submit" class="btn btn-primary">Search</button>
    </p>
    </form>`;
    var switch_view_succeed_add=`<form action="/addfriend" method="POST">
    <div class="form-group">
 
    <p>
    <label for="friendName">Add by Name:</label>
    <input type="text" id="friendName" name="friendName">
    </p>
    <p style="color:#FF0000";>Add Succeed!</p>
    <p>
    <button type="submit" class="btn btn-primary">Search</button>
    </p>
    </form>

    <form action="/removeFriend" method="POST">
    <div class="form-group">
    <p>
    <label for="RemoveFriendName">Remove by Name:</label>
    <input type="text" id="RemoveFriendName" name="RemoveFriendName">
    </p>
    <p>
    <button type="submit" class="btn btn-primary">Search</button>
    </p>
    </form>`;

    friendName = sanitizeInput(friendName, true);
    
    var usr = open_sessions[req.sessionID];

    var friendValid = `SELECT count(*) as count FROM Users WHERE Username="`+friendName+`";`;

    await runQuerySafe(friendValid, req, res);
    
    console.log(sql_response);
    if (sql_response[sql_response.length - 1]['count']==0){
        html = createPage("Add/Remove Friend", switch_view_from);
        res.send(html);
    } else {
        var friendExist = `SELECT count(*) as count FROM Friends WHERE GivesRecs="`+friendName+`";`;
        await runQuerySafe(friendExist, req, res);
        if(sql_response[sql_response.length - 1]['count']>0){

            var friendExist = `SELECT * FROM Friends WHERE WantsRecs="`+usr+`";`;
            await runQuerySafe(friendExist, req, res);
            console.log(sql_response);
            table = convertSQLTable(sql_response);
            html = createPage("Add/Remove Friend", switch_view_from,table);
            res.send(html);
        }else{

            var sqlQry=`INSERT INTO Friends(WantsRecs,GivesRecs) VALUES('`+usr+`', '`+friendName+`');`;
            await runQuerySafe(sqlQry, req, res);
            console.log(sql_response);
            var friendExist = `SELECT * FROM Friends WHERE WantsRecs="`+usr+`";`;
            await runQuerySafe(friendExist, req, res);
            table = convertSQLTable(sql_response);
            html = createPage("Add/Remove Friend", switch_view_succeed_add, table);
            res.send(html);
        }
    }
    
    return;
};

app.get('/addfriend',async function(req,res,next) {
    if (!(req.sessionID in open_sessions)) {
        res.redirect('/');
    }
    var usr = open_sessions[req.sessionID];
    addFriends(req,res);
});

app.post('/addfriend',async function(req,res,next) {
    if (!(req.sessionID in open_sessions)) {
        res.redirect('/');
    }
    var usr = open_sessions[req.sessionID];
    console.log(res.body)

    req.method = 'get';
    addFriends(req,res,req.body.friendName);
});

async function getBooks(req,res,bookTitle=""){
    var switch_view_form = `          
   <form action="/books" method="POST">
   <div class="form-group">

   <p>
   <label for="Title">Search by Title:</label>
   <input type="text" id="Title" name="Title">
   </p>
   <p>
   <button type="submit" class="btn btn-primary">Search</button>
   </p>
   </form>`;

   bookTitle = sanitizeInput(bookTitle, false);

   var sqlQry = `SELECT * FROM Books b where lower(b.Title) LIKE lower("%`+ bookTitle +`%") limit 50;`;
   await runQuerySafe(sqlQry, req, res);

   table = convertSQLTable(sql_response);
   html = createPage("Browse Books", switch_view_form, table);

   res.send(html);
   return;
};

app.get('/books',async function(req,res,next) {
    if (!(req.sessionID in open_sessions)) {
        res.redirect('/');
    }
    var usr = open_sessions[req.sessionID];
    getBooks(req,res);
});

//Push the user book title from user to web to select corresponding books
app.post('/books',async function(req,res,next) {
    if (!(req.sessionID in open_sessions)) {
        res.redirect('/');
    }
    var usr = open_sessions[req.sessionID];
    console.log(res.body)

    req.method = 'get';
    getBooks(req,res,req.body.Title);
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