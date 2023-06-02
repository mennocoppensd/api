import express from "express";
import { ObjectId } from "mongodb";
import { initClient } from "./db/mongo.js";
import { registerMiddleware } from "./middleware/index.js";
import { createUserData } from "./middleware/auth/hash.js";
import { registerRoutes } from "./routes/routes.js";
import passport from "passport";
import LocalStrategy from "./middleware/auth/LocalStrategy.js";
import JwtStrategy from "./middleware/auth/JwtStrategy.js";
import jwt from "jsonwebtoken";

// create an Express app
const app = express();

// set the port for the server to listen on
const port = 3003;

// register routes

// register middleware
registerMiddleware(app);

app.use(passport.initialize());

passport.use("local", LocalStrategy);

passport.use("jwt", JwtStrategy);

// initialize MongoDB client and database
const client = await initClient();
const db = client.db();

// Creating the compound unique index for the 'favorites' collection
db.collection("favorites").createIndex(
  { userId: 1, propertyId: 1 },
  { unique: true }
);

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    // Check if the username already exists
    const existingUser = await db.collection("users").findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Create a new user
    const newUser = createUserData({ username, password });

    // Insert the user into the database
    await db.collection("users").insertOne(newUser);

    // Generate a new token for the registered user
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN_HOURS * 60,
    });

    delete newUser.password;
    delete newUser.salt;
    delete newUser.saltParam;
    res.json({ token, ...newUser });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

registerRoutes(app);

// define a router for authenticated routes
const authRouter = express.Router();

// middleware for authentication
authRouter.use(async (req, res, next) => {
  // check if authorization header exists
  if (req.headers.authorization) {
    // check if user with id exists
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(req.headers.authorization) });
    // if user exists, pass user object to the request object
    if (user) {
      req.user = user;
      return next();
    }
  }
  // if user not authenticated, send back 401 error
  res.status(401).json({
    error: "Unauthorized",
  });
});

// define a route to get all properties
authRouter.get("/search", async (req, res) => {
  console.log(req.user);
  const properties = await db.collection("properties").find().toArray();
  res.json(properties);
});
authRouter.get("/properties", async (req, res) => {
  console.log(req.user);
  const properties = await db.collection("properties").find().toArray();
  res.json(properties);
});

// define a route to add a new property
authRouter.post("/properties", async (req, res) => {
  const property = {
    image: "https://picsum.photos/200/300",
    ...req.body,
  };

  await db.collection("properties").insertOne(property);

  // return added property
  res.json(property);
});

// define a route to get a property by id
authRouter.get("/properties/:id", async (req, res) => {
  const id = req.params.id;
  const property = await db.collection("properties").findOne({
    _id: new ObjectId(id),
  });

  // if property exists, send back property object
  if (property) {
    res.json(property);
  } else {
    // if property not found, send back 404 error
    res.status(404).json({ error: "Not found" });
  }
});

// define a route to update a property by id
authRouter.patch("/properties/:id", async (req, res) => {
  const id = req.params.id;

  // check if property exists
  const property = await db
    .collection("properties")
    .findOne({ _id: new ObjectId(id) });

  // if property exists, update property data
  if (property) {
    const { _id, ...data } = req.body;
    const newData = { ...property, ...data };
    await db
      .collection("properties")
      .replaceOne({ _id: new ObjectId(id) }, newData);

    res.json(newData);
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

// DELETE
authRouter.delete("/properties/:id", async (req, res) => {
  console.log(req.params.id);
  try {
    const id = req.params.id;

    await db.collection("properties").deleteOne({
      _id: new ObjectId(id),
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
  res.json({});
});

// Messages

authRouter.post("/chat/:officeId/:propertyId", async (req, res) => {
  const messageData = req.body;

  try {
    const messages = db.collection("messages");
    const result = await messages.insertOne(messageData);

    if (result.insertedCount === 1) {
      res.status(200).json(result.ops[0]);
    } else {
      throw new Error("Message insertion failed");
    }
  } catch (error) {
    res.status(500).json({ error: "Error saving message" });
  }
});

authRouter.patch("/chat/:messageId/read", async (req, res) => {
  const messageId = req.params.messageId;

  try {
    const messages = db.collection("messages");
    const result = await messages.updateOne(
      { _id: new ObjectId(messageId) },
      { $set: { read: true } }
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({ message: "Message marked as read" });
    } else {
      throw new Error("Message update failed");
    }
  } catch (error) {
    res.status(500).json({ error: "Error marking message as read" });
  }
});

app.use(async (req, res, next) => {
  if (req.headers.authorization) {
    // check if user with id exists
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(req.headers.authorization) });
    // exists? pass user to request
    if (user) {
      req.user = user;
      return next();
    }
  }
  res.status(401).json({
    error: "Unauthorized",
  });
}, authRouter);

app.listen(port, () => {
  console.log(`App listening http://localhost:${port}`);
});

// make sure database is closed when server crashes
const closeServer = () => {
  // default
  process.exit();
};

process.on("SIGINT", () => closeServer());
process.on("SIGTERM", () => closeServer());
//https://www.geeksforgeeks.org/node-js-process-signal-events/
