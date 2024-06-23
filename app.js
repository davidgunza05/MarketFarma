require("dotenv").config();
const express = require("express");
const app = express();
const flash = require('connect-flash');
const passport = require('passport');
const path = require("path");

// View Engine 0848 4025
app.set("view engine", "ejs");

// Database
require("./config/db");

// Session
const session = require("express-session");
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    name: "E-Farma-Session",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  }) 
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg')
  res.locals.error_msg = req.flash('error_msg')
  res.locals.error = req.flash('error'); // Adiciona suporte para mensagens de erro do Passpor
  next()
})
// To create req object
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Path
app.use(express.static(path.join(__dirname, "public"))); 

// Routes
const indexRouter = require("./routes/index");
app.use("/", indexRouter); 

const userRouter = require("./routes/user");
app.use("/users", userRouter);

const farmaciaRouter = require("./routes/farmacia");
app.use("/farmacia", farmaciaRouter);

const adminRouter = require("./routes/admin");
app.use("/admin", adminRouter);

// 404 Rendering
const UserCLTN = require("./models/user/details");
const Categoria = require("./models/admin/category");

app.all("*", async (req, res) => {
  const categories = await Categoria.find({});
  const currentUser = await UserCLTN.findById(req.session.userID);
  res.render("index/404", {
    documentTitle: "404 | Página não encontrada",
    url: req.originalUrl,
    session: req.session.userID,
    details: categories,
    currentUser,
    admin: req.session.admin
  });
});

// Create Server
const PORT = process.env.PORT;
app.listen(PORT, (err) => {  
  if (err) {
    console.log("Erro ao iniciar servidor: " + err);
  } else {
    console.log(`Servidor rodando em https://localhost:${PORT}`);
  }
});
