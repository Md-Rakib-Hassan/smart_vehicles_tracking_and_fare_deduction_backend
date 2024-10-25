const express = require("express");
const app = express();
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const port = process.env.PORT || 5000;
app.use(express.json());

app.use(cors({
  origin: ['http://localhost:5174','http://localhost:5173'],
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
      res.send(result);
    });

    

    app.post('/booking', async (req, res) => { 
      const Collection = dataBase.collection("booking");
      const {uid} = req.body;
      const user = await Collection.findOne({ cardUID:uid });
      if (user) {
        //already in booking list
        // const { data: location } = await axios.get('http://localhost:5000/gps');
        const { data: location } = await axios.get('https://test-server-iot.vercel.app/gps');
        delete location._id;
        if (JSON.stringify(location) !== JSON.stringify(user.start)) {
          //start and end not same so travled
          user['end'] = location;
          const newMoney = {
            $set: {
              money:user.money - 20,
            },
          }
          delete user.money;
          const userCollection = dataBase.collection("users");
          const result = await userCollection.updateOne({ cardUID: uid }, newMoney, { upsert: true });
          const traveledColection = dataBase.collection("traveled");
          const traveledReselt = await traveledColection.insertOne(user);
          const deleteResult = await Collection.deleteOne({ cardUID: uid });
          res.status(200).send({massage:"See you next time!"});
          
        }
        else {
          //start and end same so in same location
          res.status(425).send({ massage: "not yet travel so no need of money" });
        }
      }
      else {
        //not in booking list
        const userCollection = dataBase.collection("users");
        const user = await userCollection.findOne({ cardUID:uid });
        if (user) {
          //user is authentic
          // const { data: location } = await axios.get('http://localhost:5000/gps');
          const { data: location } = await axios.get('https://test-server-iot.vercel.app/gps');
          delete location._id;
          user['start'] = location;
          delete user._id;
          const result = await Collection.insertOne(user);
          if (result.acknowledged === true) { 
            res.status(200).send({ massage: "Enjoy the journey"});
          }
          
        }
        else {
          // user is not authentic
 
          res.status(404).send({ massage: "User is not registered" });
        }
        
      }
    })

    app.get("/gps", async (req,res) => {
      const Collection = dataBase.collection("gps");
      const coursor = Collection.find();
      const result = await coursor.toArray();
      res.send(result[0]);
    })

    app.get("/booked-seat", async (req, res) => { 
      const Collection = dataBase.collection("booking");
      result = await Collection.find().toArray();
      res.send({booked:result.length});
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
      res.send(result);
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

app.listen(port, () => {
  console.log("server is running");
});
