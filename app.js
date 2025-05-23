const express = require('express');
const app = express();
const path = require('path');
const session = require('express-session');
const { passport } = require('./config/passport');
const env = require('dotenv').config();
const connectDB = require('./config/db');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');

connectDB();

app.use(express.json());
app.use(flash());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: 'keyboard cat',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
        cookie: { secure: false, httpOnly: true, maxAge: 72 * 60 * 60 * 1000 },
    })
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.user = req.user;
    next();
});

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads/product-images')));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', [
    path.join(__dirname, 'views/user'),
    path.join(__dirname, 'views/admin'),
]);

app.use('/', userRouter);
app.use('/admin', adminRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;