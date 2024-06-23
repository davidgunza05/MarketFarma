const mongoose = require('mongoose');

const ContactoSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },  
  email: {
    type: String,
    required: true
  }, 
  numero: {
    type: String,
    required: true
  }, 
  msg: {
    type: String,
    required: true
  }, 
  date: {
    type: Date,
    default: Date.now()
  }, 
});

const contactoCLTN = mongoose.model('ContactoAdmin', ContactoSchema);

module.exports = contactoCLTN;
