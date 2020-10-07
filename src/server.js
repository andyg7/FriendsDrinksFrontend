global.fetch = require('node-fetch');

let http = require('http');
let express = require('express');
let auth = require('./auth');
let bodyParser = require('body-parser')
let cookieParser = require('cookie-parser')

const SESSION_KEY = "X-Friendsdrinks-Session-Id";

const INTERNAL_ERROR_MESSAGE = "Whoops! Something went wrong :(";

function createServer(userManagement, backendConfig) {
        let app = express();

        app.set('views', __dirname + '/views');
        app.set('view engine', 'ejs');

        app.use(bodyParser.urlencoded({extended: true}));
        app.use(cookieParser())
        app.use(express.static(__dirname + '/public'));
        app.use(function(req, res, next) {
            console.log("request:", req.method, req.url, req.body, req.cookies);
            next();
        });

        let backendHostname = backendConfig.hostname
        let backendPort = backendConfig.port

        app.get('/', function (req, res) {
            const sessionId = req.cookies[SESSION_KEY];
            if (!sessionId) {
                res.redirect('/login');
                return;
            }
            const username = userManagement.getLoggedInUser(sessionId);
            if (username === null) {
                resetHttpResponseCookieAndRedirect(res)
                return;
            }
            let options = {
              host: backendHostname,
              port: backendPort,
              path: "/v1/users/" + username
            };

            let backendReq = http.get(options, function(backendRes) {
              console.log('STATUS: ' + backendRes.statusCode);
              console.log('HEADERS: ' + JSON.stringify(backendRes.headers));
              if (backendRes.statusCode !== 200) {
                 backendRes.resume();
                 res.status(500);
                 res.send(INTERNAL_ERROR_MESSAGE);
                 return;
              }

              let bodyChunks = [];
              backendRes.on('data', function(chunk) {
                bodyChunks.push(chunk);
              }).on('end', function() {
                let body = Buffer.concat(bodyChunks);
                console.log('BODY: ' + body);
                const obj = JSON.parse(body);

                adminFriendsDrinks = []
                // http.get(...) on batch of IDs
                if (obj.adminFriendsDrinksIds && obj.adminFriendsDrinksIds.length > 0) {
                    let listOfFriendsDrinksUuids = obj.adminFriendsDrinksIds.map(x => x.uuid)

                    obj.adminFriendsDrinksIds.forEach(function (item, index) {
                        let friendsDrinksUuid = item.uuid;
                        adminFriendsDrinks.push(
                           {
                              id: item.uuid
                           }
                        )
                    });
                }

                memberFriendsDrinks = []
                // http.get(...) on batch of IDs
                if (obj.memberFriendsDrinksIds && obj.memberFriendsDrinksIds.length > 0) {
                    obj.memberFriendsDrinksIds.forEach(function (item, index) {
                        memberFriendsDrinks.push(
                           {
                              id: item.uuid
                           }
                        )
                    });
                }

                invitations = []
                if (obj.invitations && obj.invitations.length > 0) {
                    obj.invitations.forEach(function (item, index) {
                        invitations.push(
                           {
                              message: item.message,
                              adminUserId: item.friendsDrinksId.adminUserId,
                              friendsDrinksUuid: item.friendsDrinksId.uuid
                           }
                        )
                    });
                }

                res.render('index', {
                    username: username,
                    adminFriendsDrinks: adminFriendsDrinks,
                    memberFriendsDrinks: memberFriendsDrinks,
                    invitations: invitations
                });
              })
            });

            backendReq.on('error', function(e) {
              console.log('ERROR: ' + e.message);
              res.status(500);
              res.send(INTERNAL_ERROR_MESSAGE);
              return;
            });


        })

        app.post('/friendsdrinks/delete', function (req, res) {
          const sessionId = req.cookies[SESSION_KEY];
          if (!sessionId) {
            res.redirect('/login')
            return;
          }
          const username = userManagement.getLoggedInUser(sessionId);
          if (username === null) {
            resetHttpResponseCookieAndRedirect(res)
            return;
          }
          path = "/v1/users/" + username + "/adminfriendsdrinks/" + req.body.id;
          options = {
             host: backendHostname,
             port: backendPort,
             method: 'DELETE',
             path: path
          }

          let backendReq = http.request(options, function(backendRes) {
              console.log('STATUS:' + backendRes.statusCode);
              console.log('HEADERS: ' + JSON.stringify(backendRes.headers));
              if (backendRes.statusCode !== 200) {
                 backendRes.resume();
                 res.status(500);
                 res.send(INTERNAL_ERROR_MESSAGE);
                 return;
              }
              let bodyChunks = [];
              backendRes.on('data', (chunk) => {
                bodyChunks.push(chunk)
              });
              backendRes.on('end', () => {
                let body = Buffer.concat(bodyChunks);
                console.log('BODY: ' + body);
                const obj = JSON.parse(body);
                console.log('Result ', obj.result);

                console.log('No more data in response - redirecting to /');
                res.redirect('/')
                return;
              });

          })

          backendReq.on('error', function(e) {
            console.log('ERROR: ' + e.message);
            res.status(500);
            res.send(INTERNAL_ERROR_MESSAGE);
            return;
          });

          console.log("Sending DELETE request", options)
          backendReq.end();
          return;
        })

        app.post('/friendsdrinks/removeUser', function (req, res) {
            const sessionId = req.cookies[SESSION_KEY];
            if (!sessionId) {
                res.redirect('/login')
                return;
             }
            const username = userManagement.getLoggedInUser(sessionId);
            if (username === null) {
                resetHttpResponseCookieAndRedirect(res)
                return;
            }
            let path = "/v1/users/" + username
            let postObj = {
              userIdToRemove: username,
              eventType: 'REMOVE_USER',
              adminUserId: req.body.adminUserId,
              friendsDrinksUuid: req.body.id
            }
            const postData = JSON.stringify(postObj)
            let options = {
              host: backendHostname,
              port: backendPort,
              path: path,
              method: 'POST',
              headers: {
                  'Content-Length': Buffer.byteLength(postData),
                  'Content-Type': 'application/json'
              }
            };

            let backendReq = buildHttpRequest(options, res)
            console.log("Sending request", postData)
            backendReq.write(postData);
            backendReq.end();
            return;
        })

        app.post('/friendsdrinks/addUser', function (req, res) {
            const sessionId = req.cookies[SESSION_KEY];
            if (!sessionId) {
                res.redirect('/login')
                return;
             }
            const username = userManagement.getLoggedInUser(sessionId);
            if (username === null) {
                resetHttpResponseCookieAndRedirect(res)
                return
            }
            let postObj = {
              userId: req.body.userId,
              eventType: 'ADD_USER',
              friendsDrinksUuid: req.body.id
            }
            let path = "/v1/users/" + username

            const postData = JSON.stringify(postObj)

            let options = {
              host: backendHostname,
              port: backendPort,
              path: path,
              method: 'POST',
              headers: {
                  'Content-Length': Buffer.byteLength(postData),
                  'Content-Type': 'application/json'
              }
            };

            let backendReq = buildHttpRequest(options, res)

            console.log("Sending request", postData)
            backendReq.write(postData);
            backendReq.end();
            return;
        })

        app.post('/friendsdrinks/replyToInvitation', function (req, res) {
            const sessionId = req.cookies[SESSION_KEY];
            if (!sessionId) {
                res.redirect('/login')
                return;
             }
            const username = userManagement.getLoggedInUser(sessionId);
            if (username === null) {
                resetHttpResponseCookieAndRedirect(res)
                return
            }
            let postObj = {
              eventType: 'REPLY_TO_INVITATION',
              adminUserId: req.body.adminUserId,
              friendsDrinksUuid: req.body.id,
              invitationReply: req.body.invitationReply
            }
            let path = "/v1/users/" + username

            const postData = JSON.stringify(postObj)

            let options = {
              host: backendHostname,
              port: backendPort,
              path: path,
              method: 'POST',
              headers: {
                  'Content-Length': Buffer.byteLength(postData),
                  'Content-Type': 'application/json'
              }
            };

            let backendReq = buildHttpRequest(options, res)

            console.log("Sending request", postData)
            backendReq.write(postData);
            backendReq.end();
            return;
        })

        app.post('/friendsdrinks/update', function (req, res) {
            const sessionId = req.cookies[SESSION_KEY];
            if (!sessionId) {
                res.redirect('/login')
                return;
             }
            const username = userManagement.getLoggedInUser(sessionId);
            if (username === null) {
                resetHttpResponseCookieAndRedirect(res)
                return;
            }
            let postObj = {
              name: req.body.name
            }
            let path = "/v1/users/" + username + "/adminfriendsdrinks/" + req.body.id

            const postData = JSON.stringify(postObj)

            let options = {
              host: backendHostname,
              port: backendPort,
              path: path,
              method: 'POST',
              headers: {
                  'Content-Length': Buffer.byteLength(postData),
                  'Content-Type': 'application/json'
              }
            };

            let backendReq = buildHttpRequest(options, res)

            console.log("Sending request", postData)
            backendReq.write(postData);
            backendReq.end();
            return;
        })

        app.post('/friendsdrinks/create', function (req, res) {
            const sessionId = req.cookies[SESSION_KEY];
            if (!sessionId) {
                res.redirect('/login')
                return;
             }
            const username = userManagement.getLoggedInUser(sessionId);
            if (username === null) {
                resetHttpResponseCookieAndRedirect(res)
                return;
            }
            let path = "/v1/users/" + username + "/adminfriendsdrinks"
            let postObj = {
              name: req.body.name
            }
            const postData = JSON.stringify(postObj)
            let options = {
              host: backendHostname,
              port: backendPort,
              path: path,
              method: 'POST',
              headers: {
                  'Content-Length': Buffer.byteLength(postData),
                  'Content-Type': 'application/json'
              }
            };
            let backendReq = buildHttpRequest(options, res)

            console.log("Sending request", postData)
            backendReq.write(postData);
            backendReq.end();
            return;
        })

        function buildHttpRequest(options, res) {
            let backendReq = http.request(options, function(backendRes) {
              console.log('STATUS: ' + backendRes.statusCode);
              console.log('HEADERS: ' + JSON.stringify(backendRes.headers));
              if (backendRes.statusCode !== 200) {
                 backendRes.resume();
                 res.status(500);
                 res.send(INTERNAL_ERROR_MESSAGE);
                 return;
              } else {
                  let bodyChunks = [];
                  backendRes.on('data', (chunk) => {
                    bodyChunks.push(chunk)
                  });
                  backendRes.on('end', () => {
                    let body = Buffer.concat(bodyChunks);
                    console.log('BODY: ' + body);
                    const obj = JSON.parse(body);
                    console.log('Result ', obj.result);

                    console.log('No more data in response - redirecting to /');
                    res.redirect('/')
                    return;
                  });
              }
            });

            backendReq.on('error', function(e) {
              console.log('ERROR: ' + e.message);
              res.status(500);
              res.send(INTERNAL_ERROR_MESSAGE);
              return;
            });

            return backendReq;
        }

        app.get('/signup', function (req, res) {
           res.sendFile( __dirname + "/views/" + "signup.html" );
           return;
        })


        app.post('/signup', function (req, res) {
            let email = req.body.email;
            if (!email) {
                res.statusCode = 400;
                res.send('You need to provide an email');
                return;
            }
            let password = req.body.password;
            if (!password) {
                res.statusCode = 400;
                res.send('You need to provide a password');
                return;
            }
            userManagement.signup(email, password).then(function (user) {
                res.render('signup_complete', {username: user.username});
            }).catch(function (err) {
                console.log(err);
                res.status(500);
                res.send(INTERNAL_ERROR_MESSAGE);
                return;
            });
        })

        app.get('/login', function (req, res) {
           res.sendFile( __dirname + "/views/" + "login.html" );
           return;
        })

        app.post('/login', function (req, res) {
            let email = req.body.email;
            if (!email) {
                res.statusCode = 400;
                res.send('You need to provide an email');
                return;
            }
            let password = req.body.password;
            if (!password) {
                res.statusCode = 400;
                res.send('You need to provide a password');
                return;
            }
            userManagement.login(email, password).then(function (data) {
                let sessionId = data.sessionId;
                console.log("Setting session id in cookie to ", sessionId);
                res.cookie(SESSION_KEY, sessionId, {
                    path: '/'
                });
                res.redirect('/');
                return;
            }).catch(function (err) {
                console.log(err);
                if (err.code === 'NotAuthorizedException') {
                    res.status(403);
                    res.send("Wrong password");
                    return;
                } else {
                    res.status(500);
                    res.send(INTERNAL_ERROR_MESSAGE);
                    return;
                }
            });
        })

        app.get('/logout', function (req, res) {
            res.render('logout');
        });

        app.post('/logout', function (req, res) {
            const sessionId = req.cookies[SESSION_KEY];
            console.log("session id received from browser: " + sessionId);
            if (!sessionId) {
                res.redirect('/login');
                return;
            }
            const username = userManagement.getLoggedInUser(sessionId);
            if (username === null) {
                resetHttpResponseCookieAndRedirect(res)
                return;
            }
            let loggedInUser = new auth.LoggedInUser(new auth.User(username), sessionId);
            userManagement.logout(loggedInUser);
            res.cookie(SESSION_KEY, "", {
                path: '/',
                expires: new Date(1)
            });
            res.send("You're logged out!");
            return;
        });

        app.get('/forgotpassword', function (req, res) {
           res.sendFile( __dirname + "/views/" + "forgot_password.html" );
           return;
        })

        app.post('/forgotpassword', function (req, res) {
            let email = req.body.email;
            if (!email) {
                res.statusCode = 400;
                res.send('You need to provide an email');
                return;
            }
            userManagement.forgotPassword(email, res).then(function (data) {
                res.redirect('/resetpassword');
                return;
            }).catch(function (err) {
                console.log(err);
                res.status(500);
                res.send(INTERNAL_ERROR_MESSAGE);
                return;
            });
        })

        app.get('/resetpassword', function (req, res) {
           res.sendFile( __dirname + "/views/" + "reset_password.html" );
           return;
        })

        app.post('/resetpassword', function (req, res) {
            let verificationCode = req.body.verificationCode;
            if (!verificationCode) {
                res.statusCode = 400;
                res.send('You need to provide a verification code');
                return;
            }

            let email = req.body.email;
            if (!email) {
                res.statusCode = 400;
                res.send('You need to provide an email');
                return;
            }

            let newPassword = req.body.newPassword;
            if (!newPassword) {
                res.statusCode = 400;
                res.send('You need to provide a new password');
                return;
            }

            userManagement.resetPassword(verificationCode, email, newPassword, res).then(function (data) {
                console.log('redirecting')
                res.redirect('/login');
                return;
            }).catch(function (err) {
                console.log(err);
                res.status(500);
                res.send(INTERNAL_ERROR_MESSAGE);
                return;
            });
        })

        function resetHttpResponseCookieAndRedirect(res) {
            console.log("Resetting http cookies")
            res.cookie(SESSION_KEY, "", {
                path: '/',
                expires: new Date(1)
            });
            res.redirect('/login')
        }

        return app
}

module.exports = createServer


