const express = require("express");
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;
app.use(express.json());
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.uztm9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

console.log(process.env);

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
      const {latitude,longitude} = req.body;

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
