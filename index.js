const express = require('express');
const app = express();
const port=process.env.PORT || 5000;
app.use(express.json());

app.listen(port, ()=>{
    console.log('server is running');
});

app.post('/gps',async function (req, res) {
    const gps_info=req.body;
    console.log(gps_info);
    res.send(gps_info);
  })