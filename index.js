const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
var admin = require("firebase-admin");
var serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_DATA);

app.use(express.json());
app.use(cors());

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ombkm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const verifyToken = async (req, res, next) => {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const idToken = req.headers.authorization.split('Bearer ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(idToken);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}

const runFoodelDatabase = async () => {
    try {
        await client.connect();
        const database = client.db('FoodelDB');
        const usersCollection = database.collection('users');
        const delCollection = database.collection('deliveries');
        const orderCollection = database.collection('orders');
        const workersCollection = database.collection('delivery-workers');
        const adminsCollection = database.collection('admins');

        app.get('/users', async (req, res) => {
            const cursor = usersCollection.find({});
            const users = await cursor.toArray();
            res.send(users);
        })

        // check admin permissions
        app.get('/users/admins/verify', async (req, res) => {
            const email = req.query.email;
            const filter = { email: email };
            const admin = await adminsCollection.findOne(filter);
            let isAdmin = false;
            if (admin) {
                isAdmin = true;
            }
            res.json({ isAdmin });
        })

        // default admin
        const defaultAdmin = { name: 'Nafi Mahmud', email: 'nafiaiubian17@gmail.com', designation: 'CEO, Foodel' };
        const updateDoc = {
            $set: defaultAdmin
        }
        const options = { upsert: true }
        await adminsCollection.updateOne({}, updateDoc, options);

        // assign admin
        app.put('/users/admins/add', verifyToken, async (req, res) => {
            const newAdmin = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const query = { email: requester };
                const requesterAccount = await adminsCollection.findOne(query);
                if (requesterAccount) {
                    const filter = { email: newAdmin.email };
                    const updateDoc = {
                        $set: newAdmin
                    }
                    const options = { upsert: true }
                    const result = await adminsCollection.updateOne(filter, updateDoc, options);
                    res.json(result);
                }

            }
            else {
                res.status(401).json({ message: `You're not eligible for this role!` });
            }
        })

        // admin-list
        app.get('/users/admins', async (req, res) => {
            const admins = await adminsCollection.find({}).toArray();
            res.send(admins);
        })
        // kick an admin
        app.delete('/users/admins/remove/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await adminsCollection.deleteOne(query);
            res.json(result);
        })

        app.get('/deliveries', async (req, res) => {
            const cursor = delCollection.find({});
            const deliveries = await cursor.toArray();
            res.send(deliveries);
        })
        app.get('/deliveries/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const delivery = await delCollection.findOne(query);
            res.send(delivery);
        })
        app.delete('/deliveries/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await delCollection.deleteOne(query);
            res.json(result);
        })
        app.get('/delivery-workers', async (req, res) => {
            const cursor = workersCollection.find({});
            const workers = await cursor.toArray();
            res.send(workers);
        })
        app.post('/register', async (req, res) => {
            const newUser = req.body;
            const result = await usersCollection.insertOne(newUser);
            res.json(result);
        })
        app.post('/add-food', async (req, res) => {
            const newFood = req.body;
            const result = await delCollection.insertOne(newFood);
            res.json(result);
        })
        /* app.post('/add-order', async (req, res) => {
            const newOrder = req.body;
            const result = await orderCollection.insertOne(newOrder);
            res.json(result);
        }) */
        app.put('/add-order/:id', async (req, res) => {
            const newOrder = req.body;
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: newOrder
            }
            const result = await orderCollection.updateOne(query, updateDoc, options);
            res.json(result);
        })
        app.get('/my-order/:email', async (req, res) => {
            const searchByEmail = req.params.email;
            const query = { email: searchByEmail };
            const orders = await orderCollection.find(query).toArray();
            res.send(orders);
        })
        app.delete('/my-order/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.json(result);
        })
        app.get('/all-orders', async (req, res) => {
            const cursor = orderCollection.find({});
            const orders = await cursor.toArray();
            res.send(orders);
        })
        app.put('/manage-order/approve/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const approvedStatus = req.body;
            const updateDoc = {
                $set: {
                    status: approvedStatus.status
                }
            }
            const option = { upsert: true };
            const result = await orderCollection.updateOne(query, updateDoc, option);
            res.json(result);
        })
        app.delete('/manage-order/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.json(result);
        })
        app.put('/update-food/:id', async (req, res) => {
            const updateFood = req.body;
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const option = { upsert: true };
            const updateDoc = {
                $set: {
                    food: updateFood.food,
                    date: updateFood.description,
                    description: updateFood.description,
                    price: updateFood.price,
                    img_url: updateFood.img_url,
                    tag: updateFood.tag,

                }
            }
            const result = await delCollection.updateOne(filter, updateDoc, option);
            res.json(result);
        })
    }
    finally {
        // await client.close();
    }
}
runFoodelDatabase().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Foodel server is running');
});
app.listen(port, () => {
    console.log('listening on port ' + port);
})