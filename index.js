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

    return head + nav_bar + page_header + extraHtml + table + tail;
}
 
// GET home page, respond by rendering index.ejs
app.get('/', function(req, res) {
        res.render('index', { title: 'Login' });
});

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

// FIXME: If click on book, link to a page with reviews of it
async function recommendation_page(minRating, minSimilar, rate_table, req, res) {
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

    await recommendation_page(req.body.minRatingSlider, req.body.minSimilarSlider, req.body.rec_table, req, res);

});

// FIXME: Browse books, my friends/reviews, show reviews per book, single book page with add/rm/edit review
//send a table of books back to user, along with friends' review
/*app.post('/books',async function(req,res,next) {
    var switch_view_form = `          
   <form action="/showbook" method="POST">
   <div class="form-group">

   <p>
   <button type="submit" class="btn btn-primary">Submit</button>
   </p>
   </form>`;
   var usr = open_sessions[req.sessionID];
    if (!(req.sessionID in open_sessions)) {
        res.redirect('/');
    }
    var bookTitle= req.body.bookTitle;
    if (bookTitle){
        var sqlQry="SELECT b.ISBN,b.Title,rl.Score, ra.Rating, ra.Description FROM Books b NATURAL JOIN Ratings ra LEFT OUTER JOIN RateList rl USING(ISBN)  where b.Title LIKE '%"+ bookTitle+"%'";
    
    }else{
        var isbn = req.body.ISBN;
        var sqlQry="SELECT b.ISBN,b.Title,rl.Score, ra.Rating, ra.Description FROM Books b NATURAL JOIN Ratings ra LEFT OUTER JOIN RateList rl USING(ISBN)  where b.ISBN = "+isbn+"";
    }
    //var sqlQry="SELECT b.ISBN,b.Title,rl.Score, ra.Rating, ra.Description FROM Books b NATURAL JOIN Ratings ra LEFT OUTER JOIN RateList rl USING(ISBN)  where b.Title LIKE '%${bookTitle}%'"
    await runQuerySafe(sqlQry, req, res);
    table = convertSQLTable(sql_response);
    html = createPage("bookReview", switch_view_form, table);

    res.send(html);
    return;
});*/

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