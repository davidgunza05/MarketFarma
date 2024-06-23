const sessionCheck = (req, res, next) => {
    if (req.session.userID) {
        next()
    } else {
        req.flash('error_msg', 'Inicia sessão para continuar!')
        res.redirect('/users/signIn')
    }
}

module.exports = sessionCheck;