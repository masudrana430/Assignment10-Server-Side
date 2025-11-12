const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
require("dotenv").config();

const serviceAccount = require("./sarviceKey.json");
const app = express()
const port = 3000
app.use(cors({
  origin: ['http://localhost:5173', 'https://b12-a10-masud.netlify.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json())



admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


app.get('/', (req, res) => {
  res.send('Hello World!')
})

console.log(process.env.DB_USERNAME);
console.log(process.env.DB_PASSWORD);


const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.3hpwj74.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const verifyToken = async (req, res, next) => {
  // console.log(req.headers.authorization);
  const authorization = req.headers.authorization
  if (!authorization) {
    return res.status(401).send({
      message: 'Unauthorized Access. token missing'
    });
  }
  const token = authorization.split(' ')[1];
  // console.log(token)
  // console.log('Inside middleware');


  try {
    await admin
      .auth()
      .verifyIdToken(token)

    next();
  } catch (error) {
    res.status(401).send({
      message: 'Unauthorized Access'
    })
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db("A10-DB");
    const IssuesCollection = db.collection("Issues");
    const ContributionCollection = db.collection("Contributions");

    app.get('/issues', async (req, res) => {
      const results = await IssuesCollection.find().toArray();
      res.send(results);
    })

    app.get('/issues/:id', verifyToken, async (req, res) => {
      const { id } = req.params;
      // console.log('Fetching issue with id:', id);
      const objectId = new ObjectId(id);
      const result = await IssuesCollection.findOne({ _id: objectId });

      res.send({ success: true, result });

    });

    // latest 6 issues (newest first)
    app.get('/latest-issues', async (req, res) => {
      try {
        const results = await IssuesCollection
          .find()
          .sort({ createdAt: -1, date: -1 }) // fallback to `date` if needed
          .limit(6)
          .toArray();

        res.send(results);
      } catch (e) {
        console.error(e);
        res.status(500).send({ message: 'Failed to load latest issues' });
      }
    });


    app.get('/my-issues', verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await IssuesCollection.find({ email: email }).toArray();
      res.send(result);
    });

    // // my-contribution
    // app.post('/contribution', async (req, res) => {
    //   const data = req.body;
    //   const result = await ContributionCollection.insertOne(data);
    //   res.send(result);

    // });

    app.get('/my-contribution', verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await ContributionCollection.find({ contribute_by: email }).toArray();
      res.send(result);
    });

    // List contributions for an issue
    app.get('/contributions', async (req, res) => {
      try {
        const { issueId } = req.query;
        const filter = issueId ? { issueId: String(issueId) } : {};
        const docs = await ContributionCollection.find(filter)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(docs.map(d => ({ ...d, _id: d._id.toString() })));
      } catch (e) {
        console.error(e);
        res.status(500).send({ message: 'Failed to fetch contributions' });
      }
    });

    // (Optional) safer create — ensures required fields exist
    app.post('/contribution', async (req, res) => {
      try {
        const {
          issueId, issueTitle, amount, contributorName,
          email, phone, address, note, avatar
        } = req.body || {};

        if (!issueId || !issueTitle || !amount || !email) {
          return res.status(400).send({ success: false, message: 'Missing required fields' });
        }

        const doc = {
          issueId: String(issueId),
          issueTitle: String(issueTitle),
          amount: Number(amount) || 0,
          contributorName: String(contributorName || 'Anonymous'),
          email: String(email).toLowerCase(),
          phone: String(phone || ''),
          address: String(address || ''),
          note: String(note || ''),
          avatar: String(avatar || ''),
          createdAt: new Date(),
          date: new Date(),
        };

        const result = await ContributionCollection.insertOne(doc);
        res.status(201).send({ success: true, _id: result.insertedId.toString() });
      } catch (e) {
        console.error(e);
        res.status(500).send({ success: false, message: 'Failed to create contribution' });
      }
    });






    // Create a new issue
    app.post('/issues', async (req, res) => {
      try {
        const {
          title, category, location, description, image,
          amount, status, date, email
        } = req.body || {};

        if (!title || !category || !location || !description || !email) {
          return res.status(400).send('Missing required fields');
        }

        const doc = {
          title,
          category,
          location,
          description,
          image: image || "",
          amount: Number(amount) || 0,
          status: status || "ongoing",
          date: date ? new Date(date) : new Date(),
          email,
          createdAt: new Date()
        };

        const result = await IssuesCollection.insertOne(doc);
        res.status(201).send({ _id: result.insertedId, ...doc });
      } catch (e) {
        console.error(e);
        res.status(500).send({ message: 'Failed to create issue' });
      }
    });

    //put update issue
    app.put('/issues/:id', async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      // console.log('Updating issue with id:', id);
      // console.log('Update data:', data);
      const objectId = new ObjectId(id);
      const filter = { _id: objectId };
      const update = {
        $set: data
      };
      const result = await IssuesCollection.updateOne(filter, update);



      res.send({ success: true, result });
    });

    // DELETE /issues/:id  (simple version to match your current process)
    app.delete('/issues/:id', async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ success: false, error: 'Invalid issue id' });
        }
        const result = await IssuesCollection.deleteOne({ _id: new ObjectId(id) });
        res.send({ success: true, deletedCount: result.deletedCount || 0 });
      } catch (e) {
        console.error('DELETE /issues/:id error:', e);
        res.status(500).send({ success: false, error: 'Failed to delete issue' });
      }
    });



















    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
