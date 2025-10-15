const express = require('express');
const mongoose = require('mongoose');

const userRoutes = require('./src/routes/user.routes');
const orderRoutes = require('./src/routes/order.routes');
const orderItemRoutes = require('./src/routes/orderItem.routes');
const inventoryRoutes = require('./src/routes/inventory.routes');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

mongoose.connect('mongodb://localhost:27017/node-practical', { useNewUrlParser: true, useUnifiedTopology: true });

app.use('/users', userRoutes);
app.use('/orders', orderRoutes);
app.use('/order-items', orderItemRoutes);
app.use('/inventory', inventoryRoutes);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
