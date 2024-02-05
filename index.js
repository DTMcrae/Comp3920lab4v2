require("./utils.js");
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mySQL = require("mysql2");
const bcrypt = require('bcrypt');
const saltRounds = 12;

const port = process.env.PORT || 3000;

const app = express();

const Joi = require("joi");

const expireTime = 24 * 60 * 60 * 1000;

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;

const freedb_host = process.env.FREEDB_HOST;
const freedb_database = process.env.FREEDB_DATABASE;
const freedb_port = process.env.FREEDB_PORT;
const freedb_user = process.env.FREEDB_USER;
const freedb_password = process.env.FREEDB_PASSWORD;

const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

var members = mySQL.createPool({
                host: freedb_host,
                user: freedb_user,
                password: freedb_password,
                database: freedb_database
              });

app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname + "/public"));

var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}.i0p5mcg.mongodb.net/${mongodb_database}`,
    crypto: {
        secret: mongodb_session_secret
    }
})

app.use(session({
    secret: node_session_secret,
    store: mongoStore, //default is memory store 
    saveUninitialized: false,
    resave: true
}
));

app.get('/', (req, res) => {
    var html = ``;

    if(!req.session.authenticated)
    {
        html += `
        <a href="signup"><button>Sign up</button></a>
        <br>
        <a href="login"><button>Log in</button></a>`;
        
    }
    else
    {
        html += `
        Hello, ` + req.session.name + `!
        <br>
        <a href="members"><button>Go to Member Area</button></a>
        <br>
        <a href="logout"><button>Log out</button></a>`;
    }

    res.send(html);
});

app.get('/signup', (req, res) => {
    var html = `
    <form action='/signupSubmit' method='post'>
    create user
    <br>
    <input name='username' type='text' placeholder='username'>
    <br>
    <input name='password' type='password' placeholder='password'>
    <br>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.post('/signupSubmit', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;

    const nameSchema = Joi.string().required();
    const passSchema = Joi.string().required();

    if((nameSchema.validate(username)).error != null)
    {
        res.send(`
        Your username is required.
        <br><br>
        <a href="/signup">Try again</a>
        `);
        return;
    }
    else if (passSchema.validate(password).error != null) {
        res.send(`
        A password is required.
        <br><br>
        <a href="/signup">Try again</a>
        `);
        return;
    }
    else
    {
        var hashedPassword = await bcrypt.hash(password, saltRounds);

        var query = 'INSERT INTO members (username, password) VALUES (?, ?)';
        members.query(query, [username, hashedPassword], (err, result) => {
          if (err) throw err;

          console.log('Account created!');
        });

        req.session.authenticated = true;
        req.session.name = username;
        req.session.cookie.maxAge = expireTime;
        res.redirect("/members");
        return;
    }
});

app.get('/login', (req, res) => {
    var html = `
    log in
    <form action='/loginSubmit' method='post'>
    <input name='username' type='text' placeholder='username'>
    <br>
    <input name='password' type='password' placeholder='password'>
    <br>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.post('/loginSubmit', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;

    var failResponce = `
        Invalid username/password combination.
        <br><br>
        <a href="/login">Try again</a>
        `;

    const nameSchema = Joi.string().required();
    const passSchema = Joi.string().required();

    var validationResult = nameSchema.validate(username);
    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.send(failResponce);
        return;
    }

    var validationResult = passSchema.validate(password);
    if(validationResult.error != null)
    {
        console.log(validationResult.error);
        res.send(failResponce);
        return;
    }

    var query = 'SELECT username,password FROM members WHERE username = ?';
    members.query(query, [username], (err, result) => {
      if (err) throw err;

      if (result.length > 0) {
        if (bcrypt.compareSync(password, result[0].password)) {
                req.session.authenticated = true;
                req.session.name = result[0].username;
                req.session.cookie.maxAge = expireTime;

                res.redirect('/members');
                return;
        }
        else {
        console.log("Incorrect password");
        }
      } else {
        console.log('Username does not exist.');
      }
      res.send(failResponce);
      return;
    });
});

app.get('/members', (req, res) => {

    if (!req.session.authenticated) {
        res.redirect('/');
        return;
    }

    var html = `
    <a2>Hello, ` + req.session.name + `.
    <br>
    `;

    var cat = (Math.random() * 2);
    switch(Math.round(cat))
    {
        case 0:
            html += `<img src='/sandy.jpg' style='width:250px;'>`;
            break;
        case 1:
            html += `<img src='/snowflake.jpg' style='width:250px;'>`;
            break;
        case 2:
            html += `<img src='/kittens.jpg' style='width:250px;'>`;
            break;
        default:
            html += `The cats are unavailable at the moment...`;
            break;
    }
    
    html += `
    <br>
    <a href="/logout"><button>Sign out</button></a>
    `;
    res.send(html);
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get("*", (req, res) => {
    res.status(404);
    res.send("Page not found - 404");
})

app.listen(port, () => {
    console.log("Node application listening on port " + port);
}); 