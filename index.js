const express = require("express");
const app = express();
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();
const port = process.env.PORT || 5000;
app.use(express.json());

app.use(
  cors({
    origin: [
      "http://localhost:5175",
      "http://localhost:5173",
      "https://glittery-longma-7bd21c.netlify.app",
    ],
    credentials: true,
    optionSuccessStatus: 200,
  })
);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.uztm9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const dataBase = client.db("DIU_Connect");

    app.post("/gps", async function (req, res) {
      const Collection = dataBase.collection("gps");
      const gps_info = req.body;
      const result = await Collection.insertOne(gps_info);
      return res.send(result);
    });

    app.post("/add-user", async function (req, res) {
      const Collection = dataBase.collection("users");
      const user_info = req.body;
      const result = await Collection.insertOne(user_info);
      return res.send(result);
    });

    app.post("/mark-location", async function (req, res) {
      const Collection = dataBase.collection("student_location");
      const location_info = req.body;
      const { data: student_info } = await axios.get(
        `${process.env.BASE}/student/${location_info?.studentID}`
      );
      if (student_info) {
        if (student_info.money < 20)
          return res.status(503).send({
            message: "Sorry you don't have enough money.",
            Balance: student_info.money,
          });
        else {
          const is_already_shared_location = await Collection.findOne({
            studentID: student_info?.studentID,
          });
          if (is_already_shared_location)
            return res
              .status(409)
              .send({ message: "You already shared your location" });
          const booking_collection = dataBase.collection("booking");
          const is_already_in_bus = await booking_collection.findOne({
            studentID: student_info?.studentID,
          });
          if (is_already_in_bus)
            return res.status(409).send({ message: "You already in the bus." });
          student_info.geocode = location_info.geocode;
          const result = await Collection.insertOne(student_info);
          return res.status(200).send(result);
        }
      } else {
        return res.status(404).send({ message: "User is not registered" });
      }
    });

    app.post("/unmark-location", async (req, res) => {
      const { id } = req.body;
      const Collection = dataBase.collection("student_location");
      const user = await Collection.findOne({ studentID: id });
      if (user) {
        await Collection.deleteOne({ studentID: id });
        return res.status(200).send();
      }
      return res
        .status(404)
        .send({ message: "You didn't share the location." });
    });

    app.post("/get-bus-by-destination", async (req, res) => {
      // console.log(res.body);
      const { date, from, to } = req.body;
      const Collection = dataBase.collection("bus-schedules");

      // Find documents that match the date and have a route with matching from/to
      const cursor = Collection.find({
        date: date,
        "allRoutes.from": from,
        "allRoutes.to": to,
      });

      const documents = await cursor.toArray();

      // Extract only the matching buses
      const result = documents.map((doc) => {
        const matchingRoutes = doc.allRoutes.filter(
          (route) => route.from === from && route.to === to
        );
        return {
          _id: doc._id,
          date: doc.date,
          matchingRoutes: matchingRoutes,
        };
      });

      return res.send(result);
    });

    app.post("/add-bus", async (req, res) => {
      const { bus_id, bus_name } = req.body;
      // console.log(bus_id, bus_name);
      const Collection = dataBase.collection("all-bus");
      // Check if the bus already exists by bus_id or bus_name
      const busExists = await Collection.findOne({
        $or: [{ bus_id }, { bus_name }],
      });
      if (busExists) {
        return res
          .status(409)
          .send({ message: "The bus you provided already exists" });
      }
      const result = await Collection.insertOne({ bus_id, bus_name });
      return res.send(result);
    });

    app.get("/available-bus", async (req, res) => {
      const queueCollection = dataBase.collection("all-bus");
      const users = await queueCollection.find().toArray();
      res.send(users);
    });
    app.get("/get-bus-id/:busname", async (req, res) => {
      const busname = req.params.busname;
      const collection = dataBase.collection("all-bus");
      const bus = await collection.findOne({ bus_name: busname });
      res.send(bus?.bus_id);
    });

    app.delete("/available-bus/:id", async (req, res) => {
      const busId = req.params.id;
      if (!ObjectId.isValid(busId)) {
        return res.status(400).json({ message: "Invalid bus ID" });
      }

      const result = await dataBase
        .collection("all-bus")
        .deleteOne({ _id: new ObjectId(busId) });

      if (result.deletedCount === 0) {
        return res.status(404).send({ message: "Bus not found" });
      }

      res.send({ message: "Bus deleted successfully" });
    });

    app.post("/add-location", async (req, res) => {
      const { location_name, geo_location } = req.body;
      const Collection = dataBase.collection("all-location");
      // Check if the bus already exists by bus_id or bus_name
      const busExists = await Collection.findOne({
        $or: [{ location_name }, { geo_location }],
      });
      if (busExists) {
        return res.send({
          message: "The location you provided already exists",
        });
      }
      const result = await Collection.insertOne({
        location_name,
        geo_location,
      });
      return res.send(result);
    });

    app.get("/available-location", async (req, res) => {
      const queueCollection = dataBase.collection("all-location");
      const locations = await queueCollection.find().toArray();
      res.send(locations);
    });

    app.delete("/available-location/:id", async (req, res) => {
      const locationId = req.params.id;
      if (!ObjectId.isValid(locationId)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }

      const result = await dataBase
        .collection("all-location")
        .deleteOne({ _id: new ObjectId(locationId) });

      if (result.deletedCount === 0) {
        return res.status(404).send({ message: "Location not found" });
      }

      res.send({ message: "Location deleted successfully" });
    });

    app.delete("/remove-driver/:id", async (req, res) => {
      const driverId = req.params.id;
      if (!ObjectId.isValid(driverId)) {
        return res.status(400).json({ message: "Invalid driver ID" });
      }

      const result = await dataBase
        .collection("users")
        .deleteOne({ _id: new ObjectId(driverId) });

      if (result.deletedCount === 0) {
        return res.status(404).send({ message: "driver not found" });
      }

      res.send({ message: "driver deleted successfully" });
    });

    app.get("/regirstration-queue", async (req, res) => {
      const queueCollection = dataBase.collection("regirstration-queue");
      const users = await queueCollection.findOne();
      // console.log(users);
      res.send(users);
    });

    app.post("/regirstration-queue", async (req, res) => {
      const { uid } = req.body;
      const queueCollection = dataBase.collection("regirstration-queue");
      const indexExists = await queueCollection.indexExists("createdAt_1");
      if (indexExists) {
        await queueCollection.dropIndex("createdAt_1");
      }
      await queueCollection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 2 }
      );
      const result = await queueCollection.insertOne({
        cardUID: uid,
        createdAt: new Date(),
      });
      if (result.acknowledged)
        return res.status(200).send({ message: "User added to the queue" });
      return res.status(500).send({ message: "There is a problem." });
    });

    app.post("/login", async (req, res) => {
      const { id, password } = req.body;
      const Collection = dataBase.collection("users");
      const user = await Collection.findOne({ studentID: id });
      if (user) {
        if (user.password == password)
          return res.status(200).send({ id: user.studentID, role: user?.role });
        else return res.status(400).send({ message: "Password is incorrect" });
      } else {
        return res.status(404).send({ message: "User is not registered" });
      }
    });

    app.post("/booking", async (req, res) => {
      const Collection = dataBase.collection("booking");
      const { uid, bus_id } = req.body;
      const user = await Collection.findOne({ cardUID: uid });
      if (user) {
        //already in booking list
        // const { data: location } = await axios.get(`${process.env.BASE}/gps`);
        const { data: location } = await axios.get(`${process.env.BASE}/gps`);
        delete location._id;
        if (JSON.stringify(location) !== JSON.stringify(user.start)) {
          //start and end not same so travled
          user["end"] = { geo: location, timestamp: new Date() };
          user.money -= 20;
          const money = user.money;
          const newMoney = {
            $set: {
              money: user.money,
            },
          };
          delete user.money;
          const userCollection = dataBase.collection("users");
          const result = await userCollection.updateOne(
            { cardUID: uid },
            newMoney,
            { upsert: true }
          );
          const traveledColection = dataBase.collection("traveled");
          const traveledReselt = await traveledColection.insertOne(user);
          const deleteResult = await Collection.deleteOne({ cardUID: uid });
          return res.status(200).send({
            message: `See you next time! ${user.name}`,
            Balance: money,
          });
        } else {
          //start and end same so in same location
          return res
            .status(425)
            .send({ message: "Not yet travel so no need of money" });
        }
      } else {
        //not in booking list
        const userCollection = dataBase.collection("users");
        const user = await userCollection.findOne({ cardUID: uid });
        if (user) {
          //user is authentic
          // const { data: location } = await axios.get(`${process.env.BASE}/gps`);
          if (user.money < 20) {
            return res.status(503).send({
              message: "Sorry you don't have enough money.",
              Balance: user.money,
            });
          }
          const { data: location } = await axios.get(`${process.env.BASE}/gps`);
          delete location._id;
          user["start"] = { geo: location, timestamp: new Date() };
          user["bus_id"] = bus_id;
          delete user._id;
          const result = await Collection.insertOne(user);
          if (result.acknowledged === true) {
            const locationCollection = dataBase.collection("student_location");
            const is_shared_location = await locationCollection.findOne({
              studentID: user.studentID,
            });
            if (is_shared_location) {
              const deleteResult = await locationCollection.deleteOne({
                studentID: user.studentID,
              });
            }

            return res.status(200).send({
              message: `Enjoy the journey ${user.name}`,
              Balance: user.money,
            });
          }
        } else {
          // user is not authentic

          return res.status(404).send({ message: "User is not registered" });
        }
      }
    });

    app.post("/add-bus-schedules", async (req, res) => {
      const payload = req.body;
      const Collection = dataBase.collection("bus-schedules");
      const exists = await Collection.findOne({ date: payload?.date });
      if (exists) {
        const newdata = {
          $set: {
            allRoutes: payload.allRoutes,
          },
        };
        const result = await Collection.updateOne(
          { date: payload?.date },
          newdata,
          { upsert: true }
        );
        return res.send(result);
      } else {
        const result = await Collection.insertOne(payload);
        return res.send(result);
      }
    });

    app.get("/get-bus-schedules/:dt", async (req, res) => {
      const date = req.params.dt;
      const Collection = dataBase.collection("bus-schedules");
      const routes = await Collection.findOne({ date: date });
      // console.log(routes);
      return res.send(routes);
    });

    app.get("/gps", async (req, res) => {
      const { busName } = req.query;
      const Collection = dataBase.collection("gps");

      if (busName) {
        console.log(busName);
        const { data: bus_id } = await axios.get(
          `${process.env.BASE}/get-bus-id/${busName}`
        );
        const coursor = Collection.find({ bus_id });
        const result = await coursor.toArray();
        console.log(result);
        return res.send(result);
      }
      const coursor = Collection.find();
      const result = await coursor.toArray();
      return res.send(result);
    });

    app.get("/students-location", async (req, res) => {
      const Collection = dataBase.collection("student_location");
      const result = await Collection.find().toArray();
      return res.send(result);
    });

    app.post("/activity", async (req, res) => {
      const { id } = req.body;
      const Collection = dataBase.collection("traveled");
      const all_data = await Collection.find(
        { studentID: id },
        { projection: { password: 0 } }
      ).toArray();
      res.send(all_data);
    });

    app.get("/all-user", async (req, res) => {
      const Collection = dataBase.collection("users");
      const all_data = await Collection.find(
        {},
        { projection: { password: 0 } }
      ).toArray();
      res.send(all_data);
    });

    app.get("/all-traveled", async (req, res) => {
      const Collection = dataBase.collection("traveled");
      const all_data = await Collection.find(
        {},
        { projection: { password: 0 } }
      ).toArray();
      res.send(all_data);
    });

    app.get("/all-driver", async (req, res) => {
      const Collection = dataBase.collection("users");
      const all_data = await Collection.find(
        { role: "Driver" },
        { projection: { password: 0 } }
      ).toArray();
      res.send(all_data);
    });

    app.get("/booked-seat", async (req, res) => {
      const Collection = dataBase.collection("booking");
      result = await Collection.find().toArray();
      return res.send({ booked: result.length });
    });

    app.get("/student/:id", async (req, res) => {
      Collection = dataBase.collection("users");
      const user = await Collection.findOne(
        { studentID: req?.params?.id },
        { projection: { _id: 0, password: 0 } }
      );
      return res.send(user);
    });

    // app.patch("/gps", async (req, res) => {
    //   const { latitude, longitude } = req.body;
    //   const objectId = new ObjectId("6719eca6761ba4c222624894");
    //   const result = await dataBase.collection("gps").updateOne({ _id: objectId }, { $set: { latitude, longitude } });

    //     if (result.matchedCount === 0) {
    //       return res.status(404);
    //     }
    //     return res.status(200);
    // });

    app.put("/gps", async (req, res) => {
      const options = { upsert: true };
      const Collection = dataBase.collection("gps");
      const { latitude, longitude, bus_id } = req.body;
      const filter = { bus_id };

      const gps_info = {
        $set: {
          bus_id,
          latitude: latitude,
          longitude: longitude,
        },
      };

      const result = await Collection.updateOne(filter, gps_info, options);
      return res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the API", status: "OK" });
});

app.listen(port, () => {
  console.log(`server is running on ${port}`);
});
