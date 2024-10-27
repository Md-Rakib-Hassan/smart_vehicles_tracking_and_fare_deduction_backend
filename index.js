const express = require("express");
const app = express();
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const port = process.env.PORT || 5000;
app.use(express.json());

app.use(cors({
  origin: ['http://localhost:5175','http://localhost:5173','https://glittery-longma-7bd21c.netlify.app'],
  credentials: true,
  optionSuccessStatus: 200
}));

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

    app.post("/mark-location", async function (req, res) {
      const Collection = dataBase.collection("student_location");
      const location_info = req.body;
      const { data: student_info } = await axios.get(`https://test-server-iot.vercel.app/student/${location_info?.studentID}`);
      if (student_info) {
        if (student_info.money < 20) return res.status(503).send({ massage: "Sorry you don't have enough money.", Balance: student_info.money });
        else {
          const is_already_shared_location = await Collection.findOne({ studentID: student_info?.studentID });
          if (is_already_shared_location) return res.status(409).send({ massage: "You already shared your location" });
          const booking_collection = dataBase.collection("booking");
          const is_already_in_bus = await booking_collection.findOne({ studentID: student_info?.studentID });
          if(is_already_in_bus) return res.status(409).send({ massage: "You already in the bus." });
          student_info.geocode = location_info.geocode;
          const result = await Collection.insertOne(student_info);
          return res.status(200).send(result);
        }
      }
      else {
        return res.status(404).send({ massage: "User is not registered" });
      }
    })

    app.post('/unmark-location', async (req, res) => {
      const { id } = req.body;
      const Collection = dataBase.collection('student_location');
      const user = await Collection.findOne({ studentID: id });
      if (user) {
        await Collection.deleteOne({ studentID: id });
        return res.status(200).send();
      }
      return res.status(404).send({massage:"You didn't share the location."});
      
    })

    app.post('/login', async (req, res) => { 
      const { id, password } = req.body;
      const Collection = dataBase.collection('users');
      const user = await Collection.findOne({ studentID: id});
      if (user) { 
        if (user.password == password) return res.status(200).send({ id: user.studentID ,role: user?.role });
        else return res.status(400).send({massage:"Password is incorrect"});
      }
      else {
        return res.status(404).send({massage: "User is not registered"});
      }

    })
    

    app.post('/booking', async (req, res) => { 
      const Collection = dataBase.collection("booking");
      const {uid} = req.body;
      const user = await Collection.findOne({ cardUID:uid });
      if (user) {
        //already in booking list
        // const { data: location } = await axios.get('http://localhost:5000/gps');
        const { data: location } = await axios.get('https://test-server-iot.vercel.app/gps');
        const { data: location_details } = await axios.get(`https://api.opencagedata.com/geocode/v1/json?q=${location.latitude}%2C${location.longitude}&key=${process.env.GEOCODING_KEY}`);
          const formatted_location = location_details.results[0].formatted;
        delete location._id;
        if (JSON.stringify(location) !== JSON.stringify(user.start)) {
          //start and end not same so travled
          user['end'] = {geo:location,formatted_location:formatted_location, timestamp: new Date()};
          user.money -= 20;
          const money = user.money;
          const newMoney = {
            $set: {
              money:user.money,
            },
          }
          delete user.money;
          const userCollection = dataBase.collection("users");
          const result = await userCollection.updateOne({ cardUID: uid }, newMoney, { upsert: true });
          const traveledColection = dataBase.collection("traveled");
          const traveledReselt = await traveledColection.insertOne(user);
          const deleteResult = await Collection.deleteOne({ cardUID: uid });
          return res.status(200).send({massage:`See you next time! ${user.name}`,Balance:money});
          
        }
        else {
          //start and end same so in same location
          return res.status(425).send({ massage: "Not yet travel so no need of money" });
        }
      }
      else {
        //not in booking list
        const userCollection = dataBase.collection("users");
        const user = await userCollection.findOne({ cardUID:uid });
        if (user) {
          //user is authentic
          // const { data: location } = await axios.get('http://localhost:5000/gps');
          if (user.money < 20) {
            return res.status(503).send({ massage: "Sorry you don't have enough money.",Balance:user.money });
          }
          const { data: location } = await axios.get('https://test-server-iot.vercel.app/gps');
          const { data: location_details } = await axios.get(`https://api.opencagedata.com/geocode/v1/json?q=${location.latitude}%2C${location.longitude}&key=${process.env.GEOCODING_KEY}`);
          const formatted_location = location_details.results[0].formatted;
          delete location._id;
          user['start'] = {geo:location,formatted_location:formatted_location, timestamp: new Date()};;
          delete user._id;
          const result = await Collection.insertOne(user);
          if (result.acknowledged === true) { 
            const locationCollection = dataBase.collection("student_location");
            const is_shared_location = await locationCollection.findOne({ studentID: user.studentID });
            if (is_shared_location) {
              const deleteResult = await locationCollection.deleteOne({ studentID: user.studentID });
            }

            return res.status(200).send({ massage: `Enjoy the journey ${user.name}`,Balance:user.money });
          } 
          
        }
        else {
          // user is not authentic
 
          return res.status(404).send({ massage: "User is not registered" });
        }
        
      }
    })

    app.get("/gps", async (req,res) => {
      const Collection = dataBase.collection("gps");
      const coursor = Collection.find();
      const result = await coursor.toArray();
      return res.send(result[0]);
    })

    app.get("/students-location", async (req,res) => {
      const Collection = dataBase.collection("student_location");
      const result = await Collection.find().toArray();
      return res.send(result);
    })


    app.get("/booked-seat", async (req, res) => {
      const Collection = dataBase.collection("booking");
      result = await Collection.find().toArray();
      return res.send({ booked: result.length });
    })

    app.get("/student/:id", async (req, res) => { 
      Collection = dataBase.collection("users");
      const user = await Collection.findOne({ studentID: req?.params?.id },{projection:{_id:0, password:0}});
      return res.send(user);
    })

    // app.patch("/gps", async (req, res) => {
    //   const { latitude, longitude } = req.body;
    //   const objectId = new ObjectId("6719eca6761ba4c222624894");
    //   const result = await dataBase.collection("gps").updateOne({ _id: objectId }, { $set: { latitude, longitude } });

    //     if (result.matchedCount === 0) {
    //       return res.status(404);
    //     }
    //     return res.status(200);
    // });

    app.put('/gps', async (req, res) => {
      const filter = { _id: new ObjectId('6719eca6761ba4c222624894') }
      const options = { upsert: true };
      const Collection = dataBase.collection("gps");
      const { latitude, longitude } = req.body;
      
      const gps_info = {
        $set: {
          latitude: latitude,
          longitude:longitude
        },
      }

      const result = await Collection.updateOne(filter, gps_info, options);
      return res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the API', status: 'OK' });
});

app.listen(port, () => {
  console.log("server is running");
});
