import { Router } from "express";
import passport from "passport";
import { ObjectId } from "mongodb";
import jwt from "jsonwebtoken";
import { initClient } from "../db/mongo.js";
import { createUserData, hash } from "../middleware/auth/hash.js";

//Initialize MongoDB client and database:
const client = await initClient();
const db = client.db();

const registerRegularRoutes = (app) => {
  app.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user) => {
      if (err) {
        return res.status(500).json({ error: "Internal Server Error" });
      }
      if (!user) {
        return res.status(401).json({ error: "No user found" });
      }
      if (user) {
        const givenPassword = hash(user, req.body.password);
        if (givenPassword !== user.password) {
          return res
            .status(401)
            .json({ error: "Invalid username or password" });
        }
      }

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN_HOURS * 60 * 60,
      });

      delete user.password;
      delete user.salt;
      delete user.saltParam;
      return res.json({ token, ...user });
    })(req, res, next);
  });

  app.get("/properties", async (req, res) => {
    const properties = await db.collection("properties").find().toArray();
    res.json(properties);
  });

  app.post("/chat/:officeId/:propertyId", async (req, res) => {
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

  app.patch("/chat/:messageId/read", async (req, res) => {
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
};

const registerAdminRoutes = (app) => {
  const adminRouter = Router();

  adminRouter.use(
    passport.authenticate("jwt", { session: false, failWithError: true })
  );

  // properties routes

  adminRouter.post("/properties", async (req, res) => {
    const property = {
      image: "https://picsum.photos/200/300",
      ...req.body,
    };

    await db.collection("properties").insertOne(property);

    res.json(property);
  });

  adminRouter.patch("/properties/:id", async (req, res) => {
    const id = req.params.id;
    const property = await db.collection("properties").findOne({
      _id: new ObjectId(id),
    });

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

  adminRouter.get("/properties/:id", async (req, res) => {
    const id = req.params.id;
    const property = await db.collection("properties").findOne({
      _id: new ObjectId(id),
    });

    if (property) {
      res.json(property);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });

  adminRouter.delete("/properties/:id", async (req, res) => {
    const id = req.params.id;

    await db.collection("properties").deleteOne({
      _id: new ObjectId(id),
    });

    res.json({});
  });

  // Estate Offices
  adminRouter.post("/estate-offices", async (req, res) => {
    const estateOffice = {
      image: null,
      ...req.body,
    };

    if (req.files && req.files.image) {
      estateOffice.image = req.files.image.data;
    }

    await db.collection("estate-offices").insertOne(estateOffice);

    res.json(estateOffice);
  });

  adminRouter.patch("/estate-offices/:id", async (req, res) => {
    const id = req.params.id;
    const estateOffice = await db.collection("estate-offices").findOne({
      _id: new ObjectId(id),
    });

    if (estateOffice) {
      const { _id, ...data } = req.body;
      const newData = { ...estateOffice, ...data };
      await db
        .collection("estate-offices")
        .replaceOne({ _id: new ObjectId(id) }, newData);

      res.json(newData);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });

  adminRouter.get("/estate-offices/:id", async (req, res) => {
    const id = req.params.id;
    const estateOffice = await db.collection("estate-offices").findOne({
      _id: new ObjectId(id),
    });

    if (estateOffice) {
      res.json(estateOffice);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });

  adminRouter.delete("/estate-offices/:id", async (req, res) => {
    const id = req.params.id;

    await db.collection("estate-offices").deleteOne({
      _id: new ObjectId(id),
    });

    res.json({});
  });

  app.get("/estate-offices", async (req, res) => {
    const estateOffices = await db
      .collection("estate-offices")
      .find()
      .toArray();
    res.json(estateOffices);
  });

  // Users

  adminRouter.post("/users", async (req, res) => {
    const user = {
      image: "https://picsum.photos/200/300",
      ...req.body,
    };

    await db.collection("users").insertOne(user);

    res.json(user);
  });

  adminRouter.patch("/users/:id", async (req, res) => {
    const id = req.params.id;
    const user = await db.collection("users").findOne({
      _id: new ObjectId(id),
    });

    if (user) {
      const { _id, ...data } = req.body;
      const newData = { ...user, ...data };
      await db
        .collection("users")
        .replaceOne({ _id: new ObjectId(id) }, newData);

      res.json(newData);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });

  adminRouter.get("/users/:id", async (req, res) => {
    const id = req.params.id;
    const user = await db.collection("users").findOne({
      _id: new ObjectId(id),
    });

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });

  adminRouter.delete("/users/:id", async (req, res) => {
    const id = req.params.id;

    await db.collection("users").deleteOne({
      _id: new ObjectId(id),
    });

    res.json({});
  });

  // define a route to add a property to favorites
  adminRouter.post("/favorites/:id", async (req, res) => {
    const propertyId = req.params.id;
    const token = req.headers.authorization.split(" ")[1];
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.id;

    const favorite = {
      userId: new ObjectId(userId),
      propertyId: new ObjectId(propertyId),
    };

    try {
      await db.collection("favorites").insertOne(favorite);
      res.json(favorite);
    } catch (err) {
      if (err.code === 11000) {
        // duplicate key error
        res
          .status(400)
          .json({ message: "You have already favorited this property." });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // define a route to remove a property from favorites
  adminRouter.delete("/favorites/:propertyId", async (req, res) => {
    const propertyId = req.params.propertyId;
    const token = req.headers.authorization.split(" ")[1];
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.id;

    try {
      const result = await db
        .collection("favorites")
        .deleteOne({
          userId: new ObjectId(userId),
          propertyId: new ObjectId(propertyId),
        });
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Favorite not found" });
      }
      res.json({ message: "Favorite removed" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // route handler on the server
  adminRouter.get("/favorites/:userId", async (req, res) => {
    const userId = req.params.userId;

    const favorites = await db
      .collection("favorites")
      .find({ userId: new ObjectId(userId) })
      .toArray();

    res.json(favorites);
  });

  app.get("/users", async (req, res) => {
    const users = await db.collection("users").find().toArray();
    res.json(users);
  });

  // define a route to get all categories
  adminRouter.get("/categories", async (req, res) => {
    const categories = await db.collection("categories").find().toArray();
    res.json(categories);
  });

  // define a route to add a new category
  adminRouter.post("/categories", async (req, res) => {
    const category = {
      image: "https://picsum.photos/200/300",
      ...req.body,
    };

    await db.collection("categories").insertOne(category);

    // return added category
    res.json(category);
  });

  // define a route to get a category by id
  adminRouter.get("/categories/:id", async (req, res) => {
    const id = req.params.id;
    const category = await db.collection("categories").findOne({
      _id: new ObjectId(id),
    });

    // if category exists, send back category object
    if (category) {
      res.json(category);
    } else {
      // if category not found, send back 404 error
      res.status(404).json({ error: "Not found" });
    }
  });

  // define a route to update a category by id
  adminRouter.patch("/categories/:id", async (req, res) => {
    const id = req.params.id;

    // check if category exists
    const category = await db
      .collection("categories")
      .findOne({ _id: new ObjectId(id) });

    // if category exists, update category data
    if (category) {
      const { _id, ...data } = req.body;
      const newData = { ...category, ...data };
      await db
        .collection("categories")
        .replaceOne({ _id: new ObjectId(id) }, newData);

      res.json(newData);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });

  // DELETE
  adminRouter.delete("/categories/:id", async (req, res) => {
    const id = req.params.id;

    await db.collection("categories").deleteOne({
      _id: new ObjectId(id),
    });

    res.json({});
  });

  app.use(adminRouter);
};

const registerRoutes = async (app) => {
  registerRegularRoutes(app);

  registerAdminRoutes(app);

  //// Custom error handler middleware to handle JWT authentication errors
  app.use((err, req, res, next) => {
    if (err.name === "AuthenticationError") {
      res.status(401).json({ error: "Token expired" });
    } else {
      console.log(err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
};

export { registerRoutes };
