const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("./models/User.js");
const Message = require("./models/Message.js");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const app = express();
const ws = require("ws");
const bcrypt = require("bcryptjs");
const jwtSecret = "your_jwt_secret";
const bcryptSalt = bcrypt.genSaltSync(10);
const fs = require("fs");

dotenv.config();
app.use(express.json());
app.use(cookieParser());

const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL + "/test", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connection to MongoDB successful");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};

connectToDatabase();

app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(
  cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
  })
);

app.get("/test", (req, res) => {
  res.json("test ok");
});

async function getUserDataFromRequest(req) {
  return new Promise((resolve, reject) => {
    const token = req.cookies?.token;
    if (token) {
      jwt.verify(token, jwtSecret, {}, (err, userData) => {
        if (err) {
          console.error("Error verifying token:", err);
          return res.status(401).json({ error: "Token verification failed" });
        }
        //res.json({ userData });
        resolve(userData);
      });
    } else {
      reject("no token");
    }
  });
}
app.get("/messages/:userId", async (req, res) => {
  //res.json(req.params);
  const { userId } = req.params;
  const userData = await getUserDataFromRequest(req);
  const ourUserId = userData.userId;
  const messages = await Message.find({
    sender: { $in: [userId, ourUserId] },
    recipient: { $in: [userId, ourUserId] },
  }).sort({ createdAt: 1 });
  res.json(messages);
});

app.get("/people", async (req, res) => {
  const users = await User.find({}, { _id: 1, username: 1 });
  res.json(users);
});

app.get("/profile", async (req, res) => {
  const token = req.cookies?.token;

  if (token) {
    jwt.verify(token, jwtSecret, {}, (err, userData) => {
      if (err) {
        console.error("Error verifying token:", err);
        return res.status(401).json({ error: "Token verification failed" });
      }
      res.json({ userData });
    });
  } else {
    //console.log("token not generated");
    //res.status(401).json("No token found");
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const foundUser = await User.findOne({ username });
  if (foundUser) {
    const passOk = bcrypt.compareSync(password, foundUser.password);
    if (passOk) {
      jwt.sign(
        { userId: foundUser.id, username },
        jwtSecret,
        {},
        (err, token) => {
          if (err) {
            console.error("Error generating JWT token:", err);
            return res.status(500).json({ message: "Internal server error." });
          }
          // Set the token in a cookie and send the response
          res.cookie("token", token, { sameSite: "none", secure: true }).json({
            id: foundUser._id,
          });
        }
      );
      console.log("token generated");
    }
  }
});

app.post("/logout", (req, res) => {
  res.cookie("token", "", { sameSite: "none", secure: true }).json("ok");
});

app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate username and password
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required." });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists." });
    }

    // Create a new user

    const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
    const createdUser = await User.create({
      username: username,
      password: hashedPassword,
    });
    console.log("User created successfully:", createdUser);

    jwt.sign(
      { userId: createdUser.id, username },
      jwtSecret,
      {},
      (err, token) => {
        if (err) {
          console.error("Error generating JWT token:", err);
          return res.status(500).json({ message: "Internal server error." });
        }
        // Set the token in a cookie and send the response
        res
          .cookie("token", token, { sameSite: "none", secure: true })
          .status(201)
          .json({
            id: createdUser._id,
          });
      }
    );
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});

const server = app.listen(4000, (req, res) => {
  console.log("Server Listening on Port 4000");
});

const wss = new ws.WebSocketServer({ server }); //all connections ares stored here

wss.on("connection", (connection, req) => {
  function notifyAboutOnlinePeople() {
    [...wss.clients].forEach((client) => {
      client.send(
        JSON.stringify({
          online: [...wss.clients].map((c) => ({
            userId: c.userId,
            username: c.username,
          })),
        })
      );
    });
  }

  connection.isAlive = true;

  connection.timer = setInterval(() => {
    connection.ping();
    connection.deathTimer = setTimeout(() => {
      connection.isAlive = false;
      clearInterval(connection.timer);
      connection.terminate();
      notifyAboutOnlinePeople();
      console.log("dead");
    }, 1000);
  }, 5000);

  connection.on("pong", () => {
    // console.log("pong");
    clearTimeout(connection.deathTimer);
  });

  //read username and id from the cookie for this connection
  const cookies = req.headers.cookie;
  if (cookies) {
    const cookieArray = cookies.split(";");

    // Find the cookie string that starts with 'token='
    const tokenCookieString = cookieArray.find((cookie) =>
      cookie.trim().startsWith("token=")
    );

    // If tokenCookieString is found, extract the token part

    /* for (let i = 0; i <tokenCookieString.length; i++) { */

    let token = null;
    if (tokenCookieString) {
      token = tokenCookieString.split("token=")[1];
      if (token) {
        //console.log(token);
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
          if (err) throw err;
          //console.log(userData);
          const { userId, username } = userData;
          connection.userId = userId;
          connection.username = username;
        });
      }
    }
    //}
  }

  connection.on("message", async (message) => {
    console.log("server side");
    const messageData = JSON.parse(message.toString());
    console.log(messageData);
    const { recipient, text, file } = messageData;
    let filename = null;

    if (file) {
      // Extracting file extension
      const parts = file.name.split(".");
      const ext = parts[parts.length - 1];
      // Generating a unique filename using current timestamp
      filename = Date.now() + "." + ext;

      // Constructing file path
      //const path= `${__dirname}/uploads/${filename}`;
      const path = __dirname + "/uploads/" + filename;

      // Decoding base64 data
      const base64Data = file.data.split(",")[1];
      const bufferData = Buffer.from(base64Data, "base64");

      // Writing file to disk
      fs.writeFile(path, bufferData, (err) => {
        if (err) {
          console.error("Error saving file:", err);
        } else {
          console.log("File saved:", path);
        }
      });
    }

    if (recipient && (text || file)) {
      const messageDoc = await Message.create({
        sender: connection.userId,
        recipient,
        text,
        file: file ? filename : null,
        //id:messageDoc._id,
      });
      console.log("created message");
      console.log(messageDoc);
      console.log("created message");

      [...wss.clients]
        .filter((c) => c.userId === recipient)
        .forEach((c) => {
          if (connection.userId) {
            c.send(
              JSON.stringify({
                text: messageData.text,
                sender: connection.userId,
                recipient,
                file:file?filename:null,
                _id: messageDoc._id,
              })
            );
          } else {
            // Handle case where connection.userId is not available
            console.log("Unable to determine sender's userId");
          }
        });
    }
  });

  //notify people about online people hen someone connects
  notifyAboutOnlinePeople();
});
