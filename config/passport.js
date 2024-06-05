const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const Farmacia = require('../models/farmacia/farmacia');

module.exports = function(passport) {
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
      Farmacia.findOne({ email: email }).then(farmacia => {
        if (!farmacia) {
          return done(null, false, { message: 'Esta conta não existe' });
        }

        if (!farmacia.isActive) {
          return done(null, false, { message: 'Esta conta não está ativa, contate o administrador' });
        }

        bcrypt.compare(password, farmacia.password, (err, isMatch) => {
          if (err) throw err;
          if (isMatch) {
            return done(null, farmacia);
          } else {
            return done(null, false, { message: 'Senha incorreta' });
          }
        });
      });
    })
  );

  passport.serializeUser((farmacia, done) => {
    done(null, farmacia.id);
  });

  passport.deserializeUser((id, done) => {
    Farmacia.findById(id, (err, farmacia) => {
      done(err, farmacia);
    });
  });
};