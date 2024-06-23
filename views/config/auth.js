module.exports = {
  Auth: function(req, res, next) {
      if (req.isAuthenticated()) {
        return next();
      }
      
      req.flash('error_msg', 'Por favor faz login para acessar');
      res.redirect('/farmacia/login');
    }  
  };
  